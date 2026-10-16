import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}

function client() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const uuid = z.string().uuid();
const obsQuery = z.object({
  market_id: uuid.optional(),
  product_id: uuid.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export const Route = createFileRoute("/api/public/v1/$")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request, params }) => {
        const sb = client();
        const path = (params._splat ?? "").replace(/\/$/, "");
        const q = Object.fromEntries(new URL(request.url).searchParams);
        try {
          switch (path) {
            case "":
              return json({
                name: "Burundi Food Price API", version: "v1", currency: "BIF",
                endpoints: ["/provinces", "/markets", "/categories", "/products", "/prices/latest", "/prices/history?product_id=&days=", "/observations?market_id=&product_id=&from=&to=&limit=&offset=", "/stats"],
              });
            case "provinces": {
              const { data, error } = await sb.from("provinces").select("*").order("name");
              if (error) throw error; return json({ data });
            }
            case "markets": {
              const { data, error } = await sb.from("markets").select("*").order("name");
              if (error) throw error; return json({ data });
            }
            case "categories": {
              const { data, error } = await sb.from("categories").select("*");
              if (error) throw error; return json({ data });
            }
            case "products": {
              const { data, error } = await sb.from("products").select("*").order("name");
              if (error) throw error; return json({ data });
            }
            case "prices/latest": {
              const { data, error } = await sb.rpc("latest_prices");
              if (error) throw error; return json({ data });
            }
            case "prices/history": {
              const p = z.object({ product_id: uuid, days: z.coerce.number().int().min(1).max(730).default(90) }).safeParse(q);
              if (!p.success) return json({ error: "product_id (uuid) requis, days 1-730" }, 400);
              const since = new Date(Date.now() - p.data.days * 86400_000).toISOString();
              const { data, error } = await sb.rpc("price_series", { _product: p.data.product_id, _since: since });
              if (error) throw error; return json({ data });
            }
            case "observations": {
              const p = obsQuery.safeParse(q);
              if (!p.success) return json({ error: "Paramètres invalides", details: p.error.flatten() }, 400);
              const f = p.data;
              let r = sb.from("observations")
                .select("id, market_id, product_id, observed_at, price, quantity, unit, availability, variety, quality, origin", { count: "exact" })
                .eq("status", "VALIDEE").order("observed_at", { ascending: false })
                .range(f.offset, f.offset + f.limit - 1);
              if (f.market_id) r = r.eq("market_id", f.market_id);
              if (f.product_id) r = r.eq("product_id", f.product_id);
              if (f.from) r = r.gte("observed_at", f.from);
              if (f.to) r = r.lte("observed_at", f.to + "T23:59:59Z");
              const { data, error, count } = await r;
              if (error) throw error; return json({ total: count, limit: f.limit, offset: f.offset, data });
            }
            case "stats": {
              const [m, pr, o] = await Promise.all([
                sb.from("markets").select("id", { count: "exact", head: true }),
                sb.from("products").select("id", { count: "exact", head: true }),
                sb.from("observations").select("id", { count: "exact", head: true }).eq("status", "VALIDEE"),
              ]);
              return json({ markets: m.count, products: pr.count, validated_observations: o.count });
            }
            default:
              return json({ error: "Ressource inconnue" }, 404);
          }
        } catch (e) {
          console.error(e);
          return json({ error: "Erreur serveur" }, 500);
        }
      },
    },
  },
});
