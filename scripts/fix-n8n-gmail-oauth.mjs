/**
 * Remplace les nœuds SMTP (bloqués sur Render) par Gmail OAuth2 HTTP.
 * Destinataire : quicksales.bi@gmail.com
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "E:/Application/jarvis-starter-kit";
const env = fs.readFileSync(path.join(ROOT, ".env"), "utf8");
const apiKey = (env.match(/^n8n=(.+)$/m) || [])[1];
const base = "https://n8n-ajs5.onrender.com";
const headers = {
  "X-N8N-API-KEY": apiKey,
  Accept: "application/json",
  "Content-Type": "application/json",
};
const WF_ID = "2D3Jq26ddtZg3YX2";
const GMAIL_OAUTH = { id: "7ItqIsFw0pojKmYl", name: "Gmail account" };

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

function asGmailNode(node) {
  return {
    ...node,
    type: "n8n-nodes-base.gmail",
    typeVersion: 2.1,
    parameters: {
      authentication: "oAuth2",
      resource: "message",
      operation: "send",
      sendTo: "quicksales.bi@gmail.com",
      subject: "={{ $json.subject }}",
      emailType: "html",
      message: "={{ $json.html }}",
      options: {},
    },
    credentials: {
      gmailOAuth2: GMAIL_OAUTH,
    },
  };
}

await wakeup();
const get = await api("GET", `/api/v1/workflows/${WF_ID}`);
if (!get.ok) throw new Error(`get wf ${get.status}`);
const wf = get.json;

wf.nodes = (wf.nodes || []).map((n) => {
  if (
    n.name === "Send Instant Alert Email" ||
    n.name === "Send 4h Report Email" ||
    n.type === "n8n-nodes-base.emailSend" ||
    n.type === "n8n-nodes-base.gmail"
  ) {
    console.log("fix", n.name, "expr subject sample OK");
    return asGmailNode(n);
  }
  return n;
});

// sanity check expressions not mangled
for (const n of wf.nodes) {
  if (n.type === "n8n-nodes-base.gmail") {
    console.log(n.name, n.parameters.subject, n.parameters.message.slice(0, 20));
  }
}

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
    product_name: "Test OAuth Fix",
    market_name: "Marche Central",
    price: 4500,
    unit: "kg",
    agent_email: "agent-test@bfp.bi",
    observed_at: new Date().toISOString(),
    comment: "Test Gmail OAuth2 expressions corrigees",
  }),
  signal: AbortSignal.timeout(60000),
});
console.log("WEBHOOK", wh.status, await wh.text());

await new Promise((r) => setTimeout(r, 20000));
const list = await api("GET", `/api/v1/executions?workflowId=${WF_ID}&limit=1`);
const id = list.json?.data?.[0]?.id;
const status = list.json?.data?.[0]?.status;
console.log("latest", id, status);
const exec = await api("GET", `/api/v1/executions/${id}?includeData=true`);
const rd = exec.json?.data?.resultData?.runData || {};
for (const [name, arr] of Object.entries(rd)) {
  const last = arr?.[arr.length - 1];
  if (last?.error) console.log(name, "ERR", last.error.message);
  else console.log(name, "OK");
}
