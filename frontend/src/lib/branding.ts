import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppBranding = {
  logoUrl?: string | null;
  splashUrl?: string | null;
  appName?: string | null;
};

export const BRANDING_STORAGE_KEY = "bfp_app_branding";

export const DEFAULT_BRANDING: AppBranding = {
  logoUrl: "/logo-icon.png",
  splashUrl: "/splash.png",
  appName: "Burundi Food Price",
};

export function loadBranding(): AppBranding {
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return DEFAULT_BRANDING;
    return { ...DEFAULT_BRANDING, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export function saveBrandingLocal(branding: AppBranding) {
  try {
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
    window.dispatchEvent(new Event("bfp_branding_updated"));
  } catch (e) {
    console.warn("[branding] local storage save error:", e);
  }
}

export async function syncBrandingToSupabase(branding: AppBranding) {
  // Sauvegarde locale immédiate
  saveBrandingLocal(branding);

  try {
    // Récupérer les photos existantes pour ne pas écraser les marchés et produits
    let markets = {};
    let products = {};
    try {
      markets = JSON.parse(localStorage.getItem("bfp_photo_market") ?? "{}");
      products = JSON.parse(localStorage.getItem("bfp_photo_product") ?? "{}");
    } catch {
      // ignore
    }

    // Récupérer l'enregistrement existant dans Supabase
    const { data: existing } = await supabase
      .from("categories")
      .select("id, name")
      .like("name", "__SYSTEM_PHOTOS__:%")
      .limit(1);

    if (existing && existing.length > 0) {
      try {
        const raw = existing[0].name.replace("__SYSTEM_PHOTOS__:", "");
        const decoded = JSON.parse(decodeURIComponent(escape(atob(raw))));
        if (decoded.markets) markets = decoded.markets;
        if (decoded.products) products = decoded.products;
      } catch (err) {
        console.warn("[branding] failed to decode existing remote config:", err);
      }
    }

    const payload = {
      markets,
      products,
      appBranding: branding,
    };

    const jsonStr = JSON.stringify(payload);
    const encoded = "__SYSTEM_PHOTOS__:" + btoa(unescape(encodeURIComponent(jsonStr)));

    if (existing && existing.length > 0) {
      const { error } = await supabase
        .from("categories")
        .update({ name: encoded, sort: 999 })
        .eq("id", existing[0].id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("categories")
        .insert({ name: encoded, sort: 999 });
      if (error) throw error;
    }
  } catch (err) {
    console.error("[branding] error syncing to Supabase:", err);
    throw err;
  }
}

export function useAppBranding() {
  const [branding, setBrandingState] = useState<AppBranding>(() => loadBranding());

  useEffect(() => {
    const handleUpdate = () => {
      setBrandingState(loadBranding());
    };
    window.addEventListener("bfp_branding_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("bfp_branding_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  const setBranding = (next: AppBranding) => {
    setBrandingState(next);
    saveBrandingLocal(next);
  };

  return {
    branding,
    setBranding,
    syncToCloud: syncBrandingToSupabase,
  };
}
