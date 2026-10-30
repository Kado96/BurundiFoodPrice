import { supabase } from "@/integrations/supabase/client";

/** URL API Render. Vide en local = proxy Vite /api → :4000 */
function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "";
  return raw.replace(/\/$/, "");
}

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Session expirée, reconnectez-vous");
  return token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = apiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${await bearer()}`,
      ...(init.headers || {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Erreur ${res.status}`);
  return json as T;
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
  type: "market" | "product";
  name: string;
  dataUrl: string;
}) {
  return api<{ ok: true; url: string; path: string }>("/api/admin/upload-photo", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
