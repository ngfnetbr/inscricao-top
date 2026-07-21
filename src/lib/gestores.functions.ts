import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const criarGestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { email?: string; senha?: string; oficinaIds?: string[] };
    if (!d.email || !d.senha || d.senha.length < 6) throw new Error("Dados inválidos");
    return { email: d.email.trim().toLowerCase(), senha: d.senha, oficinaIds: d.oficinaIds ?? [] };
  })
  .handler(async ({ data, context }) => {
    const admin = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!admin.data) throw new Error("Não autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Tenta criar; se já existir, busca pelo email
    let userId: string | null = null;
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senha,
      email_confirm: true,
    });
    if (created.error) {
      // Se já existe, buscar
      const list = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list.data.users.find((u) => u.email?.toLowerCase() === data.email);
      if (!existing) throw new Error(created.error.message);
      userId = existing.id;
      // Atualiza senha
      await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: data.senha });
    } else {
      userId = created.data.user!.id;
    }

    await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: "gestor" }, { onConflict: "user_id,role" });

    if (data.oficinaIds.length > 0) {
      const rows = data.oficinaIds.map((oficina_id) => ({ user_id: userId!, oficina_id }));
      await supabaseAdmin.from("gestor_oficinas").upsert(rows, { onConflict: "user_id,oficina_id" });
    }
    return { userId };
  });

export const removerGestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { userId?: string };
    if (!d.userId) throw new Error("userId obrigatório");
    return { userId: d.userId };
  })
  .handler(async ({ data, context }) => {
    const admin = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!admin.data) throw new Error("Não autorizado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("gestor_oficinas").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "gestor");
    return { ok: true };
  });

export const definirOficinasGestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { userId?: string; oficinaIds?: string[] };
    if (!d.userId) throw new Error("userId obrigatório");
    return { userId: d.userId, oficinaIds: d.oficinaIds ?? [] };
  })
  .handler(async ({ data, context }) => {
    const admin = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!admin.data) throw new Error("Não autorizado");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("gestor_oficinas").delete().eq("user_id", data.userId);
    if (data.oficinaIds.length > 0) {
      const rows = data.oficinaIds.map((oficina_id) => ({ user_id: data.userId, oficina_id }));
      await supabaseAdmin.from("gestor_oficinas").insert(rows);
    }
    return { ok: true };
  });
