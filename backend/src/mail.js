import nodemailer from "nodemailer";

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

export function getMailConfig() {
  return {
    user: env("GMAIL_USER", "quicksales.bi@gmail.com"),
    pass: env("GMAIL_APP_PASSWORD"),
    host: env("SMTP_HOST", "smtp.gmail.com"),
    port: Number(env("SMTP_PORT", "465")),
    secure: env("SMTP_SECURE", "true") !== "false",
  };
}

export function createTransport() {
  const cfg = getMailConfig();
  if (!cfg.pass) {
    throw new Error("GMAIL_APP_PASSWORD manquant dans .env");
  }
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

/**
 * Envoi email HTML via Gmail App Password (SMTP).
 * Fonctionne hors Render (local / cPanel / VPS). Bloqué en SMTP sortant sur Render Free.
 */
export async function sendHtmlEmail({ to, subject, html, from } = {}) {
  const cfg = getMailConfig();
  const transporter = createTransport();
  const info = await transporter.sendMail({
    from: from || `Burundi Food Price <${cfg.user}>`,
    to: to || cfg.user,
    subject: subject || "(sans sujet)",
    html: html || "<p>(vide)</p>",
  });
  return { messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}
