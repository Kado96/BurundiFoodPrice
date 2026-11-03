/**
 * Sélecteur galerie — point d’entrée unique pour ajouter / changer une photo
 * (marchés, produits, branding). Upload → bucket + galerie, puis sélection.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, RefreshCcw, X, Check, Images } from "lucide-react";
import { uploadCatalogPhoto } from "@/lib/photoUpload";
import {
  collectSitePhotos,
  listBucketCatalogPhotos,
  pullGalleryToLocal,
  subscribePhotoUpdates,
  type GalleryItem,
  type GalleryKind,
} from "@/lib/photoGallery";

type Props = {
  open: boolean;
  title: string;
  kind?: GalleryKind;
  currentUrl?: string;
  entityName?: string;
  onClose: () => void;
  onSelect: (url: string) => void;
  onClear?: () => void;
};

async function compressFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture fichier"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = Math.round((h * maxW) / w);
          w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/webp", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function GalleryPicker({
  open,
  title,
  kind = "library",
  currentUrl,
  entityName,
  onClose,
  onSelect,
  onClear,
}: Props) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>(currentUrl || "");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await pullGalleryToLocal();
      const local = collectSitePhotos();
      const bucket = await listBucketCatalogPhotos();
      const byUrl = new Map<string, GalleryItem>();
      for (const it of [...bucket, ...local]) {
        if (!it.url || !/^https?:\/\//i.test(it.url)) continue;
        byUrl.set(it.url, { ...(byUrl.get(it.url) || {}), ...it });
      }
      setItems(
        Array.from(byUrl.values()).sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || ""),
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected(currentUrl || "");
    void refresh();
    return subscribePhotoUpdates(() => setItems(collectSitePhotos()));
  }, [open, currentUrl, refresh]);

  const visible = useMemo(() => {
    if (kind === "library") return items;
    const preferred = items.filter((i) => i.kind === kind || i.kind === "library");
    return preferred.length ? preferred : items;
  }, [items, kind]);

  async function handleUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }
    setBusy(true);
    const toastId = toast.loading("Ajout à la galerie + bucket…");
    try {
      const dataUrl = await compressFile(file);
      const label = entityName || file.name.replace(/\.[^.]+$/, "") || `photo_${Date.now()}`;
      const uploadKind = kind === "library" ? "library" : kind;
      const res = await uploadCatalogPhoto({
        type: uploadKind === "branding" ? "branding" : uploadKind,
        name: label,
        dataUrl,
        register: true,
      });
      if (!/^https?:\/\//i.test(res.url)) {
        toast.warning("Photo locale seulement — réessaie quand le réseau revient", { id: toastId });
      } else {
        toast.success("Photo ajoutée à la galerie", { id: toastId });
        setSelected(res.url);
      }
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Échec upload galerie", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-3 backdrop-blur-xs sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Images className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-bold sm:text-base">{title}</h3>
              <p className="text-[11px] text-muted-foreground">
                Toute photo passe par la galerie (bucket photos)
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Ajouter une photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleUpload(f);
              }}
            />
          </label>
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => void refresh()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs hover:bg-secondary"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
          {onClear && (
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="ml-auto h-9 rounded-md border border-red-200 px-3 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Supprimer la photo
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading && !visible.length ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Chargement galerie…
            </div>
          ) : visible.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
              Galerie vide. Clique sur <strong>Ajouter une photo</strong>.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {visible.map((item) => {
                const active = selected === item.url;
                return (
                  <button
                    key={item.id + item.url}
                    type="button"
                    onClick={() => setSelected(item.url)}
                    className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
                      active ? "ring-2 ring-primary border-primary" : "hover:border-primary/50"
                    }`}
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={item.url}
                        alt={item.label || ""}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {active && (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-primary p-1 text-primary-foreground shadow">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <p className="truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                      {item.label || "Photo"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl border px-4 text-xs font-medium hover:bg-muted"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!selected || busy}
            onClick={() => {
              if (!selected) return;
              onSelect(selected);
              onClose();
            }}
            className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Utiliser cette photo
          </button>
        </div>
      </div>
    </div>
  );
}

/** Bouton compact : ouvre le sélecteur galerie */
export function GalleryPickButton({
  label = "Choisir dans la galerie",
  className = "",
  onClick,
}: {
  label?: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 ${className}`}
    >
      <Images className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
