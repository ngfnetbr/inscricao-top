ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS nome text;

DROP FUNCTION IF EXISTS public.admin_listar_gestores();

CREATE OR REPLACE FUNCTION public.admin_listar_gestores()
 RETURNS TABLE(user_id uuid, email text, nome text, oficinas jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'nao_autorizado';
  END IF;
  RETURN QUERY
  SELECT ur.user_id, u.email::text, ur.nome,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',o.id,'titulo',o.titulo,'dia',o.dia) ORDER BY o.dia, o.titulo)
      FROM public.gestor_oficinas g
      JOIN public.oficinas o ON o.id = g.oficina_id
      WHERE g.user_id = ur.user_id
    ), '[]'::jsonb)
  FROM public.user_roles ur
  JOIN auth.users u ON u.id = ur.user_id
  WHERE ur.role = 'gestor'
  ORDER BY COALESCE(ur.nome, u.email::text);
END; $function$;