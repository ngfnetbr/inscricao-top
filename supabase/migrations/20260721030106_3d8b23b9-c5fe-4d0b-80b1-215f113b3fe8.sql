
-- Support three states per turno: null = não marcado, true = presente, false = falta
DROP FUNCTION IF EXISTS public.listar_chamada(uuid);
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
END; $function$;

-- Aceita null para "não marcado"; remove a linha quando ambos são null
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
END; $function$;
