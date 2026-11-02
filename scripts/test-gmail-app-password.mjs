/**
 * Test local du mot de passe d'application Gmail (SMTP).
 * Usage: node scripts/test-gmail-app-password.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../backend/package.json"));
const nodemailer = require("nodemailer");
const rootEnv = path.resolve(__dirname, "../.env");
const backendEnv = path.resolve(__dirname, "../backend/.env");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/i);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

loadEnvFile(rootEnv);
loadEnvFile(backendEnv);

const user = (process.env.GMAIL_USER || "quicksales.bi@gmail.com").trim();
const pass = (process.env.GMAIL_APP_PASSWORD || "").trim();

if (!pass) {
  console.error("GMAIL_APP_PASSWORD manquant");
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
});

const info = await transporter.sendMail({
  from: `Burundi Food Price <${user}>`,
  to: user,
  subject: "✅ Test BFP — Gmail App Password OK",
  html: `<p>Le mot de passe d'application Gmail fonctionne depuis la machine locale.</p>
  <p>Compte: <b>${user}</b></p>
  <p>Horodatage: ${new Date().toLocaleString("fr-FR", { timeZone: "Africa/Bujumbura" })}</p>`,
});

console.log("EMAIL SENT", info.messageId, info.accepted);
