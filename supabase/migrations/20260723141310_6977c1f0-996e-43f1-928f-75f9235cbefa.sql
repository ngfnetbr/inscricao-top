
-- 1) Permitir oficinas nulas
ALTER TABLE public.inscricoes ALTER COLUMN oficina_quinta_id DROP NOT NULL;
ALTER TABLE public.inscricoes ALTER COLUMN oficina_sexta_id DROP NOT NULL;

-- 2) confirmar_inscricao com oficinas opcionais (pelo menos uma)
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
$function$;

-- 3) admin_atualizar_inscricao com oficinas opcionais
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

  UPDATE public.inscricoes
  SET oficina_quinta_id = _oficina_quinta,
      oficina_sexta_id = _oficina_sexta,
      nome = COALESCE(NULLIF(btrim(_nome),''), nome)
  WHERE id = _inscricao_id;

  RETURN jsonb_build_object('status','sucesso');
END;
$function$;

-- 4) admin_criar_inscricao (admin cria inscrição direta)
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
$function$;
