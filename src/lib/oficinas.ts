import { supabase } from "@/integrations/supabase/client";

export type OficinaComVagas = {
  id: string;
  titulo: string;
  ministrante: string;
  publico_alvo: string | null;
  data: string;
  dia: "quinta" | "sexta";
  limite_vagas: number;
  ativa: boolean;
  ordem: number;
  inscritos: number;
  vagas_disponiveis: number;
  lotada: boolean;
};

export async function listarOficinas(): Promise<OficinaComVagas[]> {
  const { data, error } = await supabase
    .from("oficinas_com_vagas")
    .select("*")
    .eq("ativa", true)
    .order("dia", { ascending: true })
    .order("ordem", { ascending: true })
    .order("titulo", { ascending: true });
  if (error) throw error;
  return (data ?? []) as OficinaComVagas[];
}

export async function buscarPessoaPorCpf(cpf: string) {
  const { data, error } = await supabase.rpc("buscar_pessoa_por_cpf", { _cpf: cpf });
  if (error) throw error;
  const linha = Array.isArray(data) ? data[0] : null;
  return linha ? { id: linha.id as string, nome: linha.nome as string } : null;
}

export type ConfirmarResultado =
  | { status: "sucesso"; protocolo: string; nome: string; oficina_quinta: { id: string; titulo: string }; oficina_sexta: { id: string; titulo: string } }
  | { status: "oficina_quinta_lotada" }
  | { status: "oficina_sexta_lotada" }
  | { status: "cpf_ja_inscrito" }
  | { status: "oficinas_iguais" }
  | { status: "oficina_invalida"; detalhe?: string }
  | { status: "cpf_invalido" }
  | { status: "nome_invalido" };

export async function confirmarInscricao(params: {
  cpf: string;
  nome: string;
  oficinaQuintaId: string;
  oficinaSextaId: string;
}): Promise<ConfirmarResultado> {
  const { data, error } = await supabase.rpc("confirmar_inscricao", {
    _cpf: params.cpf,
    _nome: params.nome,
    _oficina_quinta: params.oficinaQuintaId,
    _oficina_sexta: params.oficinaSextaId,
  });
  if (error) throw error;
  return data as unknown as ConfirmarResultado;
}
