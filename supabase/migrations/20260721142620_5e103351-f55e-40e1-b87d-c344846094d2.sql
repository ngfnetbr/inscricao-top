
CREATE OR REPLACE FUNCTION public.sync_nome_inscricoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.inscricoes
       SET nome = NEW.nome
     WHERE pessoa_id = NEW.id OR cpf = NEW.cpf;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_nome_inscricoes ON public.pessoas;
CREATE TRIGGER trg_sync_nome_inscricoes
AFTER UPDATE OF nome ON public.pessoas
FOR EACH ROW
EXECUTE FUNCTION public.sync_nome_inscricoes();

-- Sincroniza retroativamente os nomes existentes
UPDATE public.inscricoes i
   SET nome = p.nome
  FROM public.pessoas p
 WHERE (i.pessoa_id = p.id OR i.cpf = p.cpf)
   AND i.nome IS DISTINCT FROM p.nome;
