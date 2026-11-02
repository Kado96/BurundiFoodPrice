/**
 * Galerie photos BFP — hub unique (admin Galerie + marchés/produits + carrousel).
 * Cloud : Storage `photos/catalogs/meta/gallery.json` (plus de hack categories.name).
 */
import { MARKET_IMAGES, getMarketPhoto as getMarketPhotoFallback } from "@/lib/images";
import { supabase } from "@/integrations/supabase/client";
import { adminSaveGalleryMeta } from "@/lib/adminApi";

export const STORAGE_MARKET = "bfp_photo_market";
export const STORAGE_PRODUCT = "bfp_photo_product";
export const STORAGE_ITEMS = "bfp_photo_gallery_items";
export const GALLERY_OBJECT_PATH = "catalogs/meta/gallery.json";

export type GalleryKind = "market" | "product" | "branding" | "library";

export type GalleryItem = {
  id: string;
  url: string;
  path?: string;
  label?: string;
  kind?: GalleryKind;
  createdAt?: string;
};

export type GalleryPayload = {
  items: GalleryItem[];
  markets: Record<string, string>;
  products: Record<string, string>;
  appBranding?: {
    logoUrl?: string | null;
    splashUrl?: string | null;
    appName?: string | null;
  };
  updatedAt?: string;
};

export function httpOnlyMap(store: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(store || {})) {
    if (typeof v === "string" && /^https?:\/\//i.test(v)) out[k] = v;
  }
  return out;
}

export function loadPhotoStore(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {};
  }
}

export function savePhotoStore(key: string, store: Record<string, string>) {
  localStorage.setItem(key, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent("bfp_photos_updated", { detail: { key } }));
}

export function loadGalleryItems(): GalleryItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_ITEMS) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveGalleryItems(items: GalleryItem[]) {
  localStorage.setItem(STORAGE_ITEMS, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("bfp_photos_updated", { detail: { key: STORAGE_ITEMS } }));
}

/** Ajoute une photo uploadée (bucket) à la bibliothèque galerie */
export function registerGalleryItem(item: Omit<GalleryItem, "id" | "createdAt"> & { id?: string }) {
  if (!item.url || !/^https?:\/\//i.test(item.url)) return loadGalleryItems();
  const items = loadGalleryItems();
  if (items.some((x) => x.url === item.url)) return items;
  const next: GalleryItem[] = [
    {
      id: item.id || `g_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      url: item.url,
      path: item.path,
      label: item.label,
      kind: item.kind || "library",
      createdAt: new Date().toISOString(),
    },
    ...items,
  ];
  saveGalleryItems(next);
  return next;
}

export function resolveMarketPhoto(marketName: string, gallery?: Record<string, string>): string {
  const store = gallery ?? (typeof window !== "undefined" ? loadPhotoStore(STORAGE_MARKET) : {});
  const custom = store[marketName];
  if (custom) return custom;
  return MARKET_IMAGES[marketName] || getMarketPhotoFallback(marketName);
}

export function resolveProductPhoto(
  productName: string,
  gallery?: Record<string, string>,
  fallback?: string,
): string {
  const store = gallery ?? (typeof window !== "undefined" ? loadPhotoStore(STORAGE_PRODUCT) : {});
  if (store[productName]) return store[productName];
  return fallback || "";
}

export function subscribePhotoUpdates(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("bfp_photos_updated", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("bfp_photos_updated", handler);
    window.removeEventListener("storage", handler);
  };
}

/** Fusionne maps + items connus (défauts Unsplash non stockés cloud) */
export function collectSitePhotos(): GalleryItem[] {
  const items = [...loadGalleryItems()];
  const seen = new Set(items.map((i) => i.url));
  const push = (url: string, label: string, kind: GalleryKind) => {
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    items.push({
      id: `auto_${kind}_${label}`,
      url,
      label,
      kind,
      createdAt: undefined,
    });
  };
  for (const [name, url] of Object.entries(loadPhotoStore(STORAGE_MARKET))) {
    push(url, name, "market");
  }
  for (const [name, url] of Object.entries(loadPhotoStore(STORAGE_PRODUCT))) {
    push(url, name, "product");
  }
  try {
    const branding = JSON.parse(localStorage.getItem("bfp_app_branding") ?? "{}");
    if (branding.logoUrl) push(branding.logoUrl, "Logo", "branding");
    if (branding.splashUrl) push(branding.splashUrl, "Splash", "branding");
  } catch {
    /* ignore */
  }
  return items;
}

export function buildGalleryPayload(extra?: {
  appBranding?: GalleryPayload["appBranding"];
}): GalleryPayload {
  let appBranding = extra?.appBranding;
  if (!appBranding) {
    try {
      const raw = localStorage.getItem("bfp_app_branding");
      if (raw) appBranding = JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  const markets = httpOnlyMap(loadPhotoStore(STORAGE_MARKET));
  const products = httpOnlyMap(loadPhotoStore(STORAGE_PRODUCT));
  // Enrichit items avec les assignations actuelles
  let items = loadGalleryItems().filter((i) => /^https?:\/\//i.test(i.url));
  const seen = new Set(items.map((i) => i.url));
  for (const [label, url] of Object.entries({ ...markets, ...products })) {
    if (!seen.has(url)) {
      seen.add(url);
      items = [
        {
          id: `map_${label}`,
          url,
          label,
          kind: markets[label] ? "market" : "product",
          createdAt: new Date().toISOString(),
        },
        ...items,
      ];
    }
  }
  return {
    items,
    markets,
    products,
    ...(appBranding ? { appBranding } : {}),
    updatedAt: new Date().toISOString(),
  };
}

function applyGalleryLocal(payload: GalleryPayload) {
  if (payload.items) saveGalleryItems(payload.items);
  if (payload.markets) {
    localStorage.setItem(STORAGE_MARKET, JSON.stringify(payload.markets));
  }
  if (payload.products) {
    localStorage.setItem(STORAGE_PRODUCT, JSON.stringify(payload.products));
  }
  if (payload.appBranding) {
    localStorage.setItem("bfp_app_branding", JSON.stringify(payload.appBranding));
    window.dispatchEvent(new Event("bfp_branding_updated"));
  }
  window.dispatchEvent(new CustomEvent("bfp_photos_updated"));
}

export async function fetchGalleryFromCloud(): Promise<GalleryPayload | null> {
  try {
    const { data } = supabase.storage.from("photos").getPublicUrl(GALLERY_OBJECT_PATH);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as GalleryPayload;
    if (!json || typeof json !== "object") return null;
    return {
      items: Array.isArray(json.items) ? json.items : [],
      markets: httpOnlyMap(json.markets || {}),
      products: httpOnlyMap(json.products || {}),
      appBranding: json.appBranding,
      updatedAt: json.updatedAt,
    };
  } catch (err) {
    console.warn("[gallery] fetch cloud failed:", err);
    return null;
  }
}

export async function pullGalleryToLocal(): Promise<boolean> {
  const remote = await fetchGalleryFromCloud();
  if (!remote) return false;
  applyGalleryLocal(remote);
  return true;
}

export async function syncGalleryToCloud(extra?: {
  appBranding?: GalleryPayload["appBranding"];
}): Promise<{ ok: boolean; source?: string }> {
  const payload = buildGalleryPayload(extra);
  const body = JSON.stringify(payload);

  try {
    const res = await adminSaveGalleryMeta(payload as unknown as Record<string, unknown>);
    if (res?.ok) {
      await cleanupLegacyCategoryHack();
      return { ok: true, source: "api" };
    }
  } catch (err) {
    console.warn("[gallery] API meta failed, try storage:", err);
  }

  try {
    const blob = new Blob([body], { type: "application/json" });
    const { error } = await supabase.storage.from("photos").upload(GALLERY_OBJECT_PATH, blob, {
      contentType: "application/json",
      upsert: true,
    });
    if (error) throw error;
    await cleanupLegacyCategoryHack();
    return { ok: true, source: "storage" };
  } catch (err) {
    console.warn("[gallery] storage meta failed:", err);
  }

  return { ok: false };
}

async function cleanupLegacyCategoryHack() {
  try {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .like("name", "__SYSTEM_PHOTOS__:%")
      .limit(5);
    if (!data?.length) return;
    for (const row of data) {
      await supabase.from("categories").delete().eq("id", row.id);
    }
  } catch (err) {
    console.warn("[gallery] legacy category cleanup:", err);
  }
}

/** Liste fichiers Storage catalogs/ (complète la galerie locale) */
export async function listBucketCatalogPhotos(): Promise<GalleryItem[]> {
  const folders = ["markets", "products", "brandings", "library"];
  const out: GalleryItem[] = [];
  for (const folder of folders) {
    try {
      const { data, error } = await supabase.storage.from("photos").list(`catalogs/${folder}`, {
        limit: 200,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error || !data) continue;
      for (const file of data) {
        if (!file.name || file.name.endsWith(".json")) continue;
        const path = `catalogs/${folder}/${file.name}`;
        const { data: pub } = supabase.storage.from("photos").getPublicUrl(path);
        out.push({
          id: `bucket_${path}`,
          url: pub.publicUrl,
          path,
          label: file.name,
          kind: folder === "markets" ? "market" : folder === "products" ? "product" : folder === "brandings" ? "branding" : "library",
          createdAt: file.created_at,
        });
      }
    } catch {
      /* ignore folder */
    }
  }
  return out;
}
