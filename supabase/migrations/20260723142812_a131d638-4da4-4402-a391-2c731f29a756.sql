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
$function$;