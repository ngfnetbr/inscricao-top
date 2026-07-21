
-- Enum de papéis
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','gestor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer para checar papel sem recursão
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Usuário vê seus próprios papéis" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admin gerencia papéis" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Tabela gestor_oficinas
CREATE TABLE public.gestor_oficinas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, oficina_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestor_oficinas TO authenticated;
GRANT ALL ON public.gestor_oficinas TO service_role;
ALTER TABLE public.gestor_oficinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestor vê suas atribuições" ON public.gestor_oficinas
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin gerencia atribuições" ON public.gestor_oficinas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Tabela presencas
CREATE TABLE public.presencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscricao_id uuid NOT NULL REFERENCES public.inscricoes(id) ON DELETE CASCADE,
  oficina_id uuid NOT NULL REFERENCES public.oficinas(id) ON DELETE CASCADE,
  manha boolean NOT NULL DEFAULT false,
  tarde boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid REFERENCES auth.users(id),
  UNIQUE (inscricao_id, oficina_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presencas TO authenticated;
GRANT ALL ON public.presencas TO service_role;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

-- Função para checar se usuário gerencia uma oficina
CREATE OR REPLACE FUNCTION public.gerencia_oficina(_user_id uuid, _oficina_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.gestor_oficinas WHERE user_id = _user_id AND oficina_id = _oficina_id);
$$;

CREATE POLICY "Admin e gestor veem presenças" ON public.presencas
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.gerencia_oficina(auth.uid(), oficina_id)
  );
CREATE POLICY "Admin e gestor inserem presenças" ON public.presencas
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.gerencia_oficina(auth.uid(), oficina_id)
  );
CREATE POLICY "Admin e gestor atualizam presenças" ON public.presencas
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'admin') OR public.gerencia_oficina(auth.uid(), oficina_id)
  ) WITH CHECK (
    public.has_role(auth.uid(),'admin') OR public.gerencia_oficina(auth.uid(), oficina_id)
  );
CREATE POLICY "Admin exclui presenças" ON public.presencas
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Concede papel admin ao usuário existente
INSERT INTO public.user_roles (user_id, role)
VALUES ('efba8127-6a52-4fcb-810b-6004f14bea69', 'admin')
ON CONFLICT DO NOTHING;

-- RPC: listar oficinas do gestor logado
CREATE OR REPLACE FUNCTION public.listar_minhas_oficinas()
RETURNS TABLE(id uuid, titulo text, ministrante text, dia text, data date, publico_alvo text, limite_vagas int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, o.titulo, o.ministrante, o.dia, o.data, o.publico_alvo, o.limite_vagas
  FROM public.oficinas o
  WHERE public.has_role(auth.uid(),'admin')
     OR EXISTS (SELECT 1 FROM public.gestor_oficinas g WHERE g.user_id = auth.uid() AND g.oficina_id = o.id)
  ORDER BY o.dia, o.ordem, o.titulo;
$$;

-- RPC: listar inscritos de uma oficina com presença (para chamada)
CREATE OR REPLACE FUNCTION public.listar_chamada(_oficina_id uuid)
RETURNS TABLE(inscricao_id uuid, nome text, cpf text, manha boolean, tarde boolean, horas int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.gerencia_oficina(auth.uid(), _oficina_id)) THEN
    RAISE EXCEPTION 'nao_autorizado';
  END IF;
  RETURN QUERY
  SELECT i.id, i.nome, i.cpf,
         COALESCE(p.manha,false), COALESCE(p.tarde,false),
         (CASE WHEN COALESCE(p.manha,false) THEN 4 ELSE 0 END
          + CASE WHEN COALESCE(p.tarde,false) THEN 4 ELSE 0 END)::int
  FROM public.inscricoes i
  LEFT JOIN public.presencas p
    ON p.inscricao_id = i.id AND p.oficina_id = _oficina_id
  WHERE i.oficina_quinta_id = _oficina_id OR i.oficina_sexta_id = _oficina_id
  ORDER BY i.nome;
END; $$;

-- RPC: marcar presença (upsert)
CREATE OR REPLACE FUNCTION public.marcar_presenca(_inscricao_id uuid, _oficina_id uuid, _manha boolean, _tarde boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.gerencia_oficina(auth.uid(), _oficina_id)) THEN
    RETURN jsonb_build_object('status','nao_autorizado');
  END IF;
  INSERT INTO public.presencas (inscricao_id, oficina_id, manha, tarde, atualizado_por, atualizado_em)
  VALUES (_inscricao_id, _oficina_id, COALESCE(_manha,false), COALESCE(_tarde,false), auth.uid(), now())
  ON CONFLICT (inscricao_id, oficina_id) DO UPDATE
    SET manha = COALESCE(EXCLUDED.manha,false),
        tarde = COALESCE(EXCLUDED.tarde,false),
        atualizado_por = auth.uid(),
        atualizado_em = now();
  RETURN jsonb_build_object('status','sucesso',
    'horas', (CASE WHEN COALESCE(_manha,false) THEN 4 ELSE 0 END
             + CASE WHEN COALESCE(_tarde,false) THEN 4 ELSE 0 END));
END; $$;

-- RPC: listar usuários com papel gestor (para admin gerenciar)
CREATE OR REPLACE FUNCTION public.admin_listar_gestores()
RETURNS TABLE(user_id uuid, email text, oficinas jsonb)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'nao_autorizado';
  END IF;
  RETURN QUERY
  SELECT ur.user_id, u.email::text,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',o.id,'titulo',o.titulo,'dia',o.dia) ORDER BY o.dia, o.titulo)
      FROM public.gestor_oficinas g
      JOIN public.oficinas o ON o.id = g.oficina_id
      WHERE g.user_id = ur.user_id
    ), '[]'::jsonb)
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'gestor'
  ORDER BY u.email;
END; $$;
