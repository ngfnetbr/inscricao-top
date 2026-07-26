-- ============================================
-- Export completo do schema public
-- Gerado em 2026-07-26T15:41:16Z
-- ============================================

-- ===== EXTENSÕES =====
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA vault;

-- ===== TIPOS / ENUMS =====
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor');

-- ===== TABELAS =====

-- Tabela: public.configuracoes
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave text NOT NULL,
  valor jsonb NOT NULL,
  atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
  atualizado_por uuid
);
ALTER TABLE public.configuracoes ADD CONSTRAINT configuracoes_pkey PRIMARY KEY (chave);
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le configuracoes" ON public.configuracoes AS PERMISSIVE FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela: public.gestor_oficinas
CREATE TABLE IF NOT EXISTS public.gestor_oficinas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  oficina_id uuid NOT NULL,
  criado_em timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.gestor_oficinas ADD CONSTRAINT gestor_oficinas_oficina_id_fkey FOREIGN KEY (oficina_id) REFERENCES oficinas(id) ON DELETE CASCADE;
ALTER TABLE public.gestor_oficinas ADD CONSTRAINT gestor_oficinas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.gestor_oficinas ADD CONSTRAINT gestor_oficinas_pkey PRIMARY KEY (id);
ALTER TABLE public.gestor_oficinas ADD CONSTRAINT gestor_oficinas_user_id_oficina_id_key UNIQUE (user_id, oficina_id);
ALTER TABLE public.gestor_oficinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia atribuições" ON public.gestor_oficinas AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestor vê suas atribuições" ON public.gestor_oficinas AS PERMISSIVE FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role)));

-- Tabela: public.inscricoes
CREATE TABLE IF NOT EXISTS public.inscricoes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  pessoa_id uuid,
  cpf text NOT NULL,
  nome text NOT NULL,
  oficina_quinta_id uuid,
  oficina_sexta_id uuid,
  protocolo text NOT NULL,
  criado_em timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.inscricoes ADD CONSTRAINT oficinas_diferentes CHECK ((oficina_quinta_id <> oficina_sexta_id));
ALTER TABLE public.inscricoes ADD CONSTRAINT inscricoes_oficina_quinta_id_fkey FOREIGN KEY (oficina_quinta_id) REFERENCES oficinas(id);
ALTER TABLE public.inscricoes ADD CONSTRAINT inscricoes_oficina_sexta_id_fkey FOREIGN KEY (oficina_sexta_id) REFERENCES oficinas(id);
ALTER TABLE public.inscricoes ADD CONSTRAINT inscricoes_pessoa_id_fkey FOREIGN KEY (pessoa_id) REFERENCES pessoas(id) ON DELETE SET NULL;
ALTER TABLE public.inscricoes ADD CONSTRAINT inscricoes_pkey PRIMARY KEY (id);
ALTER TABLE public.inscricoes ADD CONSTRAINT inscricoes_protocolo_key UNIQUE (protocolo);
ALTER TABLE public.inscricoes ADD CONSTRAINT inscricoes_cpf_key UNIQUE (cpf);
CREATE INDEX idx_inscricoes_quinta ON public.inscricoes USING btree (oficina_quinta_id);
CREATE INDEX idx_inscricoes_sexta ON public.inscricoes USING btree (oficina_sexta_id);
ALTER TABLE public.inscricoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia inscricoes" ON public.inscricoes AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabela: public.oficinas
CREATE TABLE IF NOT EXISTS public.oficinas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  titulo text NOT NULL,
  ministrante text NOT NULL,
  publico_alvo text,
  data date NOT NULL,
  dia text NOT NULL,
  limite_vagas integer DEFAULT 25 NOT NULL,
  ativa boolean DEFAULT true NOT NULL,
  ordem integer DEFAULT 0 NOT NULL,
  criado_em timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.oficinas ADD CONSTRAINT oficinas_dia_check CHECK ((dia = ANY (ARRAY['quinta'::text, 'sexta'::text])));
ALTER TABLE public.oficinas ADD CONSTRAINT oficinas_pkey PRIMARY KEY (id);
CREATE INDEX idx_oficinas_dia_ativa ON public.oficinas USING btree (dia, ativa);
ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia oficinas" ON public.oficinas AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Todos podem ver oficinas ativas" ON public.oficinas AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((ativa = true));

-- Tabela: public.pessoas
CREATE TABLE IF NOT EXISTS public.pessoas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cpf text NOT NULL,
  nome text NOT NULL,
  criado_em timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE public.pessoas ADD CONSTRAINT pessoas_pkey PRIMARY KEY (id);
ALTER TABLE public.pessoas ADD CONSTRAINT pessoas_cpf_key UNIQUE (cpf);
CREATE INDEX idx_pessoas_cpf ON public.pessoas USING btree (cpf);
CREATE UNIQUE INDEX pessoas_cpf_unique ON public.pessoas USING btree (cpf);
ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia pessoas" ON public.pessoas AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tabela: public.presencas
CREATE TABLE IF NOT EXISTS public.presencas (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  inscricao_id uuid NOT NULL,
  oficina_id uuid NOT NULL,
  manha boolean DEFAULT false,
  tarde boolean DEFAULT false,
  atualizado_em timestamp with time zone DEFAULT now() NOT NULL,
  atualizado_por uuid
);
ALTER TABLE public.presencas ADD CONSTRAINT presencas_atualizado_por_fkey FOREIGN KEY (atualizado_por) REFERENCES auth.users(id);
ALTER TABLE public.presencas ADD CONSTRAINT presencas_inscricao_id_fkey FOREIGN KEY (inscricao_id) REFERENCES inscricoes(id) ON DELETE CASCADE;
ALTER TABLE public.presencas ADD CONSTRAINT presencas_oficina_id_fkey FOREIGN KEY (oficina_id) REFERENCES oficinas(id) ON DELETE CASCADE;
ALTER TABLE public.presencas ADD CONSTRAINT presencas_pkey PRIMARY KEY (id);
ALTER TABLE public.presencas ADD CONSTRAINT presencas_inscricao_id_oficina_id_key UNIQUE (inscricao_id, oficina_id);
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin e gestor atualizam presenças" ON public.presencas AS PERMISSIVE FOR UPDATE TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR gerencia_oficina(auth.uid(), oficina_id))) WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR gerencia_oficina(auth.uid(), oficina_id)));
CREATE POLICY "Admin e gestor inserem presenças" ON public.presencas AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR gerencia_oficina(auth.uid(), oficina_id)));
CREATE POLICY "Admin e gestor veem presenças" ON public.presencas AS PERMISSIVE FOR SELECT TO authenticated USING ((has_role(auth.uid(), 'admin'::app_role) OR gerencia_oficina(auth.uid(), oficina_id)));
CREATE POLICY "Admin exclui presenças" ON public.presencas AS PERMISSIVE FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Tabela: public.user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  role app_role NOT NULL,
  criado_em timestamp with time zone DEFAULT now() NOT NULL,
  nome text
);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin gerencia papéis" ON public.user_roles AS PERMISSIVE FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Usuário vê seus próprios papéis" ON public.user_roles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- ===== VIEWS =====
CREATE OR REPLACE VIEW public.oficinas_com_vagas AS  SELECT id,
    titulo,
    ministrante,
    publico_alvo,
    data,
    dia,
    limite_vagas,
    ativa,
    ordem,
    contar_inscritos_oficina(id, dia) AS inscritos,
    GREATEST((limite_vagas - contar_inscritos_oficina(id, dia)), 0) AS vagas_disponiveis,
    (contar_inscritos_oficina(id, dia) >= limite_vagas) AS lotada
   FROM oficinas o;

-- ===== FUNÇÕES =====
CREATE OR REPLACE FUNCTION public.buscar_pessoa_por_cpf(_cpf text)
 RETURNS TABLE(id uuid, nome text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.nome
  FROM public.pessoas p
  WHERE p.cpf = regexp_replace(COALESCE(_cpf, ''), '[^0-9]', '', 'g')
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_nome_inscricoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.inscricoes
       SET nome = NEW.nome
     WHERE pessoa_id = NEW.id OR cpf = NEW.cpf;
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_atualizar_inscricao(_inscricao_id uuid, _oficina_quinta uuid, _oficina_sexta uuid, _nome text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_ins RECORD;
  v_of_q RECORD;
  v_of_s RECORD;
  v_count_q INT;
  v_count_s INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status','nao_autorizado');
  END IF;

  IF _oficina_quinta IS NOT NULL AND _oficina_sexta IS NOT NULL AND _oficina_quinta = _oficina_sexta THEN
    RETURN jsonb_build_object('status','oficinas_iguais');
  END IF;

  IF _oficina_quinta IS NULL AND _oficina_sexta IS NULL THEN
    RETURN jsonb_build_object('status','oficina_invalida');
  END IF;

  SELECT * INTO v_ins FROM public.inscricoes WHERE id = _inscricao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','inscricao_nao_encontrada');
  END IF;

  IF _oficina_quinta IS NOT NULL THEN
    SELECT * INTO v_of_q FROM public.oficinas WHERE id = _oficina_quinta AND dia = 'quinta';
    IF NOT FOUND THEN RETURN jsonb_build_object('status','oficina_invalida','detalhe','quinta'); END IF;
    IF _oficina_quinta IS DISTINCT FROM v_ins.oficina_quinta_id THEN
      SELECT COUNT(*) INTO v_count_q FROM public.inscricoes WHERE oficina_quinta_id = _oficina_quinta;
      IF v_count_q >= v_of_q.limite_vagas THEN
        RETURN jsonb_build_object('status','oficina_quinta_lotada');
      END IF;
    END IF;
  END IF;

  IF _oficina_sexta IS NOT NULL THEN
    SELECT * INTO v_of_s FROM public.oficinas WHERE id = _oficina_sexta AND dia = 'sexta';
    IF NOT FOUND THEN RETURN jsonb_build_object('status','oficina_invalida','detalhe','sexta'); END IF;
    IF _oficina_sexta IS DISTINCT FROM v_ins.oficina_sexta_id THEN
      SELECT COUNT(*) INTO v_count_s FROM public.inscricoes WHERE oficina_sexta_id = _oficina_sexta;
      IF v_count_s >= v_of_s.limite_vagas THEN
        RETURN jsonb_build_object('status','oficina_sexta_lotada');
      END IF;
    END IF;
  END IF;

  -- Mover/limpar chamada de QUINTA conforme mudança
  IF v_ins.oficina_quinta_id IS DISTINCT FROM _oficina_quinta THEN
    IF v_ins.oficina_quinta_id IS NOT NULL AND _oficina_quinta IS NOT NULL THEN
      -- Se já houver presença no destino, mantém e apaga a de origem; senão, move
      IF EXISTS (SELECT 1 FROM public.presencas WHERE inscricao_id = _inscricao_id AND oficina_id = _oficina_quinta) THEN
        DELETE FROM public.presencas WHERE inscricao_id = _inscricao_id AND oficina_id = v_ins.oficina_quinta_id;
      ELSE
        UPDATE public.presencas
           SET oficina_id = _oficina_quinta, atualizado_por = auth.uid(), atualizado_em = now()
         WHERE inscricao_id = _inscricao_id AND oficina_id = v_ins.oficina_quinta_id;
      END IF;
    ELSIF v_ins.oficina_quinta_id IS NOT NULL AND _oficina_quinta IS NULL THEN
      DELETE FROM public.presencas WHERE inscricao_id = _inscricao_id AND oficina_id = v_ins.oficina_quinta_id;
    END IF;
  END IF;

  -- Mover/limpar chamada de SEXTA conforme mudança
  IF v_ins.oficina_sexta_id IS DISTINCT FROM _oficina_sexta THEN
    IF v_ins.oficina_sexta_id IS NOT NULL AND _oficina_sexta IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.presencas WHERE inscricao_id = _inscricao_id AND oficina_id = _oficina_sexta) THEN
        DELETE FROM public.presencas WHERE inscricao_id = _inscricao_id AND oficina_id = v_ins.oficina_sexta_id;
      ELSE
        UPDATE public.presencas
           SET oficina_id = _oficina_sexta, atualizado_por = auth.uid(), atualizado_em = now()
         WHERE inscricao_id = _inscricao_id AND oficina_id = v_ins.oficina_sexta_id;
      END IF;
    ELSIF v_ins.oficina_sexta_id IS NOT NULL AND _oficina_sexta IS NULL THEN
      DELETE FROM public.presencas WHERE inscricao_id = _inscricao_id AND oficina_id = v_ins.oficina_sexta_id;
    END IF;
  END IF;

  UPDATE public.inscricoes
  SET oficina_quinta_id = _oficina_quinta,
      oficina_sexta_id = _oficina_sexta,
      nome = COALESCE(NULLIF(btrim(_nome),''), nome)
  WHERE id = _inscricao_id;

  RETURN jsonb_build_object('status','sucesso');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.marcar_presenca(_inscricao_id uuid, _oficina_id uuid, _manha boolean, _tarde boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.gerencia_oficina(auth.uid(), _oficina_id)) THEN
    RETURN jsonb_build_object('status','nao_autorizado');
  END IF;

  IF _manha IS NULL AND _tarde IS NULL THEN
    DELETE FROM public.presencas
     WHERE inscricao_id = _inscricao_id AND oficina_id = _oficina_id;
    RETURN jsonb_build_object('status','sucesso','horas',0);
  END IF;

  INSERT INTO public.presencas (inscricao_id, oficina_id, manha, tarde, atualizado_por, atualizado_em)
  VALUES (_inscricao_id, _oficina_id, _manha, _tarde, auth.uid(), now())
  ON CONFLICT (inscricao_id, oficina_id) DO UPDATE
    SET manha = EXCLUDED.manha,
        tarde = EXCLUDED.tarde,
        atualizado_por = auth.uid(),
        atualizado_em = now();

  RETURN jsonb_build_object('status','sucesso',
    'horas', (CASE WHEN _manha IS TRUE THEN 4 ELSE 0 END
             + CASE WHEN _tarde IS TRUE THEN 4 ELSE 0 END));
END; $function$
;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$function$
;

CREATE OR REPLACE FUNCTION public.gerencia_oficina(_user_id uuid, _oficina_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.gestor_oficinas WHERE user_id = _user_id AND oficina_id = _oficina_id);
$function$
;

CREATE OR REPLACE FUNCTION public.set_manutencao(_ativo boolean, _mensagem text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_valor JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('status','nao_autorizado');
  END IF;
  v_valor := jsonb_build_object(
    'ativo', COALESCE(_ativo, false),
    'mensagem', COALESCE(NULLIF(btrim(_mensagem), ''), 'Sistema temporariamente em manutenção. Volte em instantes.')
  );
  INSERT INTO public.configuracoes (chave, valor, atualizado_em, atualizado_por)
  VALUES ('manutencao', v_valor, now(), auth.uid())
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now(), atualizado_por = auth.uid();
  RETURN jsonb_build_object('status','sucesso','valor', v_valor);
END; $function$
;

CREATE OR REPLACE FUNCTION public.obter_manutencao()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT valor FROM public.configuracoes WHERE chave = 'manutencao'),
    jsonb_build_object('ativo', false, 'mensagem', 'Sistema temporariamente em manutenção. Volte em instantes.')
  );
$function$
;

CREATE OR REPLACE FUNCTION public.confirmar_inscricao(_cpf text, _nome text, _oficina_quinta uuid, _oficina_sexta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf TEXT;
  v_nome TEXT;
  v_pessoa_id UUID;
  v_of_q RECORD;
  v_of_s RECORD;
  v_count_q INT;
  v_count_s INT;
  v_protocolo TEXT;
  v_first UUID;
  v_second UUID;
  v_inscricao_id UUID;
BEGIN
  v_cpf := regexp_replace(COALESCE(_cpf, ''), '[^0-9]', '', 'g');
  v_nome := btrim(COALESCE(_nome, ''));

  IF length(v_cpf) < 11 THEN
    RETURN jsonb_build_object('status', 'cpf_invalido');
  END IF;
  IF length(v_nome) < 3 THEN
    RETURN jsonb_build_object('status', 'nome_invalido');
  END IF;
  IF _oficina_quinta IS NULL AND _oficina_sexta IS NULL THEN
    RETURN jsonb_build_object('status', 'oficina_invalida');
  END IF;
  IF _oficina_quinta IS NOT NULL AND _oficina_sexta IS NOT NULL AND _oficina_quinta = _oficina_sexta THEN
    RETURN jsonb_build_object('status', 'oficinas_iguais');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inscricoes WHERE cpf = v_cpf) THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
  END IF;

  IF _oficina_quinta IS NOT NULL AND _oficina_sexta IS NOT NULL THEN
    IF _oficina_quinta < _oficina_sexta THEN
      v_first := _oficina_quinta; v_second := _oficina_sexta;
    ELSE
      v_first := _oficina_sexta; v_second := _oficina_quinta;
    END IF;
    PERFORM 1 FROM public.oficinas WHERE id = v_first FOR UPDATE;
    PERFORM 1 FROM public.oficinas WHERE id = v_second FOR UPDATE;
  ELSIF _oficina_quinta IS NOT NULL THEN
    PERFORM 1 FROM public.oficinas WHERE id = _oficina_quinta FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.oficinas WHERE id = _oficina_sexta FOR UPDATE;
  END IF;

  IF _oficina_quinta IS NOT NULL THEN
    SELECT * INTO v_of_q FROM public.oficinas WHERE id = _oficina_quinta AND ativa = true;
    IF NOT FOUND OR v_of_q.dia <> 'quinta' THEN
      RETURN jsonb_build_object('status', 'oficina_invalida', 'detalhe', 'quinta');
    END IF;
    SELECT COUNT(*) INTO v_count_q FROM public.inscricoes WHERE oficina_quinta_id = _oficina_quinta;
    IF v_count_q >= v_of_q.limite_vagas THEN
      RETURN jsonb_build_object('status', 'oficina_quinta_lotada');
    END IF;
  END IF;

  IF _oficina_sexta IS NOT NULL THEN
    SELECT * INTO v_of_s FROM public.oficinas WHERE id = _oficina_sexta AND ativa = true;
    IF NOT FOUND OR v_of_s.dia <> 'sexta' THEN
      RETURN jsonb_build_object('status', 'oficina_invalida', 'detalhe', 'sexta');
    END IF;
    SELECT COUNT(*) INTO v_count_s FROM public.inscricoes WHERE oficina_sexta_id = _oficina_sexta;
    IF v_count_s >= v_of_s.limite_vagas THEN
      RETURN jsonb_build_object('status', 'oficina_sexta_lotada');
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.inscricoes WHERE cpf = v_cpf) THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
  END IF;

  INSERT INTO public.pessoas (cpf, nome)
  VALUES (v_cpf, v_nome)
  ON CONFLICT (cpf) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_pessoa_id;

  v_protocolo := 'EP-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));

  INSERT INTO public.inscricoes (pessoa_id, cpf, nome, oficina_quinta_id, oficina_sexta_id, protocolo)
  VALUES (v_pessoa_id, v_cpf, v_nome, _oficina_quinta, _oficina_sexta, v_protocolo)
  RETURNING id INTO v_inscricao_id;

  RETURN jsonb_build_object(
    'status', 'sucesso',
    'protocolo', v_protocolo,
    'inscricao_id', v_inscricao_id,
    'nome', v_nome,
    'oficina_quinta', CASE WHEN v_of_q IS NULL THEN NULL ELSE jsonb_build_object('id', v_of_q.id, 'titulo', v_of_q.titulo) END,
    'oficina_sexta', CASE WHEN v_of_s IS NULL THEN NULL ELSE jsonb_build_object('id', v_of_s.id, 'titulo', v_of_s.titulo) END
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.listar_minhas_oficinas()
 RETURNS TABLE(id uuid, titulo text, ministrante text, dia text, data date, publico_alvo text, limite_vagas integer, total_inscritos integer, chamadas_feitas integer, pendentes integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    o.id,
    o.titulo,
    o.ministrante,
    o.dia,
    o.data,
    o.publico_alvo,
    o.limite_vagas,
    COALESCE(ins.total, 0)::int AS total_inscritos,
    COALESCE(ch.total, 0)::int AS chamadas_feitas,
    (COALESCE(ins.total, 0) - COALESCE(ch.total, 0))::int AS pendentes
  FROM public.oficinas o
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS total
    FROM public.inscricoes i
    WHERE i.oficina_quinta_id = o.id OR i.oficina_sexta_id = o.id
  ) ins ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS total
    FROM public.presencas p
    WHERE p.oficina_id = o.id
  ) ch ON true
  WHERE public.has_role(auth.uid(),'admin')
     OR EXISTS (SELECT 1 FROM public.gestor_oficinas g WHERE g.user_id = auth.uid() AND g.oficina_id = o.id)
  ORDER BY o.dia, o.ordem, o.titulo;
$function$
;

CREATE OR REPLACE FUNCTION public.listar_participantes_publico()
 RETURNS TABLE(oficina_id uuid, dia text, data date, titulo text, ministrante text, publico_alvo text, ordem integer, nome text, manha boolean, tarde boolean, horas integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    o.id,
    o.dia,
    o.data,
    o.titulo,
    o.ministrante,
    o.publico_alvo,
    o.ordem,
    i.nome,
    COALESCE(p.manha, false) AS manha,
    COALESCE(p.tarde, false) AS tarde,
    (CASE WHEN COALESCE(p.manha,false) THEN 4 ELSE 0 END
     + CASE WHEN COALESCE(p.tarde,false) THEN 4 ELSE 0 END) AS horas
  FROM public.oficinas o
  LEFT JOIN public.inscricoes i
    ON i.oficina_quinta_id = o.id OR i.oficina_sexta_id = o.id
  LEFT JOIN public.presencas p
    ON p.inscricao_id = i.id AND p.oficina_id = o.id
  WHERE o.ativa = true
  ORDER BY o.dia, o.ordem, o.titulo, i.nome;
$function$
;

CREATE OR REPLACE FUNCTION public.consultar_inscricao_por_cpf(_cpf text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf text;
  v_ins record;
  v_of_q record;
  v_of_s record;
  v_p_q record;
  v_p_s record;
  v_manha_q boolean; v_tarde_q boolean; v_horas_q int;
  v_manha_s boolean; v_tarde_s boolean; v_horas_s int;
BEGIN
  v_cpf := regexp_replace(coalesce(_cpf, ''), '[^0-9]', '', 'g');
  IF length(v_cpf) < 11 THEN
    RETURN jsonb_build_object('status', 'cpf_invalido');
  END IF;

  SELECT * INTO v_ins FROM public.inscricoes WHERE cpf = v_cpf LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'nao_encontrado');
  END IF;

  SELECT * INTO v_of_q FROM public.oficinas WHERE id = v_ins.oficina_quinta_id;
  SELECT * INTO v_of_s FROM public.oficinas WHERE id = v_ins.oficina_sexta_id;

  SELECT * INTO v_p_q FROM public.presencas WHERE inscricao_id = v_ins.id AND oficina_id = v_ins.oficina_quinta_id;
  v_manha_q := COALESCE(v_p_q.manha, false);
  v_tarde_q := COALESCE(v_p_q.tarde, false);
  v_horas_q := (CASE WHEN v_manha_q THEN 4 ELSE 0 END) + (CASE WHEN v_tarde_q THEN 4 ELSE 0 END);

  SELECT * INTO v_p_s FROM public.presencas WHERE inscricao_id = v_ins.id AND oficina_id = v_ins.oficina_sexta_id;
  v_manha_s := COALESCE(v_p_s.manha, false);
  v_tarde_s := COALESCE(v_p_s.tarde, false);
  v_horas_s := (CASE WHEN v_manha_s THEN 4 ELSE 0 END) + (CASE WHEN v_tarde_s THEN 4 ELSE 0 END);

  RETURN jsonb_build_object(
    'status', 'encontrado',
    'protocolo', v_ins.protocolo,
    'nome', v_ins.nome,
    'criado_em', v_ins.criado_em,
    'oficina_quinta', jsonb_build_object(
      'id', v_of_q.id, 'titulo', v_of_q.titulo, 'ministrante', v_of_q.ministrante,
      'publico_alvo', v_of_q.publico_alvo, 'data', v_of_q.data,
      'manha', v_manha_q, 'tarde', v_tarde_q, 'horas', v_horas_q
    ),
    'oficina_sexta', jsonb_build_object(
      'id', v_of_s.id, 'titulo', v_of_s.titulo, 'ministrante', v_of_s.ministrante,
      'publico_alvo', v_of_s.publico_alvo, 'data', v_of_s.data,
      'manha', v_manha_s, 'tarde', v_tarde_s, 'horas', v_horas_s
    ),
    'total_horas', v_horas_q + v_horas_s
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.listar_chamada(_oficina_id uuid)
 RETURNS TABLE(inscricao_id uuid, nome text, cpf text, manha boolean, tarde boolean, horas integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.gerencia_oficina(auth.uid(), _oficina_id)) THEN
    RAISE EXCEPTION 'nao_autorizado';
  END IF;
  RETURN QUERY
  SELECT i.id, i.nome, i.cpf,
         p.manha, p.tarde,
         (CASE WHEN p.manha IS TRUE THEN 4 ELSE 0 END
          + CASE WHEN p.tarde IS TRUE THEN 4 ELSE 0 END)::int
  FROM public.inscricoes i
  LEFT JOIN public.presencas p
    ON p.inscricao_id = i.id AND p.oficina_id = _oficina_id
  WHERE i.oficina_quinta_id = _oficina_id OR i.oficina_sexta_id = _oficina_id
  ORDER BY i.nome;
END; $function$
;

CREATE OR REPLACE FUNCTION public.admin_criar_inscricao(_cpf text, _nome text, _oficina_quinta uuid, _oficina_sexta uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf TEXT;
  v_nome TEXT;
  v_pessoa_id UUID;
  v_of_q RECORD;
  v_of_s RECORD;
  v_count_q INT;
  v_count_s INT;
  v_protocolo TEXT;
  v_inscricao_id UUID;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RETURN jsonb_build_object('status','nao_autorizado');
  END IF;

  v_cpf := regexp_replace(COALESCE(_cpf, ''), '[^0-9]', '', 'g');
  v_nome := btrim(COALESCE(_nome, ''));

  IF length(v_cpf) < 11 THEN
    RETURN jsonb_build_object('status','cpf_invalido');
  END IF;
  IF length(v_nome) < 3 THEN
    RETURN jsonb_build_object('status','nome_invalido');
  END IF;
  IF _oficina_quinta IS NULL AND _oficina_sexta IS NULL THEN
    RETURN jsonb_build_object('status','oficina_invalida');
  END IF;
  IF _oficina_quinta IS NOT NULL AND _oficina_sexta IS NOT NULL AND _oficina_quinta = _oficina_sexta THEN
    RETURN jsonb_build_object('status','oficinas_iguais');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inscricoes WHERE cpf = v_cpf) THEN
    RETURN jsonb_build_object('status','cpf_ja_inscrito');
  END IF;

  IF _oficina_quinta IS NOT NULL THEN
    PERFORM 1 FROM public.oficinas WHERE id = _oficina_quinta FOR UPDATE;
    SELECT * INTO v_of_q FROM public.oficinas WHERE id = _oficina_quinta AND dia = 'quinta';
    IF NOT FOUND THEN RETURN jsonb_build_object('status','oficina_invalida','detalhe','quinta'); END IF;
    SELECT COUNT(*) INTO v_count_q FROM public.inscricoes WHERE oficina_quinta_id = _oficina_quinta;
    IF v_count_q >= v_of_q.limite_vagas THEN
      RETURN jsonb_build_object('status','oficina_quinta_lotada');
    END IF;
  END IF;

  IF _oficina_sexta IS NOT NULL THEN
    PERFORM 1 FROM public.oficinas WHERE id = _oficina_sexta FOR UPDATE;
    SELECT * INTO v_of_s FROM public.oficinas WHERE id = _oficina_sexta AND dia = 'sexta';
    IF NOT FOUND THEN RETURN jsonb_build_object('status','oficina_invalida','detalhe','sexta'); END IF;
    SELECT COUNT(*) INTO v_count_s FROM public.inscricoes WHERE oficina_sexta_id = _oficina_sexta;
    IF v_count_s >= v_of_s.limite_vagas THEN
      RETURN jsonb_build_object('status','oficina_sexta_lotada');
    END IF;
  END IF;

  INSERT INTO public.pessoas (cpf, nome)
  VALUES (v_cpf, v_nome)
  ON CONFLICT (cpf) DO UPDATE SET nome = EXCLUDED.nome
  RETURNING id INTO v_pessoa_id;

  v_protocolo := 'EP-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));

  INSERT INTO public.inscricoes (pessoa_id, cpf, nome, oficina_quinta_id, oficina_sexta_id, protocolo)
  VALUES (v_pessoa_id, v_cpf, v_nome, _oficina_quinta, _oficina_sexta, v_protocolo)
  RETURNING id INTO v_inscricao_id;

  RETURN jsonb_build_object('status','sucesso','inscricao_id', v_inscricao_id, 'protocolo', v_protocolo);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status','cpf_ja_inscrito');
END;
$function$
;

CREATE OR REPLACE FUNCTION public.contar_inscritos_oficina(_oficina_id uuid, _dia text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
  FROM public.inscricoes i
  WHERE (_dia = 'quinta' AND i.oficina_quinta_id = _oficina_id)
     OR (_dia = 'sexta' AND i.oficina_sexta_id = _oficina_id);
$function$
;

CREATE OR REPLACE FUNCTION public.admin_listar_gestores()
 RETURNS TABLE(user_id uuid, email text, nome text, oficinas jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'nao_autorizado';
  END IF;
  RETURN QUERY
  SELECT ur.user_id, u.email::text, ur.nome,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',o.id,'titulo',o.titulo,'dia',o.dia) ORDER BY o.dia, o.titulo)
      FROM public.gestor_oficinas g
      JOIN public.oficinas o ON o.id = g.oficina_id
      WHERE g.user_id = ur.user_id
    ), '[]'::jsonb)
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'gestor'
  ORDER BY COALESCE(ur.nome, u.email::text);
END; $function$
;

-- ===== TRIGGERS =====
CREATE TRIGGER trg_sync_nome_inscricoes AFTER UPDATE OF nome ON public.pessoas FOR EACH ROW EXECUTE FUNCTION sync_nome_inscricoes();

-- ===== STORAGE BUCKETS =====
-- nenhum bucket configurado

-- ===== POLÍTICAS DE STORAGE =====
-- nenhuma política de storage

-- ===== REALTIME =====
-- nenhuma tabela em realtime
