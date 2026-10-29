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

    // Stratégie de résilience réseau : 3 tentatives automatiques en cas de micro-coupure socket
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await fetch(input, { ...init, headers });
      } catch (err: any) {
        const msg = String(err?.message || "");
        const isSocketError =
          msg.includes("ERR_SOCKET_NOT_CONNECTED") ||
          msg.includes("Failed to fetch") ||
          msg.includes("NetworkError");

        if (attempt < 3 && isSocketError) {
          await new Promise((r) => setTimeout(r, 600 * attempt));
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
