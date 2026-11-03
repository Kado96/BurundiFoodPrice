/**
 * Burundi Food Price - Télémétrie n8n
 * Actif en prod, Vercel et APK (pas seulement en local).
 * Erreurs silencieuses : n8n down / CORB / offline ne cassent jamais l’UI.
 */

const N8N_WEBHOOK_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_N8N_WEBHOOK_URL?: string } }).env?.VITE_N8N_WEBHOOK_URL?.trim()) ||
  "https://n8n-ajs5.onrender.com/webhook/bfp-events";

const PAGE_VIEW_THROTTLE_MS = 60 * 1000;
let lastPageViewTime = 0;
let lastPageViewPath = "";

export interface TelemetryEvent {
  type: "collect" | "traffic";
  action?: string;
  timestamp?: string;
  user_agent?: string;
  [key: string]: unknown;
}

/**
 * Envoie un événement en arrière-plan partout (prod + app).
 * Opt-out uniquement via VITE_DISABLE_TELEMETRY=1.
 */
export async function trackEvent(event: TelemetryEvent): Promise<void> {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_DISABLE_TELEMETRY === "1") {
      return;
    }

    const payload = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      origin_url: typeof window !== "undefined" ? window.location.href : "",
    };

    const body = JSON.stringify(payload);
    void fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body,
      keepalive: true,
    }).catch(() => {
      /* silencieux */
    });
  } catch {
    /* silencieux */
  }
}

export function trackCollect(collectData: Record<string, unknown>): void {
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
  trackEvent({
    type: "traffic",
    action: "login",
    user_email: userEmail,
    role: role || "agent",
  });
}
