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
$function$;