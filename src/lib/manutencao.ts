import { supabase } from "@/integrations/supabase/client";

export type Manutencao = { ativo: boolean; mensagem: string };

const PADRAO: Manutencao = {
  ativo: false,
  mensagem: "Sistema temporariamente em manutenção. Volte em instantes.",
};

export async function obterManutencao(): Promise<Manutencao> {
  const { data, error } = await supabase.rpc("obter_manutencao");
  if (error || !data) return PADRAO;
  const v = (data ?? {}) as Partial<Manutencao>;
  return {
    ativo: Boolean(v.ativo),
    mensagem: (v.mensagem ?? PADRAO.mensagem).toString(),
  };
}

export async function definirManutencao(ativo: boolean, mensagem: string) {
  const { data, error } = await supabase.rpc("set_manutencao", {
    _ativo: ativo,
    _mensagem: mensagem,
  });
  if (error) throw error;
  return data as { status: string; valor?: Manutencao };
}
