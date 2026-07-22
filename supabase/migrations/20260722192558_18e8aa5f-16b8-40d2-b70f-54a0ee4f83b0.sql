
DROP POLICY IF EXISTS "todos leem configuracoes" ON public.configuracoes;

CREATE POLICY "admin le configuracoes" ON public.configuracoes
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.obter_manutencao()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT valor FROM public.configuracoes WHERE chave = 'manutencao'),
    jsonb_build_object('ativo', false, 'mensagem', 'Sistema temporariamente em manutenção. Volte em instantes.')
  );
$$;

GRANT EXECUTE ON FUNCTION public.obter_manutencao() TO anon, authenticated;
