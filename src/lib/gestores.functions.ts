import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const criarGestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const d = data as { nome?: string; email?: string; senha?: string; oficinaIds?: string[] };
    if (!d.email || !d.senha || d.senha.length < 6) throw new Error("Dados inválidos");
    return {
      nome: (d.nome ?? "").trim() || null,
      email: d.email.trim().toLowerCase(),
      senha: d.senha,
      oficinaIds: d.oficinaIds ?? [],
    };
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

    // Use direct fetch for Auth Admin API — the generated admin client
    // strips the Authorization header for sb_secret_ keys (needed for PostgREST),
    // which breaks GoTrue admin endpoints that require it.
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const authHeaders = {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    };

    let userId: string | null = null;
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ email: data.email, password: data.senha, email_confirm: true }),
    });
    if (createRes.ok) {
      const body = (await createRes.json()) as { id?: string; user?: { id?: string } };
      userId = body.id ?? body.user?.id ?? null;
    } else {
      const errText = await createRes.text();
      // Se já existe, buscar por email
      const listRes = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`,
        { headers: authHeaders },
      );
      if (!listRes.ok) throw new Error(`Falha ao criar usuário: ${errText}`);
      const list = (await listRes.json()) as { users?: { id: string; email?: string }[] };
      const existing = list.users?.find((u) => u.email?.toLowerCase() === data.email);
      if (!existing) throw new Error(`Falha ao criar usuário: ${errText}`);
      userId = existing.id;
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existing.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ password: data.senha }),
      });
    }
    if (!userId) throw new Error("ID de usuário não retornado.");

    const roleRes = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "gestor", nome: data.nome }, { onConflict: "user_id,role" });
    if (roleRes.error) throw new Error(`Falha ao atribuir papel: ${roleRes.error.message}`);

    if (data.oficinaIds.length > 0) {
      const rows = data.oficinaIds.map((oficina_id) => ({ user_id: userId!, oficina_id }));
      const ofRes = await supabaseAdmin
        .from("gestor_oficinas")
        .upsert(rows, { onConflict: "user_id,oficina_id" });
      if (ofRes.error) throw new Error(`Falha ao vincular oficinas: ${ofRes.error.message}`);
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
