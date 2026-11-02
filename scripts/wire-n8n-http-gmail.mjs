/**
 * Remplace les nœuds Gmail/SMTP du workflow BFP par des HTTP Request
 * vers un relais Gmail (Google Apps Script ou /api/notify/email).
 *
 * Usage:
 *   set BFP_GMAIL_RELAY_URL=https://script.google.com/macros/s/XXXX/exec
 *   node scripts/wire-n8n-http-gmail.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "E:/Application/jarvis-starter-kit";
const envText = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const apiKey = (envText.match(/^n8n=(.+)$/m) || [])[1];
const base = "https://n8n-ajs5.onrender.com";
const headers = {
  "X-N8N-API-KEY": apiKey,
  Accept: "application/json",
  "Content-Type": "application/json",
};

const WF_ID = "2D3Jq26ddtZg3YX2";
const RELAY_URL = (process.env.BFP_GMAIL_RELAY_URL || "").trim();
const RELAY_SECRET = (process.env.BFP_GMAIL_RELAY_SECRET || "bfp-gmail-relay-2026").trim();

if (!RELAY_URL) {
  console.error("BFP_GMAIL_RELAY_URL manquant (URL Web App Google Apps Script)");
  process.exit(1);
}

function asHttpMailNode(node) {
  return {
    ...node,
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    credentials: {},
    parameters: {
      method: "POST",
      url: RELAY_URL,
      sendBody: true,
      specifyBody: "json",
      jsonBody: `={{ JSON.stringify({ secret: '${RELAY_SECRET}', to: 'quicksales.bi@gmail.com', subject: $json.subject, html: $json.html }) }}`,
      options: {
        response: {
          response: {
            neverError: true,
          },
        },
      },
    },
  };
}

async function api(method, urlPath, body) {
  const r = await fetch(`${base}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { ok: r.ok, status: r.status, text, json };
}

async function wakeup() {
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(8000) });
      if (r.status < 500) return;
    } catch {
      /* cold */
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
}

await wakeup();
const get = await api("GET", `/api/v1/workflows/${WF_ID}`);
if (!get.ok) throw new Error(`get wf ${get.status} ${get.text.slice(0, 200)}`);
const wf = get.json;

wf.nodes = (wf.nodes || []).map((n) => {
  if (n.name === "Send Instant Alert Email" || n.name === "Send 4h Report Email") {
    console.log("convert → HTTP", n.name);
    return asHttpMailNode(n);
  }
  return n;
});

const put = await api("PUT", `/api/v1/workflows/${WF_ID}`, {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: wf.settings || {},
});
console.log("PUT", put.status);
if (!put.ok) throw new Error(put.text.slice(0, 400));
await api("POST", `/api/v1/workflows/${WF_ID}/activate`);

const wh = await fetch(`${base}/webhook/bfp-events`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "collect",
    action: "price_collected",
    product_name: "Test Relais HTTP Gmail",
    market_name: "Marche Central",
    price: 5000,
    unit: "kg",
    agent_email: "agent-test@bfp.bi",
    observed_at: new Date().toISOString(),
    comment: "Test via Google Apps Script HTTP relay",
  }),
  signal: AbortSignal.timeout(60000),
});
console.log("WEBHOOK", wh.status, await wh.text());

await new Promise((r) => setTimeout(r, 25000));
const list = await api("GET", `/api/v1/executions?workflowId=${WF_ID}&limit=1`);
const id = list.json?.data?.[0]?.id;
console.log("latest", id, list.json?.data?.[0]?.status);
const exec = await api("GET", `/api/v1/executions/${id}?includeData=true`);
const rd = exec.json?.data?.resultData?.runData || {};
for (const [name, arr] of Object.entries(rd)) {
  const last = arr?.[arr.length - 1];
  if (last?.error) console.log(name, "ERR", last.error.message);
  else console.log(name, "OK");
}
