import { useState, useEffect } from "react";
import { registerGalleryItem, syncGalleryToCloud } from "@/lib/photoGallery";

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
  saveBrandingLocal(branding);
  if (branding.logoUrl && /^https?:\/\//i.test(branding.logoUrl)) {
    registerGalleryItem({ url: branding.logoUrl, label: "Logo", kind: "branding" });
  }
  if (branding.splashUrl && /^https?:\/\//i.test(branding.splashUrl)) {
    registerGalleryItem({ url: branding.splashUrl, label: "Splash", kind: "branding" });
  }
  const res = await syncGalleryToCloud({ appBranding: branding });
  if (!res.ok) {
    throw new Error("Sync galerie branding échouée");
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
