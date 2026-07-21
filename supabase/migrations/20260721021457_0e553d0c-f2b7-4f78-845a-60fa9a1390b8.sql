
-- inscricoes: remove permissive policies, allow only admins direct access
DROP POLICY IF EXISTS "Autenticados gerenciam inscricoes" ON public.inscricoes;
DROP POLICY IF EXISTS "Autenticados podem ver inscrições" ON public.inscricoes;
CREATE POLICY "Admin gerencia inscricoes" ON public.inscricoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- oficinas: keep public SELECT of active workshops; restrict writes to admins
DROP POLICY IF EXISTS "Autenticados gerenciam oficinas" ON public.oficinas;
CREATE POLICY "Admin gerencia oficinas" ON public.oficinas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- pessoas: restrict all direct access to admins (public inscription upserts via SECURITY DEFINER RPC)
DROP POLICY IF EXISTS "Autenticados podem ver pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Autenticados podem atualizar pessoas" ON public.pessoas;
DROP POLICY IF EXISTS "Autenticados podem inserir pessoas" ON public.pessoas;
CREATE POLICY "Admin gerencia pessoas" ON public.pessoas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
