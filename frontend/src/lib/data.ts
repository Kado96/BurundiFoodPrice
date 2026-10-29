import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Province = { id: string; name: string };
export type Market = {
  id: string; name: string; province_id: string; commune: string | null;
  lat: number; lng: number; market_days: string | null; active: boolean;
};
export type Category = { id: string; name: string; sort: number | null };
export type Product = { id: string; name: string; category_id: string; default_unit: string; active: boolean };
export type LatestPrice = {
  market_id: string; product_id: string; unit_price: number; unit: string;
  availability: string; observed_at: string; prev_price: number | null;
};

const q = <T,>(key: string[], fn: () => Promise<T>) =>
  useQuery({ queryKey: key, queryFn: fn, staleTime: 60_000 });

export function useRef() {
  return q(["ref"], async () => {
    const [p, m, c, pr] = await Promise.all([
      supabase.from("provinces").select("*").order("name"),
      supabase.from("markets").select("*").order("name"),
      supabase.from("categories").select("*").order("sort"),
      supabase.from("products").select("*").order("name"),
    ]);
    const err = p.error || m.error || c.error || pr.error;
    if (err) throw err;

    // Isoler et synchroniser la config cloud des photos globales
    const rawCategories = (c.data ?? []) as Category[];
    const photoConfigCat = rawCategories.find((cat) => cat.name.startsWith("__SYSTEM_PHOTOS__:"));
    if (photoConfigCat) {
      try {
        const raw = photoConfigCat.name.replace("__SYSTEM_PHOTOS__:", "");
        const decoded = JSON.parse(atob(raw));
        if (decoded.markets) {
          localStorage.setItem("bfp_photo_market", JSON.stringify(decoded.markets));
        }
        if (decoded.products) {
          localStorage.setItem("bfp_photo_product", JSON.stringify(decoded.products));
        }
      } catch (e) {
        console.warn("[cloud-photos] error decoding remote config:", e);
      }
    }

    // Filtrer la catégorie système spéciale pour ne pas polluer les sélecteurs UI
    const normalCategories = rawCategories.filter((cat) => !cat.name.startsWith("__SYSTEM_PHOTOS__"));

    return {
      provinces: p.data as Province[],
      markets: m.data as Market[],
      categories: normalCategories,
      products: pr.data as Product[],
    };
  });
}

export function useLatest() {
  return q(["latest"], async () => {
    const { data, error } = await supabase.rpc("latest_prices");
    if (error) throw error;
    return (data ?? []) as LatestPrice[];
  });
}

export function useSeries(productId?: string, days = 90) {
  return q(["series", productId ?? "", String(days)], async () => {
    if (!productId) return [];
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const { data, error } = await supabase.rpc("price_series", {
      _product: productId,
      _since: since,
    });
    if (error) throw error;
    return (data ?? []) as { market_id: string; day: string; price: number }[];
  });
}

export const fbu = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("fr-FR")} FBu`;

export const pct = (n: number | null | undefined) => {
  if (n == null || !isFinite(n)) return null;
  const s = n > 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`;
  return s;
};

export const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
};

export const distanceM = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const PROVINCE_COLORS: Record<string, string> = {
  "Bujumbura Mairie": "#16a34a",
  Gitega: "#2563eb",
  Ngozi: "#ea580c",
  Rumonge: "#0891b2",
  Kirundo: "#9333ea",
};
