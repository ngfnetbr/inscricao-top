
-- =========================================
-- Extensões
-- =========================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================
-- Tabela: pessoas
-- =========================================
CREATE TABLE public.pessoas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cpf TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pessoas_cpf ON public.pessoas(cpf);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoas TO authenticated;
GRANT ALL ON public.pessoas TO service_role;
-- Público NÃO tem SELECT direto (proteção de dados). Consulta via RPC.

ALTER TABLE public.pessoas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver pessoas"
  ON public.pessoas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Autenticados podem inserir pessoas"
  ON public.pessoas FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =========================================
-- Tabela: oficinas
-- =========================================
CREATE TABLE public.oficinas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  ministrante TEXT NOT NULL,
  publico_alvo TEXT,
  data DATE NOT NULL,
  dia TEXT NOT NULL CHECK (dia IN ('quinta','sexta')),
  limite_vagas INTEGER NOT NULL DEFAULT 25,
  ativa BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_oficinas_dia_ativa ON public.oficinas(dia, ativa);

GRANT SELECT ON public.oficinas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oficinas TO authenticated;
GRANT ALL ON public.oficinas TO service_role;

ALTER TABLE public.oficinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver oficinas ativas"
  ON public.oficinas FOR SELECT
  TO anon, authenticated
  USING (ativa = true);

CREATE POLICY "Autenticados gerenciam oficinas"
  ON public.oficinas FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- =========================================
-- Tabela: inscricoes
-- =========================================
CREATE TABLE public.inscricoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pessoa_id UUID REFERENCES public.pessoas(id) ON DELETE SET NULL,
  cpf TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  oficina_quinta_id UUID NOT NULL REFERENCES public.oficinas(id),
  oficina_sexta_id UUID NOT NULL REFERENCES public.oficinas(id),
  protocolo TEXT NOT NULL UNIQUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oficinas_diferentes CHECK (oficina_quinta_id <> oficina_sexta_id)
);
CREATE INDEX idx_inscricoes_quinta ON public.inscricoes(oficina_quinta_id);
CREATE INDEX idx_inscricoes_sexta ON public.inscricoes(oficina_sexta_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inscricoes TO authenticated;
GRANT ALL ON public.inscricoes TO service_role;
-- Público NÃO pode SELECT nem INSERT diretamente.

ALTER TABLE public.inscricoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver inscrições"
  ON public.inscricoes FOR SELECT
  TO authenticated
  USING (true);

-- =========================================
-- View: oficinas_com_vagas
-- =========================================
CREATE OR REPLACE VIEW public.oficinas_com_vagas
WITH (security_invoker = true) AS
SELECT
  o.id,
  o.titulo,
  o.ministrante,
  o.publico_alvo,
  o.data,
  o.dia,
  o.limite_vagas,
  o.ativa,
  o.ordem,
  COALESCE(inscritos.total, 0) AS inscritos,
  GREATEST(o.limite_vagas - COALESCE(inscritos.total, 0), 0) AS vagas_disponiveis,
  (COALESCE(inscritos.total, 0) >= o.limite_vagas) AS lotada
FROM public.oficinas o
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS total
  FROM public.inscricoes i
  WHERE (o.dia = 'quinta' AND i.oficina_quinta_id = o.id)
     OR (o.dia = 'sexta'  AND i.oficina_sexta_id  = o.id)
) inscritos ON TRUE;

GRANT SELECT ON public.oficinas_com_vagas TO anon, authenticated;

-- =========================================
-- Função: buscar_pessoa_por_cpf
-- Retorna somente a pessoa com o CPF exato.
-- =========================================
CREATE OR REPLACE FUNCTION public.buscar_pessoa_por_cpf(_cpf TEXT)
RETURNS TABLE (id UUID, nome TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome
  FROM public.pessoas p
  WHERE p.cpf = regexp_replace(COALESCE(_cpf, ''), '[^0-9]', '', 'g')
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_pessoa_por_cpf(TEXT) TO anon, authenticated;

-- =========================================
-- Função: confirmar_inscricao
-- Transação com bloqueio das oficinas em ordem crescente de ID.
-- =========================================
CREATE OR REPLACE FUNCTION public.confirmar_inscricao(
  _cpf TEXT,
  _nome TEXT,
  _oficina_quinta UUID,
  _oficina_sexta UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- Normalização
  v_cpf := regexp_replace(COALESCE(_cpf, ''), '[^0-9]', '', 'g');
  v_nome := btrim(COALESCE(_nome, ''));

  IF length(v_cpf) < 11 THEN
    RETURN jsonb_build_object('status', 'cpf_invalido');
  END IF;

  IF length(v_nome) < 3 THEN
    RETURN jsonb_build_object('status', 'nome_invalido');
  END IF;

  IF _oficina_quinta IS NULL OR _oficina_sexta IS NULL THEN
    RETURN jsonb_build_object('status', 'oficina_invalida');
  END IF;

  IF _oficina_quinta = _oficina_sexta THEN
    RETURN jsonb_build_object('status', 'oficinas_iguais');
  END IF;

  -- Verifica se CPF já está inscrito (fora do lock, checagem rápida)
  IF EXISTS (SELECT 1 FROM public.inscricoes WHERE cpf = v_cpf) THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
  END IF;

  -- Bloqueia oficinas SEMPRE em ordem crescente de ID para evitar deadlock
  IF _oficina_quinta < _oficina_sexta THEN
    v_first := _oficina_quinta;
    v_second := _oficina_sexta;
  ELSE
    v_first := _oficina_sexta;
    v_second := _oficina_quinta;
  END IF;

  PERFORM 1 FROM public.oficinas WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.oficinas WHERE id = v_second FOR UPDATE;

  -- Carrega dados
  SELECT * INTO v_of_q FROM public.oficinas WHERE id = _oficina_quinta AND ativa = true;
  IF NOT FOUND OR v_of_q.dia <> 'quinta' THEN
    RETURN jsonb_build_object('status', 'oficina_invalida', 'detalhe', 'quinta');
  END IF;

  SELECT * INTO v_of_s FROM public.oficinas WHERE id = _oficina_sexta AND ativa = true;
  IF NOT FOUND OR v_of_s.dia <> 'sexta' THEN
    RETURN jsonb_build_object('status', 'oficina_invalida', 'detalhe', 'sexta');
  END IF;

  -- Recontagem sob lock
  SELECT COUNT(*) INTO v_count_q FROM public.inscricoes WHERE oficina_quinta_id = _oficina_quinta;
  IF v_count_q >= v_of_q.limite_vagas THEN
    RETURN jsonb_build_object('status', 'oficina_quinta_lotada');
  END IF;

  SELECT COUNT(*) INTO v_count_s FROM public.inscricoes WHERE oficina_sexta_id = _oficina_sexta;
  IF v_count_s >= v_of_s.limite_vagas THEN
    RETURN jsonb_build_object('status', 'oficina_sexta_lotada');
  END IF;

  -- Recheck CPF duplicado sob lock
  IF EXISTS (SELECT 1 FROM public.inscricoes WHERE cpf = v_cpf) THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
  END IF;

  -- Localizar pessoa existente
  SELECT id INTO v_pessoa_id FROM public.pessoas WHERE cpf = v_cpf LIMIT 1;

  -- Gerar protocolo curto
  v_protocolo := 'EP-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 8));

  INSERT INTO public.inscricoes (pessoa_id, cpf, nome, oficina_quinta_id, oficina_sexta_id, protocolo)
  VALUES (v_pessoa_id, v_cpf, v_nome, _oficina_quinta, _oficina_sexta, v_protocolo)
  RETURNING id INTO v_inscricao_id;

  RETURN jsonb_build_object(
    'status', 'sucesso',
    'protocolo', v_protocolo,
    'inscricao_id', v_inscricao_id,
    'nome', v_nome,
    'oficina_quinta', jsonb_build_object('id', v_of_q.id, 'titulo', v_of_q.titulo),
    'oficina_sexta', jsonb_build_object('id', v_of_s.id, 'titulo', v_of_s.titulo)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_inscricao(TEXT, TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_inscricao(TEXT, TEXT, UUID, UUID) TO anon, authenticated;

-- =========================================
-- Realtime
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.inscricoes;
