/**
 * Burundi Food Price - Télémétrie n8n
 * Actif en prod / Vercel / APK. Jamais bloquant pour l'UI.
 *
 * Render free endort n8n → webhook 404 au cold start. On réveille + cooldown
 * pour éviter le spam console.
 */

const N8N_BASE = "https://n8n-ajs5.onrender.com";
const N8N_WEBHOOK_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_N8N_WEBHOOK_URL?: string } }).env?.VITE_N8N_WEBHOOK_URL?.trim()) ||
  `${N8N_BASE}/webhook/bfp-events`;

const PAGE_VIEW_THROTTLE_MS = 60 * 1000;
/** Après un échec (404 cold start), ne pas retenter pendant 3 min */
const FAIL_COOLDOWN_MS = 3 * 60 * 1000;

let lastPageViewTime = 0;
let lastPageViewPath = "";
let failUntil = 0;
let waking = false;

export interface TelemetryEvent {
  type: "collect" | "traffic";
  action?: string;
  timestamp?: string;
  user_agent?: string;
  [key: string]: unknown;
}

function wakeN8n(): void {
  if (waking) return;
  waking = true;
  void fetch(`${N8N_BASE}/healthz`, {
    method: "GET",
    mode: "no-cors",
    keepalive: true,
  })
    .catch(() => undefined)
    .finally(() => {
      waking = false;
    });
}

/**
 * Envoie un événement en arrière-plan. Échecs silencieux (pas de throw).
 */
export async function trackEvent(event: TelemetryEvent): Promise<void> {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_DISABLE_TELEMETRY === "1") {
      return;
    }
    if (Date.now() < failUntil) {
      wakeN8n();
      return;
    }

    const payload = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      origin_url: typeof window !== "undefined" ? window.location.href : "",
    };

    const body = JSON.stringify(payload);

    // cors + JSON : le navigateur n'affiche un 404 "dur" que si la réponse est lisible ;
    // on catch tout. Si CORS bloque, on bascule no-cors une fois.
    const res = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => null);

    if (res && (res.status === 404 || res.status >= 500)) {
      failUntil = Date.now() + FAIL_COOLDOWN_MS;
      wakeN8n();
      return;
    }
    if (!res) {
      // CORS / réseau : tentative opaque (pas de lecture du status)
      void fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        keepalive: true,
      }).catch(() => undefined);
    }
  } catch {
    failUntil = Date.now() + FAIL_COOLDOWN_MS;
    wakeN8n();
  }
}

export function trackCollect(collectData: Record<string, unknown>): void {
  // Collectes : toujours tenter (plus important que page_view)
  failUntil = 0;
  trackEvent({
    type: "collect",
    action: "price_collected",
    collect: collectData,
    market_name: collectData.market_name,
    product_name: collectData.product_name,
    agent_name: collectData.agent_name,
    agent_email: collectData.agent_email,
    ...collectData,
  });
}

export function trackPageView(path: string): void {
  const now = Date.now();
  if (path === lastPageViewPath && now - lastPageViewTime < PAGE_VIEW_THROTTLE_MS) {
    return;
  }

  lastPageViewTime = now;
  lastPageViewPath = path;

  let userEmail: string | undefined;
  try {
    const sessionStr = localStorage.getItem("sb-jvjxrknwbnsvgnobbfwa-auth-token");
    if (sessionStr) {
      const parsed = JSON.parse(sessionStr);
      userEmail = parsed?.user?.email;
    }
  } catch {
    /* ignore */
  }

  trackEvent({
    type: "traffic",
    action: "page_view",
    path,
    user_email: userEmail || "anonymous",
  });
}

export function trackLogin(userEmail: string, role?: string): void {
  failUntil = 0;
  trackEvent({
    type: "traffic",
    action: "login",
    user_email: userEmail,
    role: role || "agent",
  });
}
