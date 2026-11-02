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
 * Envoie un événement en arrière-plan sans bloquer l'interface ni lever d'exception en cas de déconnexion.
 */
export async function trackEvent(event: TelemetryEvent): Promise<void> {
  try {
    const payload = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      origin_url: typeof window !== "undefined" ? window.location.href : "",
    };

    fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Échec silencieux intentionnel : la télémétrie ne doit jamais interrompre l'expérience utilisateur
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

  // Tentative de récupération de l'utilisateur actif
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
