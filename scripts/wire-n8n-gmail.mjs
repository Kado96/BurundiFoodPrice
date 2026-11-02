/**
 * Branche le credential Gmail SMTP BFP sur le workflow Monitoring & Reporter.
 * Crée le credential s'il n'existe pas encore.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "E:/Application/jarvis-starter-kit";
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const apiKey = (env.match(/^n8n=(.+)$/m) || [])[1];
if (!apiKey) {
  console.error("N8N API key manquante dans .env (clé n8n=...)");
  process.exit(1);
}

const base = "https://n8n-ajs5.onrender.com";
const headers = {
  "X-N8N-API-KEY": apiKey,
  Accept: "application/json",
  "Content-Type": "application/json",
};

const GMAIL = {
  user: "quicksales.bi@gmail.com",
  password: "gtxbmaaemrzfynsc",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
};

const WF_ID = "2D3Jq26ddtZg3YX2";
const CRED_NAME = "Gmail SMTP BFP";

async function wakeup(maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(8000) });
      if (r.status < 500) {
        console.log(`[wakeup] OK status=${r.status}`);
        return;
      }
    } catch {
      // cold start
    }
    console.log("[wakeup] en attente Render...");
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("n8n non joignable après wakeup");
}

async function api(method, urlPath, body) {
  const r = await fetch(`${base}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json
  }
  return { ok: r.ok, status: r.status, text, json };
}

async function ensureCredential() {
  const list = await api("GET", "/api/v1/credentials");
  if (!list.ok) throw new Error(`list credentials ${list.status}: ${list.text.slice(0, 200)}`);
  const found = (list.json?.data || []).find((c) => c.name === CRED_NAME && c.type === "smtp");
  if (found) {
    console.log(`[cred] existant id=${found.id}`);
    // n8n public API ne permet souvent pas PATCH credentials ; on recrée si besoin d'écraser le mdp
    return found.id;
  }
  const created = await api("POST", "/api/v1/credentials", {
    name: CRED_NAME,
    type: "smtp",
    data: GMAIL,
  });
  if (!created.ok) throw new Error(`create credential ${created.status}: ${created.text.slice(0, 300)}`);
  console.log(`[cred] créé id=${created.json.id}`);
  return created.json.id;
}

async function wireWorkflow(credId) {
  const get = await api("GET", `/api/v1/workflows/${WF_ID}`);
  if (!get.ok) throw new Error(`get workflow ${get.status}: ${get.text.slice(0, 200)}`);
  const wf = get.json;
  let changed = 0;
  for (const node of wf.nodes || []) {
    if (node?.credentials?.smtp) {
      console.log(`[wf] ${node.name}: ${node.credentials.smtp.id} -> ${credId}`);
      node.credentials.smtp = { id: credId, name: CRED_NAME };
      changed++;
    }
  }
  if (!changed) {
    console.log("[wf] aucun nœud SMTP trouvé");
    return;
  }
  const put = await api("PUT", `/api/v1/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  });
  if (!put.ok) throw new Error(`put workflow ${put.status}: ${put.text.slice(0, 400)}`);
  console.log(`[wf] mis à jour OK (${changed} nœuds)`);
}

async function testCollectWebhook() {
  const payload = {
    type: "collect",
    action: "price_collected",
    product_name: "Test Haricot",
    market_name: "Marché Central (test SMTP)",
    price: 3500,
    unit: "kg",
    agent_email: "agent-test@bfp.bi",
    observed_at: new Date().toISOString(),
    comment: "Test connexion Gmail App Password quicksales.bi@gmail.com",
  };
  const r = await fetch(`${base}/webhook/bfp-events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000),
  });
  console.log(`[webhook] status=${r.status} body=${(await r.text()).slice(0, 200)}`);
}

await wakeup();
const credId = await ensureCredential();
await wireWorkflow(credId);
await testCollectWebhook();
console.log("DONE");
