import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gestor";

export async function obterPapel(userId: string): Promise<AppRole | null> {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .order("role", { ascending: true });
  if (!data || data.length === 0) return null;
  if (data.some((r) => r.role === "admin")) return "admin";
  if (data.some((r) => r.role === "gestor")) return "gestor";
  return null;
}
