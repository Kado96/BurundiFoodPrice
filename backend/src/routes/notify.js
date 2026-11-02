import { Router } from "express";
import { sendHtmlEmail, getMailConfig } from "../mail.js";

const router = Router();

function authorize(req) {
  const expected = (process.env.NOTIFY_SECRET || process.env.GMAIL_APP_PASSWORD || "").trim();
  if (!expected) return false;
  const header = String(req.headers["x-bfp-notify-secret"] || "");
  const query = String(req.query.secret || "");
  const bodySecret = String(req.body?.secret || "");
  return header === expected || query === expected || bodySecret === expected;
}

/**
 * POST /api/notify/email
 * Body: { to?, subject, html, secret? }
 * Header: X-BFP-Notify-Secret
 *
 * Utilisé par n8n (HTTP Request) pour contourner OAuth Gmail.
 * Note: sur Render Free, SMTP sortant est souvent bloqué → préférer le relais Apps Script.
 */
router.post("/email", async (req, res) => {
  try {
    if (!authorize(req)) {
      return res.status(401).json({ error: "Secret notify invalide" });
    }
    const { to, subject, html } = req.body || {};
    if (!subject || !html) {
      return res.status(400).json({ error: "subject et html requis" });
    }
    const result = await sendHtmlEmail({ to, subject, html });
    return res.json({ ok: true, ...result, from: getMailConfig().user });
  } catch (err) {
    console.error("[notify/email]", err);
    return res.status(502).json({
      error: err.message || "Envoi email échoué",
      hint: "Si tu es sur Render Free, SMTP est bloqué. Utilise le relais Google Apps Script (HTTP).",
    });
  }
});

router.get("/email/health", (_req, res) => {
  const cfg = getMailConfig();
  res.json({
    ok: true,
    user: cfg.user,
    host: cfg.host,
    port: cfg.port,
    passwordConfigured: Boolean(cfg.pass),
  });
});

export default router;
