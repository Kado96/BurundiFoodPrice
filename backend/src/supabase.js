import { createClient } from "@supabase/supabase-js";

function isNewKey(value) {
  return typeof value === "string" && (value.startsWith("sb_publishable_") || value.startsWith("sb_secret_"));
}

function makeFetch(key) {
  const anonJwt = process.env.SUPABASE_ANON_KEY;
  return (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", key);
    // Storage OpenAPI exige un Bearer JWT. sb_secret_ n'est pas un JWT →
    // on met l'anon JWT en Authorization et le secret en apikey (privilèges).
    if (isNewKey(key)) {
      const auth = headers.get("Authorization");
      if (!auth || auth === `Bearer ${key}`) {
        if (anonJwt) headers.set("Authorization", `Bearer ${anonJwt}`);
        else headers.delete("Authorization");
      }
    }
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
