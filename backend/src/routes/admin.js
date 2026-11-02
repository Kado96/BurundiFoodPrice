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
  // Supabase refuse souvent les PIN courts / 100% numériques → toujours une forme forte
  if (p.length < 6 || /^\d+$/.test(p)) return `bfp#${p}#2026`;
  return p;
}

const uuidOk = (v) =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

const createUserSchema = z.object({
  full_name: z.string().trim().min(2, "Nom : 2 caractères minimum").max(100),
  email: z.string().trim().min(1, "Identifiant requis").max(255),
  phone: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      if (v == null) return null;
      const t = String(v).trim();
      return t ? t.slice(0, 40) : null;
    }),
  password: z.string().min(3, "Mot de passe : 3 caractères minimum").max(72),
  role: z.enum(["agent", "supervisor", "admin"], {
    errorMap: () => ({ message: "Rôle invalide" }),
  }),
  market_ids: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z.array(z.string()).max(100).transform((arr) => arr.filter(uuidOk)),
  ),
});

router.post("/users", requireAdmin, async (req, res) => {
  try {
    const body = createUserSchema.parse(req.body);
    // Tout admin peut créer agent / superviseur / administrateur.
    // super_admin reste réservé (non exposé dans le formulaire).
    const email = toAuthEmail(body.email);
    const password = toAuthPassword(body.password);
    const admin = createAdminClient();

    console.log("[createUser] attempt", {
      email,
      role: body.role,
      markets: body.market_ids.length,
      nameLen: body.full_name.length,
      pwdLen: password.length,
    });

    try {
      const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const taken = (existing?.users ?? []).some((u) => (u.email || "").toLowerCase() === email);
      if (taken) {
        return res.status(400).json({
          error: `Cet identifiant est déjà utilisé (${email}). Choisissez un autre nom d'utilisateur.`,
        });
      }
    } catch (listErr) {
      console.warn("[createUser] listUsers skip:", listErr?.message || listErr);
    }

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: body.full_name },
    });
    if (createErr) {
      console.error("[createUser] supabase:", createErr.message, createErr.code || "", { email });
      const lower = (createErr.message || "").toLowerCase();
      let msg = createErr.message || "Création impossible";
      if (lower.includes("already") || lower.includes("registered") || createErr.code === "email_exists") {
        msg = `Cet identifiant est déjà utilisé (${email})`;
      } else if (lower.includes("password")) {
        msg = "Mot de passe refusé par Supabase. Utilisez au moins 3 caractères (PIN accepté).";
      } else if (lower.includes("email") || lower.includes("invalid")) {
        msg = `Identifiant / e-mail invalide (${email})`;
      }
      return res.status(400).json({ error: msg });
    }

    const uid = created.user.id;
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: uid,
      full_name: body.full_name,
      email,
      phone: body.phone || null,
    });
    if (profileErr) console.error("[createUser] profile:", profileErr.message);

    const roles = body.role === "agent" ? ["agent"] : ["agent", body.role];
    for (const role of roles) {
      const { error: roleErr } = await admin.from("user_roles").upsert(
        { user_id: uid, role },
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
      if (roleErr) {
        // Fallback insert si upsert ignoreDuplicates échoue selon version client
        const { error: insErr } = await admin.from("user_roles").insert({ user_id: uid, role });
        if (insErr && !String(insErr.message || "").toLowerCase().includes("duplicate")) {
          console.error("[createUser] role:", role, insErr.message);
        }
      }
    }

    if (body.market_ids.length) {
      const { error: mkErr } = await admin.from("agent_markets").upsert(
        body.market_ids.map((market_id) => ({ agent_id: uid, market_id })),
        { onConflict: "agent_id,market_id", ignoreDuplicates: true },
      );
      if (mkErr) console.error("[createUser] markets:", mkErr.message);
    }

    return res.json({ ok: true, id: uid, email, role: body.role });
  } catch (err) {
    if (err?.name === "ZodError") {
      const issue = err.issues?.[0] || err.errors?.[0];
      console.error("[createUser] zod:", issue);
      return res.status(400).json({
        error: issue?.message || "Données invalides",
        field: issue?.path?.join(".") || null,
      });
    }
    console.error("[createUser]", err);
    return res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

router.delete("/users/:id", requireAdmin, async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    if (id === req.user.id) {
      return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte" });
    }
    const admin = createAdminClient();
    const { data: targetRoles } = await admin.from("user_roles").select("role").eq("user_id", id);
    const roles = (targetRoles ?? []).map((r) => r.role);
    if (roles.includes("super_admin")) {
      return res.status(403).json({ error: "Impossible de supprimer un super administrateur" });
    }
    await admin.from("agent_markets").delete().eq("agent_id", id);
    await admin.from("user_roles").delete().eq("user_id", id);
    await admin.from("profiles").delete().eq("id", id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return res.status(400).json({ error: error.message });
    return res.json({ ok: true });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Identifiant utilisateur invalide" });
    }
    console.error("[deleteUser]", err);
    return res.status(500).json({ error: err.message || "Erreur" });
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

router.all("/observations/delete", requireAdmin, async (req, res) => {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Méthode non autorisée. Utilisez POST ou DELETE." });
  }
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
  type: z.enum(["market", "product", "branding", "library"]),
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
    const folder = type === "library" ? "library" : `${type}s`;
    const path = `catalogs/${folder}/${slug}_${Date.now()}.${extension}`;

    const admin = createAdminClient();

    // Garantit le bucket public (idempotent)
    try {
      const { data: buckets } = await admin.storage.listBuckets();
      const hasPhotos = (buckets || []).some((b) => b.id === "photos" || b.name === "photos");
      if (!hasPhotos) {
        await admin.storage.createBucket("photos", {
          public: true,
          fileSizeLimit: 5242880,
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
        });
      } else {
        await admin.storage.updateBucket("photos", { public: true });
      }
    } catch (bucketErr) {
      console.warn("[upload-photo] bucket ensure:", bucketErr?.message || bucketErr);
    }

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

const galleryMetaSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
        path: z.string().optional(),
        label: z.string().optional(),
        kind: z.enum(["market", "product", "branding", "library"]).optional(),
        createdAt: z.string().optional(),
      }),
    )
    .optional()
    .default([]),
  markets: z.record(z.string()).default({}),
  products: z.record(z.string()).default({}),
  appBranding: z.record(z.any()).optional(),
  updatedAt: z.string().optional(),
});

/** Métadonnées galerie → Storage JSON (évite le 500 sur categories.name trop gros) */
router.post("/gallery-meta", requireAdmin, async (req, res) => {
  try {
    const parsed = galleryMetaSchema.parse(req.body || {});
    const httpOnly = (map) => {
      const out = {};
      for (const [k, v] of Object.entries(map || {})) {
        if (typeof v === "string" && /^https?:\/\//i.test(v)) out[k] = v;
      }
      return out;
    };
    const items = (parsed.items || []).filter(
      (it) => it && typeof it.url === "string" && /^https?:\/\//i.test(it.url),
    );
    const payload = {
      items,
      markets: httpOnly(parsed.markets),
      products: httpOnly(parsed.products),
      ...(parsed.appBranding ? { appBranding: parsed.appBranding } : {}),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
    const path = "catalogs/meta/gallery.json";
    const buffer = Buffer.from(JSON.stringify(payload), "utf8");
    const admin = createAdminClient();

    try {
      await admin.storage.updateBucket("photos", {
        public: true,
        allowedMimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
          "application/json",
        ],
      });
    } catch (bucketErr) {
      console.warn("[gallery-meta] bucket update:", bucketErr?.message || bucketErr);
    }

    const { error: uploadError } = await admin.storage.from("photos").upload(path, buffer, {
      contentType: "application/json",
      upsert: true,
    });
    if (uploadError) {
      console.error("[gallery-meta] upload:", uploadError);
      return res.status(500).json({ error: uploadError.message || "Erreur upload galerie" });
    }

    // Nettoie l’ancien hack categories __SYSTEM_PHOTOS__
    try {
      const { data: rows } = await admin
        .from("categories")
        .select("id")
        .like("name", "__SYSTEM_PHOTOS__:%");
      if (rows?.length) {
        await admin.from("categories").delete().in(
          "id",
          rows.map((r) => r.id),
        );
      }
    } catch (cleanErr) {
      console.warn("[gallery-meta] legacy cleanup:", cleanErr?.message || cleanErr);
    }

    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
    return res.json({
      ok: true,
      path,
      url: `${supabaseUrl}/storage/v1/object/public/photos/${path}`,
    });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: err.errors?.[0]?.message || "Données invalides" });
    }
    console.error("[gallery-meta]", err);
    return res.status(500).json({ error: err.message || "Erreur serveur" });
  }
});

export default router;
