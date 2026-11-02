import { supabase } from "@/integrations/supabase/client";

const PROD_API = "https://burundi-food-price-api.onrender.com";
const RETRYABLE = new Set([502, 503, 504]);
const MAX_ATTEMPTS = 3;

/** URL API Render. En local = proxy Vite /api → :4000 ; En prod Vercel/Android = Render API */
function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (raw) return raw.replace(/\/$/, "");

  if (typeof window !== "undefined") {
    // Capacitor Android/iOS : pas de proxy Vite, toujours l'API HTTPS de prod
    const isNative = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.();
    if (isNative) return PROD_API;

    // Vercel sans VITE_API_URL
    if (window.location.hostname.includes("vercel.app")) return PROD_API;
  }
  return "";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function friendlyHttpError(status: number, serverMsg?: string): string {
  if (serverMsg && status !== 502 && status !== 503 && status !== 504) return serverMsg;
  if (status === 502 || status === 503 || status === 504) {
    return "API admin indisponible (redémarrage Render ou backend local arrêté). Réessayez dans quelques secondes.";
  }
  if (status === 401) return "Session expirée, reconnectez-vous";
  if (status === 403) return "Réservé aux administrateurs";
  return serverMsg || `Erreur ${status}`;
}

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée, reconnectez-vous");
  return token;
}

/** Réveille l'API avant une action admin (cold start Render / check local). */
export async function warmAdminApi(): Promise<boolean> {
  const base = apiBase();
  const healthUrl = base ? `${base}/health` : "/health";
  try {
    const res = await fetch(healthUrl, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = apiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const token = await bearer();

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      if (attempt === 1) {
        await warmAdminApi();
      }
      const res = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.headers || {}),
        },
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        field?: string | null;
      };
      if (!res.ok) {
        const detail = json.field ? `${json.error || "Erreur"} (${json.field})` : json.error;
        const msg = friendlyHttpError(res.status, detail);
        if (RETRYABLE.has(res.status) && attempt < MAX_ATTEMPTS) {
          await sleep(1500 * attempt);
          continue;
        }
        console.error("[adminApi]", res.status, path, json);
        throw new Error(msg);
      }
      return json as T;
    } catch (err) {
      const e = err as Error;
      lastErr = e;
      const isNetwork =
        e.name === "TypeError" ||
        /failed to fetch|networkerror|load failed|econnrefused/i.test(e.message);
      if (isNetwork && attempt < MAX_ATTEMPTS) {
        await sleep(1500 * attempt);
        continue;
      }
      if (isNetwork) {
        throw new Error(
          "Impossible de joindre l'API admin. En local: lancez `npm run dev` à la racine (frontend + backend). En prod: l'API Render redémarre, réessayez.",
        );
      }
      throw e;
    }
  }
  throw lastErr || new Error("Erreur API");
}

export async function adminCreateUser(body: {
  full_name: string;
  email: string;
  phone?: string | null;
  password: string;
  role: "agent" | "supervisor" | "admin";
  market_ids: string[];
}) {
  return api<{ ok: true; id: string; email: string }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminResetPassword(id: string, password: string) {
  return api<{ ok: true }>(`/api/admin/users/${id}/password`, {
    method: "POST",
    body: JSON.stringify({ password }),
  });
}

export async function adminSetSuspended(id: string, suspended: boolean) {
  return api<{ ok: true }>(`/api/admin/users/${id}/suspend`, {
    method: "POST",
    body: JSON.stringify({ suspended }),
  });
}

export async function adminDeleteUser(id: string) {
  return api<{ ok: true }>(`/api/admin/users/${id}`, {
    method: "DELETE",
  });
}

export async function adminListUserStatus() {
  return api<{ id: string; last_sign_in_at: string | null; suspended: boolean }[]>(
    "/api/admin/users/status",
    { method: "GET" },
  );
}

export async function adminDeleteObservations(body: {
  mode: "single" | "batch" | "all";
  id?: string;
  agent_id?: string;
  market_id?: string;
  product_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
}) {
  return api<{ ok: true }>("/api/admin/observations/delete", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function adminUploadPhoto(body: {
  type: "market" | "product" | "branding";
  name: string;
  dataUrl: string;
}) {
  return api<{ ok: true; url: string; path: string }>("/api/admin/upload-photo", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
