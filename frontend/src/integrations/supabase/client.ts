import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);

    // Stratégie de résilience réseau avancée : 4 tentatives avec backoff exponentiel
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const response = await fetch(input, { ...init, headers });
        return response;
      } catch (err: any) {
        const msg = String(err?.message || "").toLowerCase();
        const isNetworkOrConnectionError =
          msg.includes("err_connection_closed") ||
          msg.includes("err_socket_not_connected") ||
          msg.includes("err_name_not_resolved") ||
          msg.includes("failed to fetch") ||
          msg.includes("networkerror") ||
          msg.includes("aborted") ||
          msg.includes("timeout") ||
          msg.includes("econnreset");

        if (attempt < 4 && isNetworkOrConnectionError) {
          // Attente progressive (500ms, 1200ms, 2500ms) avant retry
          await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt - 1)));
          continue;
        }
        throw err;
      }
    }
    return fetch(input, { ...init, headers });
  };
}

// Configuration publique directe du projet Supabase
const DEFAULT_SUPABASE_URL = "https://jvjxrknwbnsvgnobbfwa.supabase.co";
const DEFAULT_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

function createSupabaseClient() {
  const SUPABASE_URL =
    import.meta.env.VITE_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL;

  const SUPABASE_PUBLISHABLE_KEY =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    DEFAULT_SUPABASE_KEY;

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
    },
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Client Supabase avec fallback automatique fiable
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
