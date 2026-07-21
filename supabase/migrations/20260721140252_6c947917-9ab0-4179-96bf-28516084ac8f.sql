CREATE OR REPLACE FUNCTION public.contar_inscritos_oficina(_oficina_id uuid, _dia text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.inscricoes i
  WHERE (_dia = 'quinta' AND i.oficina_quinta_id = _oficina_id)
     OR (_dia = 'sexta' AND i.oficina_sexta_id = _oficina_id);
$$;

REVOKE ALL ON FUNCTION public.contar_inscritos_oficina(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_inscritos_oficina(uuid, text) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.oficinas_com_vagas
WITH (security_invoker = on)
AS
SELECT
  o.id,
  o.titulo,
  o.ministrante,
  o.publico_alvo,
  o.data,
  o.dia,
  o.limite_vagas,
  o.ativa,
  o.ordem,
  public.contar_inscritos_oficina(o.id, o.dia) AS inscritos,
  GREATEST(o.limite_vagas - public.contar_inscritos_oficina(o.id, o.dia), 0) AS vagas_disponiveis,
  public.contar_inscritos_oficina(o.id, o.dia) >= o.limite_vagas AS lotada
FROM public.oficinas o;

GRANT SELECT ON public.oficinas_com_vagas TO anon, authenticated;
GRANT ALL ON public.oficinas_com_vagas TO service_role;