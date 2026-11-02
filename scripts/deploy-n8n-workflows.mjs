/**
 * Déploie / met à jour et active les workflows n8n BFP en production.
 * Utilisé en local et par GitHub Actions (après chaque push sur main).
 *
 * Env:
 *   N8N_API_KEY ou n8n= dans jarvis .env
 *   N8N_BASE_URL (défaut https://n8n-ajs5.onrender.com)
 *   BFP_GMAIL_RELAY_URL / BFP_GMAIL_RELAY_SECRET (optionnel, réapplique le relais email)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKFLOWS_DIR = path.join(ROOT, "n8n", "workflows");
const BASE = (process.env.N8N_BASE_URL || "https://n8n-ajs5.onrender.com").replace(/\/$/, "");

function loadApiKey() {
  if (process.env.N8N_API_KEY?.trim()) return process.env.N8N_API_KEY.trim();
  const candidates = [
    path.join(ROOT, ".env"),
    path.join(ROOT, "backend", ".env"),
    "E:/Application/jarvis-starter-kit/.env",
  ];
  for (const file of candidates) {
    try {
      const text = fs.readFileSync(file, "utf8");
      const m = text.match(/^(?:N8N_API_KEY|n8n)=(.+)$/m);
      if (m?.[1]) return m[1].trim();
    } catch {
      /* skip */
    }
  }
  return "";
}

const API_KEY = loadApiKey();
if (!API_KEY) {
  console.error("N8N_API_KEY manquante (secret GitHub ou .env n8n=...)");
  process.exit(1);
}

const headers = {
  "X-N8N-API-KEY": API_KEY,
  Accept: "application/json",
  "Content-Type": "application/json",
};

async function api(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(`${method} ${urlPath} → ${res.status} ${text.slice(0, 300)}`);
  }
  return json;
}

async function wakeup() {
  console.log(`[n8n] wake ${BASE} ...`);
  for (let i = 1; i <= 25; i++) {
    try {
      const r = await fetch(`${BASE}/healthz`, { signal: AbortSignal.timeout(10000) });
      if (r.status < 500) {
        console.log(`[n8n] online (attempt ${i})`);
        return;
      }
    } catch {
      /* cold start */
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  console.warn("[n8n] healthz timeout — tentative deploy quand même");
}

function sanitizeWorkflow(raw) {
  const {
    name,
    nodes,
    connections,
    settings,
    staticData,
  } = raw;
  return {
    name,
    nodes,
    connections,
    settings: settings || {},
    staticData: staticData || null,
  };
}

function applyGmailRelay(wf) {
  const url = (process.env.BFP_GMAIL_RELAY_URL || "").trim();
  const secret = (process.env.BFP_GMAIL_RELAY_SECRET || "bfp-gmail-relay-2026").trim();
  if (!url) return wf;
  const mailNodes = new Set(["Send Instant Alert Email", "Send 4h Report Email"]);
  wf.nodes = (wf.nodes || []).map((n) => {
    if (!mailNodes.has(n.name)) return n;
    return {
      ...n,
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      credentials: {},
      parameters: {
        method: "POST",
        url,
        sendBody: true,
        specifyBody: "json",
        jsonBody: `={{ JSON.stringify({ secret: '${secret}', to: 'quicksales.bi@gmail.com', subject: $json.subject, html: $json.html }) }}`,
        options: { response: { response: { neverError: true } } },
      },
    };
  });
  return wf;
}

async function upsertAndActivate(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let payload = sanitizeWorkflow(raw);
  payload = applyGmailRelay(payload);

  const list = await api("GET", "/api/v1/workflows?limit=100");
  const items = list.data || list || [];
  const existing = items.find((w) => w.name === payload.name);

  let id;
  if (existing) {
    console.log(`[n8n] update "${payload.name}" (${existing.id})`);
    const updated = await api("PUT", `/api/v1/workflows/${existing.id}`, payload);
    id = updated.id || existing.id;
  } else {
    console.log(`[n8n] create "${payload.name}"`);
    const created = await api("POST", "/api/v1/workflows", payload);
    id = created.id;
  }

  console.log(`[n8n] activate ${id}`);
  await api("POST", `/api/v1/workflows/${id}/activate`, {});
  return { id, name: payload.name };
}

await wakeup();

const files = fs
  .readdirSync(WORKFLOWS_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => path.join(WORKFLOWS_DIR, f));

if (!files.length) {
  console.error(`Aucun workflow dans ${WORKFLOWS_DIR}`);
  process.exit(1);
}

const results = [];
for (const file of files) {
  results.push(await upsertAndActivate(file));
}

console.log("[n8n] OK", JSON.stringify(results, null, 2));
console.log(`[n8n] webhook prod: ${BASE}/webhook/bfp-events`);
