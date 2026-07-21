
-- Permitir que administradores autenticados gerenciem inscrições
CREATE POLICY "Autenticados gerenciam inscricoes"
ON public.inscricoes
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Função para transferir/atualizar oficinas de uma inscrição com validação de vagas
CREATE OR REPLACE FUNCTION public.admin_atualizar_inscricao(
  _inscricao_id uuid,
  _oficina_quinta uuid,
  _oficina_sexta uuid,
  _nome text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ins RECORD;
  v_of_q RECORD;
  v_of_s RECORD;
  v_count_q INT;
  v_count_s INT;
  v_first uuid;
  v_second uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status','nao_autorizado');
  END IF;

  IF _oficina_quinta = _oficina_sexta THEN
    RETURN jsonb_build_object('status','oficinas_iguais');
  END IF;

  SELECT * INTO v_ins FROM public.inscricoes WHERE id = _inscricao_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','inscricao_nao_encontrada');
  END IF;

  IF _oficina_quinta < _oficina_sexta THEN
    v_first := _oficina_quinta; v_second := _oficina_sexta;
  ELSE
    v_first := _oficina_sexta; v_second := _oficina_quinta;
  END IF;
  PERFORM 1 FROM public.oficinas WHERE id = v_first FOR UPDATE;
  PERFORM 1 FROM public.oficinas WHERE id = v_second FOR UPDATE;

  SELECT * INTO v_of_q FROM public.oficinas WHERE id = _oficina_quinta AND dia = 'quinta';
  IF NOT FOUND THEN RETURN jsonb_build_object('status','oficina_invalida','detalhe','quinta'); END IF;

  SELECT * INTO v_of_s FROM public.oficinas WHERE id = _oficina_sexta AND dia = 'sexta';
  IF NOT FOUND THEN RETURN jsonb_build_object('status','oficina_invalida','detalhe','sexta'); END IF;

  IF _oficina_quinta <> v_ins.oficina_quinta_id THEN
    SELECT COUNT(*) INTO v_count_q FROM public.inscricoes WHERE oficina_quinta_id = _oficina_quinta;
    IF v_count_q >= v_of_q.limite_vagas THEN
      RETURN jsonb_build_object('status','oficina_quinta_lotada');
    END IF;
  END IF;

  IF _oficina_sexta <> v_ins.oficina_sexta_id THEN
    SELECT COUNT(*) INTO v_count_s FROM public.inscricoes WHERE oficina_sexta_id = _oficina_sexta;
    IF v_count_s >= v_of_s.limite_vagas THEN
      RETURN jsonb_build_object('status','oficina_sexta_lotada');
    END IF;
  END IF;

  UPDATE public.inscricoes
  SET oficina_quinta_id = _oficina_quinta,
      oficina_sexta_id = _oficina_sexta,
      nome = COALESCE(NULLIF(btrim(_nome),''), nome)
  WHERE id = _inscricao_id;

  RETURN jsonb_build_object('status','sucesso');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_atualizar_inscricao(uuid, uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_atualizar_inscricao(uuid, uuid, uuid, text) TO authenticated;
