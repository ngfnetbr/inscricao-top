DROP FUNCTION IF EXISTS public.listar_participantes_publico();

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
$function$;