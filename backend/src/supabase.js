import { createClient } from "@supabase/supabase-js";

function isNewKey(value) {
  return typeof value === "string" && (value.startsWith("sb_publishable_") || value.startsWith("sb_secret_"));
}

function makeFetch(key) {
  return (input, init) => {
    const headers = new Headers(init?.headers);
    if (isNewKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
}

export function createUserClient(accessToken) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_ANON_KEY manquants");
  return createClient(url, key, {
    global: {
      fetch: makeFetch(key),
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants");
  return createClient(url, key, {
    global: { fetch: makeFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
