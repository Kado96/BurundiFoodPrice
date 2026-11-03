import { supabase } from "@/integrations/supabase/client";
import { adminUploadPhoto } from "@/lib/adminApi";
import {
  registerGalleryItem,
  syncGalleryToCloud,
  type GalleryKind,
} from "@/lib/photoGallery";

export type PhotoKind = "market" | "product" | "branding" | "library";

function slugify(text: string) {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string; ext: string } {
  const matches = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
  if (!matches) throw new Error("Format image invalide");
  const contentType = matches[1];
  const bin = atob(matches[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";
  return { blob: new Blob([bytes], { type: contentType }), contentType, ext };
}

/**
 * Upload → bucket photos + inscription galerie + sync meta.
 */
export async function uploadCatalogPhoto(opts: {
  type: PhotoKind;
  name: string;
  dataUrl: string;
  register?: boolean;
}): Promise<{ url: string; path?: string; source: "api" | "storage" | "local" }> {
  const targetName = opts.name.trim() || `${opts.type}_${Date.now()}`;
  let url = "";
  let path: string | undefined;
  let source: "api" | "storage" | "local" = "local";

  // 1. Upload direct Storage d’abord (marche sans backend local / API Render froide)
  try {
    const { blob, contentType, ext } = dataUrlToBlob(opts.dataUrl);
    const slug = slugify(targetName) || opts.type;
    const folder = opts.type === "library" ? "library" : `${opts.type}s`;
    path = `catalogs/${folder}/${slug}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, blob, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    if (data?.publicUrl) {
      url = data.publicUrl;
      source = "storage";
    }
  } catch (err) {
    console.warn("[photoUpload] storage failed, try API admin:", err);
  }

  // 2. Backend admin (service role) si Storage client a échoué (RLS, etc.)
  if (!url) {
    try {
      const res = await adminUploadPhoto({
        type: opts.type,
        name: targetName,
        dataUrl: opts.dataUrl,
      });
      if (res?.url) {
        url = res.url;
        path = res.path;
        source = "api";
      }
    } catch (err) {
      console.warn("[photoUpload] API failed:", err);
    }
  }

  // 3. Fallback local
  if (!url) {
    url = opts.dataUrl;
    source = "local";
  }

  if (opts.register !== false && /^https?:\/\//i.test(url)) {
    registerGalleryItem({
      url,
      path,
      label: targetName,
      kind: (opts.type as GalleryKind) || "library",
    });
    void syncGalleryToCloud();
  }

  return { url, path, source };
}

/** Supprime un fichier du bucket photos si path connu */
export async function deleteCatalogPhotoFromBucket(path?: string): Promise<boolean> {
  if (!path || !path.startsWith("catalogs/")) return false;
  try {
    const { error } = await supabase.storage.from("photos").remove([path]);
    return !error;
  } catch {
    return false;
  }
}
