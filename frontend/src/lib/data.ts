import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { pullGalleryToLocal } from "@/lib/photoGallery";

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

    // Galerie cloud (Storage gallery.json) — plus de hack categories
    try {
      await pullGalleryToLocal();
    } catch (e) {
      console.warn("[cloud-photos] gallery pull:", e);
    }

    const rawCategories = (c.data ?? []) as Category[];
    // Masque d’éventuels anciens enregistrements __SYSTEM_PHOTOS__
    const normalCategories = rawCategories.filter((cat) => !cat.name.startsWith("__SYSTEM_PHOTOS__"));

    const markets = ((m.data ?? []) as Record<string, unknown>[]).map((row) => {
      const lat = Number(row.lat ?? row.latitude);
      const lng = Number(row.lng ?? row.longitude);
      return {
        ...(row as unknown as Market),
        name: String(row.name ?? "").trim(),
        lat: Number.isFinite(lat) ? lat : NaN,
        lng: Number.isFinite(lng) ? lng : NaN,
        active: row.active !== false,
      } satisfies Market;
    });

    return {
      provinces: p.data as Province[],
      markets,
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

export const pct = (n: number | null | undefined, prev?: number | null | undefined) => {
  if (n == null) return null;
  let val = n;
  if (prev !== undefined) {
    if (!prev || !isFinite(prev)) return null;
    val = ((n - prev) / prev) * 100;
  }
  if (!isFinite(val)) return null;
  const s = val > 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`;
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
  a1: number | { lat: number; lng?: number; lon?: number },
  b1?: number | { lat: number; lng?: number; lon?: number },
  a2?: number,
  b2?: number,
) => {
  let lat1 = 0, lon1 = 0, lat2 = 0, lon2 = 0;
  if (typeof a1 === "object" && a1 !== null && typeof b1 === "object" && b1 !== null) {
    lat1 = Number(a1.lat);
    lon1 = Number(a1.lng ?? a1.lon ?? 0);
    lat2 = Number(b1.lat);
    lon2 = Number(b1.lng ?? b1.lon ?? 0);
  } else {
    lat1 = Number(a1);
    lon1 = Number(b1);
    lat2 = Number(a2);
    lon2 = Number(b2);
  }

  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return null;

  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return isFinite(dist) ? dist : null;
};

export const PROVINCE_COLORS: Record<string, string> = {
  Bujumbura: "#16a34a",
  "Bujumbura Mairie": "#16a34a",
  Gitega: "#2563eb",
  Butanyerera: "#ea580c",
  Ngozi: "#ea580c",
  Buhumuza: "#9333ea",
  Kirundo: "#9333ea",
  Burunga: "#0891b2",
  Rumonge: "#0891b2",
};
