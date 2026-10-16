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
    return {
      provinces: p.data as Province[],
      markets: m.data as Market[],
      categories: c.data as Category[],
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

export function useSeries(productId: string | undefined, days: number) {
  return useQuery({
    queryKey: ["series", productId, days],
    enabled: !!productId,
    staleTime: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await supabase.rpc("price_series", { _product: productId!, _since: since });
      if (error) throw error;
      return (data ?? []) as { market_id: string; day: string; price: number }[];
    },
  });
}

export const fbu = (n: number | null | undefined) =>
  n == null ? "—" : `${Math.round(n).toLocaleString("fr-FR")} FBu`;

export const pct = (a: number, b: number | null | undefined) => (b ? ((a - b) / b) * 100 : null);

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const PROVINCE_COLORS: Record<string, string> = {
  Bujumbura: "var(--chart-1)",
  Gitega: "var(--chart-2)",
  Butanyerera: "var(--chart-3)",
  Buhumuza: "var(--chart-4)",
  Burunga: "var(--chart-5)",
};
