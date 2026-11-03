/**
 * Burundi Food Price - Module de télémétrie & monitoring n8n
 * Envoie des signaux en temps réel vers le webhook n8n de manière asynchrone et résiliente.
 */

const N8N_WEBHOOK_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_N8N_WEBHOOK_URL?: string } }).env?.VITE_N8N_WEBHOOK_URL?.trim()) ||
  "https://n8n-ajs5.onrender.com/webhook/bfp-events";

// Durée minimale entre deux événements de page vue pour la même route (60 secondes)
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
 * Envoie un événement en arrière-plan sans bloquer l'interface ni lever d'exception.
 * Évite sendBeacon : Chrome logge souvent CORB sur la réponse JSON du webhook.
 */
export async function trackEvent(event: TelemetryEvent): Promise<void> {
  try {
    const payload = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      origin_url: typeof window !== "undefined" ? window.location.href : "",
    };

    const body = JSON.stringify(payload);
    // no-cors + text/plain : pas de preflight, réponse opaque (pas de bruit CORB lisible)
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
    // Catch global silencieux
  }
}

/**
 * Envoie les données d'une observation de prix synchronisée avec succès.
 */
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

/**
 * Envoie une trace de visite de page (avec étranglement à 1 appel max par minute par route).
 */
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
    // Ignorer
  }

  trackEvent({
    type: "traffic",
    action: "page_view",
    path,
    user_email: userEmail || "anonymous",
  });
}

/**
 * Envoie une trace lors d'une connexion utilisateur réussie.
 */
export function trackLogin(userEmail: string, role?: string): void {
  trackEvent({
    type: "traffic",
    action: "login",
    user_email: userEmail,
    role: role || "agent",
  });
}
