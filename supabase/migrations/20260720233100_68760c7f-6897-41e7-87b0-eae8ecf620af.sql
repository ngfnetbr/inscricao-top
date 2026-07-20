
CREATE OR REPLACE FUNCTION public.consultar_inscricao_por_cpf(_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpf text;
  v_ins record;
  v_of_q record;
  v_of_s record;
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

  RETURN jsonb_build_object(
    'status', 'encontrado',
    'protocolo', v_ins.protocolo,
    'nome', v_ins.nome,
    'criado_em', v_ins.criado_em,
    'oficina_quinta', jsonb_build_object(
      'id', v_of_q.id, 'titulo', v_of_q.titulo, 'ministrante', v_of_q.ministrante,
      'publico_alvo', v_of_q.publico_alvo, 'data', v_of_q.data
    ),
    'oficina_sexta', jsonb_build_object(
      'id', v_of_s.id, 'titulo', v_of_s.titulo, 'ministrante', v_of_s.ministrante,
      'publico_alvo', v_of_s.publico_alvo, 'data', v_of_s.data
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consultar_inscricao_por_cpf(text) TO anon, authenticated;
