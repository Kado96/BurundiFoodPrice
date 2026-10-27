import { createUserClient } from "./supabase.js";

export async function requireAdmin(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Non autorisé" });
    }
    const token = auth.slice(7);
    const sb = createUserClient(token);
    const { data: userData, error } = await sb.auth.getUser(token);
    if (error || !userData.user) {
      return res.status(401).json({ error: "Session invalide" });
    }
    const { data: isAdmin, error: roleErr } = await sb.rpc("is_admin", {
      _user_id: userData.user.id,
    });
    if (roleErr || !isAdmin) {
      return res.status(403).json({ error: "Réservé aux administrateurs" });
    }
    const { data: isSuper } = await sb.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "super_admin",
    });
    req.user = userData.user;
    req.isSuper = !!isSuper;
    next();
  } catch (err) {
    console.error("[auth]", err);
    res.status(500).json({ error: err.message || "Erreur auth" });
  }
}
