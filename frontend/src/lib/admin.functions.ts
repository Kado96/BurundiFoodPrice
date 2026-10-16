import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("is_admin", { _user_id: ctx.userId });
  if (!data) throw new Error("Accès réservé aux administrateurs");
  const { data: sa } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "super_admin" });
  return { isSuper: !!sa };
}

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().default(""),
  password: z.string().min(8).max(72),
  role: z.enum(["agent", "supervisor", "admin"]),
  market_ids: z.array(z.string().uuid()).max(100).default([]),
});

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { isSuper } = await assertAdmin(context);
    if (data.role === "admin" && !isSuper) throw new Error("Seul le super administrateur peut créer un administrateur");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error || !u.user) throw new Error(error?.message?.includes("already") ? "Cet e-mail est déjà utilisé" : "Création impossible");
    const id = u.user.id;
    await supabaseAdmin.from("profiles").upsert({ id, full_name: data.full_name, email: data.email, phone: data.phone || null });
    const roles = data.role === "agent" ? ["agent"] : [data.role, "agent"];
    await supabaseAdmin.from("user_roles").insert(roles.map((role) => ({ user_id: id, role: role as any })));
    if (data.market_ids.length) await supabaseAdmin.from("agent_markets").insert(data.market_ids.map((market_id) => ({ agent_id: id, market_id })));
    return { id };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    if (error) throw new Error("Échec de la réinitialisation");
    return { ok: true };
  });

export const setUserSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), suspended: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id === context.userId) throw new Error("Vous ne pouvez pas vous suspendre vous-même");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: data.suspended ? "876000h" : "none" });
    if (error) throw new Error("Échec");
    return { ok: true };
  });

export const listUserStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    return (data?.users ?? []).map((u) => ({
      id: u.id,
      last_sign_in_at: u.last_sign_in_at ?? null,
      suspended: !!(u as any).banned_until && new Date((u as any).banned_until) > new Date(),
    }));
  });
