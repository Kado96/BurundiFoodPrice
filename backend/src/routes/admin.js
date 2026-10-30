import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../auth.js";
import { createAdminClient } from "../supabase.js";

const router = Router();

function toAuthEmail(raw) {
  const val = String(raw).trim().toLowerCase();
  if (!val) return val;
  if (val.includes("@")) return val;
  return `${val.replace(/\s+/g, ".")}@bfp.bi`;
}

function toAuthPassword(raw) {
  const p = String(raw);
  if (p.length >= 3 && p.length < 6) return `bfp#${p}#2026`;
  return p;
}

const createUserSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  email: z.string().trim().min(1).max(255),
  phone: z.string().trim().max(40).optional().nullable(),
  password: z.string().min(3).max(72),
  role: z.enum(["agent", "supervisor", "admin"]),
  market_ids: z.array(z.string().uuid()).max(100).default([]),
});

router.post("/users", requireAdmin, async (req, res) => {
  try {
    const body = createUserSchema.parse(req.body);
    if (body.role === "admin" && !req.isSuper) {
      return res.status(403).json({ error: "Seul le super admin peut créer un administrateur" });
    }
    const email = toAuthEmail(body.email);
    const password = toAuthPassword(body.password);
    const admin = createAdminClient();

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (createErr) {
      const msg = createErr.message?.toLowerCase().includes("already")
        ? "Cet identifiant est déjà utilisé"
        : createErr.message;
      return res.status(400).json({ error: msg });
    }

    const uid = created.user.id;
    await admin.from("profiles").upsert({
      id: uid,
      full_name: body.full_name,
      email,
      phone: body.phone || null,
    });

    const roles = body.role === "agent" ? ["agent"] : ["agent", body.role];
    for (const role of roles) {
      await admin.from("user_roles").upsert(
        { user_id: uid, role },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
    }

    if (body.market_ids.length) {
      await admin.from("agent_markets").upsert(
        body.market_ids.map((market_id) => ({ agent_id: uid, market_id })),
        { onConflict: "agent_id,market_id", ignoreDuplicates: true },
      );
    }

    return res.json({ ok: true, id: uid, email });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: err.errors?.[0]?.message || "Données invalides" });
    }
    console.error("[createUser]", err);
    return res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

router.post("/users/:id/password", requireAdmin, async (req, res) => {
  try {
    const password = toAuthPassword(z.string().min(3).max(72).parse(req.body.password));
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(req.params.id, { password });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Erreur" });
  }
});

router.post("/users/:id/suspend", requireAdmin, async (req, res) => {
  try {
    const suspended = z.boolean().parse(req.body.suspended);
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "Vous ne pouvez pas vous suspendre vous-même" });
    }
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(req.params.id, {
      ban_duration: suspended ? "876000h" : "none",
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Erreur" });
  }
});

router.get("/users/status", requireAdmin, async (_req, res) => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (error) return res.status(400).json({ error: error.message });
    return res.json(
      (data?.users ?? []).map((u) => ({
        id: u.id,
        last_sign_in_at: u.last_sign_in_at ?? null,
        suspended: !!(u.banned_until && new Date(u.banned_until) > new Date()),
      })),
    );
  } catch (err) {
    return res.status(500).json({ error: err.message || "Erreur" });
  }
});

const deleteSchema = z.object({
  mode: z.enum(["single", "batch", "all"]),
  id: z.string().uuid().optional(),
  agent_id: z.string().uuid().optional(),
  market_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  status: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

router.post("/observations/delete", requireAdmin, async (req, res) => {
  try {
    const body = deleteSchema.parse(req.body);
    const admin = createAdminClient();
    let q = admin.from("observations").delete();

    if (body.mode === "single") {
      if (!body.id) return res.status(400).json({ error: "id requis" });
      q = q.eq("id", body.id);
    } else if (body.mode === "batch") {
      const hasFilter =
        body.agent_id || body.market_id || body.product_id || body.status || body.date_from || body.date_to;
      if (!hasFilter) return res.status(400).json({ error: "Au moins un filtre requis" });
      if (body.agent_id) q = q.eq("agent_id", body.agent_id);
      if (body.market_id) q = q.eq("market_id", body.market_id);
      if (body.product_id) q = q.eq("product_id", body.product_id);
      if (body.status) q = q.eq("status", body.status);
      if (body.date_from) q = q.gte("observed_at", body.date_from);
      if (body.date_to) q = q.lte("observed_at", `${body.date_to}T23:59:59`);
    } else {
      q = q.neq("id", "00000000-0000-0000-0000-000000000000");
    }

    const { error } = await q;
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: err.errors?.[0]?.message || "Données invalides" });
    }
    return res.status(500).json({ error: err.message || "Erreur" });
  }
});

const uploadPhotoSchema = z.object({
  type: z.enum(["market", "product", "branding"]),
  name: z.string().trim().min(1).max(150),
  dataUrl: z.string().min(10),
});

function slugify(text) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

router.post("/upload-photo", requireAdmin, async (req, res) => {
  try {
    const { type, name, dataUrl } = uploadPhotoSchema.parse(req.body);

    const matches = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Format Data URL invalide (attendu: data:image/...;base64,...)" });
    }

    const contentType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");

    const slug = slugify(name) || "photo";
    const extension = contentType.includes("webp") ? "webp" : "jpg";
    const path = `catalogs/${type}s/${slug}_${Date.now()}.${extension}`;

    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("photos")
      .upload(path, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error("[upload-photo] storage upload error:", uploadError);
      return res.status(500).json({ error: uploadError.message || "Erreur lors du téléversement" });
    }

    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/photos/${path}`;

    return res.json({
      ok: true,
      url: publicUrl,
      path,
    });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: err.errors?.[0]?.message || "Données invalides" });
    }
    console.error("[upload-photo]", err);
    return res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

export default router;
