
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave TEXT PRIMARY KEY,
  valor JSONB NOT NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_por UUID
);

GRANT SELECT ON public.configuracoes TO anon, authenticated;
GRANT ALL ON public.configuracoes TO service_role;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos leem configuracoes" ON public.configuracoes
  FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.configuracoes (chave, valor)
VALUES ('manutencao', jsonb_build_object('ativo', false, 'mensagem', 'Sistema temporariamente em manutenção. Volte em instantes.'))
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_manutencao(_ativo BOOLEAN, _mensagem TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('status','nao_autorizado');
  END IF;
  v_valor := jsonb_build_object(
    'ativo', COALESCE(_ativo, false),
    'mensagem', COALESCE(NULLIF(btrim(_mensagem), ''), 'Sistema temporariamente em manutenção. Volte em instantes.')
  );
  INSERT INTO public.configuracoes (chave, valor, atualizado_em, atualizado_por)
  VALUES ('manutencao', v_valor, now(), auth.uid())
  ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor, atualizado_em = now(), atualizado_por = auth.uid();
  RETURN jsonb_build_object('status','sucesso','valor', v_valor);
END; $$;
