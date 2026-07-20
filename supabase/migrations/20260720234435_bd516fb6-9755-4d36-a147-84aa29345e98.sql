CREATE OR REPLACE FUNCTION public.listar_participantes_publico()
RETURNS TABLE(oficina_id uuid, dia text, data date, titulo text, ministrante text, publico_alvo text, ordem integer, nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.id, o.dia, o.data, o.titulo, o.ministrante, o.publico_alvo, o.ordem, i.nome
  FROM public.oficinas o
  LEFT JOIN public.inscricoes i
    ON i.oficina_quinta_id = o.id OR i.oficina_sexta_id = o.id
  WHERE o.ativa = true
  ORDER BY o.dia, o.ordem, o.titulo, i.nome;
$$;

GRANT EXECUTE ON FUNCTION public.listar_participantes_publico() TO anon, authenticated;