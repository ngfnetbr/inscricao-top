
CREATE UNIQUE INDEX IF NOT EXISTS pessoas_cpf_unique ON public.pessoas(cpf);

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
  IF _oficina_quinta IS NULL OR _oficina_sexta IS NULL THEN
    RETURN jsonb_build_object('status', 'oficina_invalida');
  END IF;
  IF _oficina_quinta = _oficina_sexta THEN
    RETURN jsonb_build_object('status', 'oficinas_iguais');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inscricoes WHERE cpf = v_cpf) THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
  END IF;

  IF _oficina_quinta < _oficina_sexta THEN
    v_first := _oficina_quinta; v_second := _oficina_sexta;
  ELSE
    v_first := _oficina_sexta; v_second := _oficina_quinta;
  END IF;

  PERFORM 1 FROM public.oficinas WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.oficinas WHERE id = v_second FOR UPDATE;

  SELECT * INTO v_of_q FROM public.oficinas WHERE id = _oficina_quinta AND ativa = true;
  IF NOT FOUND OR v_of_q.dia <> 'quinta' THEN
    RETURN jsonb_build_object('status', 'oficina_invalida', 'detalhe', 'quinta');
  END IF;

  SELECT * INTO v_of_s FROM public.oficinas WHERE id = _oficina_sexta AND ativa = true;
  IF NOT FOUND OR v_of_s.dia <> 'sexta' THEN
    RETURN jsonb_build_object('status', 'oficina_invalida', 'detalhe', 'sexta');
  END IF;

  SELECT COUNT(*) INTO v_count_q FROM public.inscricoes WHERE oficina_quinta_id = _oficina_quinta;
  IF v_count_q >= v_of_q.limite_vagas THEN
    RETURN jsonb_build_object('status', 'oficina_quinta_lotada');
  END IF;

  SELECT COUNT(*) INTO v_count_s FROM public.inscricoes WHERE oficina_sexta_id = _oficina_sexta;
  IF v_count_s >= v_of_s.limite_vagas THEN
    RETURN jsonb_build_object('status', 'oficina_sexta_lotada');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inscricoes WHERE cpf = v_cpf) THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
  END IF;

  -- Upsert pessoa: cria se não existir, atualiza nome se já existir
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
    'oficina_quinta', jsonb_build_object('id', v_of_q.id, 'titulo', v_of_q.titulo),
    'oficina_sexta', jsonb_build_object('id', v_of_s.id, 'titulo', v_of_s.titulo)
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('status', 'cpf_ja_inscrito');
END;
$function$;
