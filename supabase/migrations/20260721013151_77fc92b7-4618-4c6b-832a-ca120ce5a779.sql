
DROP FUNCTION IF EXISTS public.listar_minhas_oficinas();

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
$function$;
