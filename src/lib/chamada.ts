import { supabase } from "@/integrations/supabase/client";

export type MinhaOficina = {
  id: string;
  titulo: string;
  ministrante: string;
  dia: "quinta" | "sexta" | string;
  data: string;
  publico_alvo: string | null;
  limite_vagas: number;
};

export async function listarMinhasOficinas(): Promise<MinhaOficina[]> {
  const { data, error } = await supabase.rpc("listar_minhas_oficinas");
  if (error) throw error;
  return (data ?? []) as MinhaOficina[];
}

export type ChamadaItem = {
  inscricao_id: string;
  nome: string;
  cpf: string;
  manha: boolean;
  tarde: boolean;
  horas: number;
};

export async function listarChamada(oficinaId: string): Promise<ChamadaItem[]> {
  const { data, error } = await supabase.rpc("listar_chamada", { _oficina_id: oficinaId });
  if (error) throw error;
  return (data ?? []) as ChamadaItem[];
}

export async function marcarPresenca(params: {
  inscricaoId: string;
  oficinaId: string;
  manha: boolean;
  tarde: boolean;
}) {
  const { data, error } = await supabase.rpc("marcar_presenca", {
    _inscricao_id: params.inscricaoId,
    _oficina_id: params.oficinaId,
    _manha: params.manha,
    _tarde: params.tarde,
  });
  if (error) throw error;
  return data as { status: string; horas?: number };
}

export async function ehAdmin(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return false;
  const r = await supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
  return !!r.data;
}
