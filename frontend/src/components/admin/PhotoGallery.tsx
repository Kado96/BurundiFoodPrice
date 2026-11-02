/**
 * Galerie admin — répertoire de toutes les photos du site.
 * Ajout / modification / suppression → bucket photos + meta gallery.json
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ImagePlus,
  Loader2,
  Pencil,
  RefreshCcw,
  Trash2,
  Upload,
  X,
  Link2,
} from "lucide-react";
import { useRef } from "@/lib/data";
import { uploadCatalogPhoto, deleteCatalogPhotoFromBucket } from "@/lib/photoUpload";
import {
  collectSitePhotos,
  listBucketCatalogPhotos,
  loadGalleryItems,
  loadPhotoStore,
  pullGalleryToLocal,
  registerGalleryItem,
  saveGalleryItems,
  savePhotoStore,
  STORAGE_MARKET,
  STORAGE_PRODUCT,
  subscribePhotoUpdates,
  syncGalleryToCloud,
  type GalleryItem,
  type GalleryKind,
} from "@/lib/photoGallery";

const KIND_LABEL: Record<GalleryKind, string> = {
  market: "Marché",
  product: "Produit",
  branding: "Branding",
  library: "Galerie",
};

function compressFile(file: File): Promise<string> {
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

export function PhotoGallery() {
  const ref = useRef();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editKind, setEditKind] = useState<GalleryKind>("library");
  const [assignMarket, setAssignMarket] = useState("");
  const [assignProduct, setAssignProduct] = useState("");
  const [filter, setFilter] = useState<"all" | GalleryKind>("all");

  const markets = ref.data?.markets ?? [];
  const products = ref.data?.products ?? [];

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await pullGalleryToLocal();
      const local = collectSitePhotos();
      const bucket = await listBucketCatalogPhotos();
      const byUrl = new Map<string, GalleryItem>();
      for (const it of [...bucket, ...local]) {
        if (!it.url) continue;
        const prev = byUrl.get(it.url);
        byUrl.set(it.url, prev ? { ...prev, ...it, id: prev.id || it.id } : it);
      }
      const merged = Array.from(byUrl.values()).sort((a, b) =>
        (b.createdAt || "").localeCompare(a.createdAt || ""),
      );
      setItems(merged);
      saveGalleryItems(
        merged.filter((i) => /^https?:\/\//i.test(i.url) && !i.id.startsWith("auto_")),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    return subscribePhotoUpdates(() => setItems(collectSitePhotos()));
  }, [refresh]);

  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((i) => (i.kind || "library") === filter)),
    [items, filter],
  );

  async function handleAdd(file: File) {
    setBusy(true);
    const toastId = toast.loading("Ajout à la galerie…");
    try {
      const dataUrl = await compressFile(file);
      const label = file.name.replace(/\.[^.]+$/, "") || `photo_${Date.now()}`;
      const res = await uploadCatalogPhoto({
        type: "library",
        name: label,
        dataUrl,
        register: true,
      });
      if (res.source === "local") {
        toast.warning("Photo en local seulement (bucket indisponible)", { id: toastId });
      } else {
        toast.success("Photo ajoutée à la galerie + bucket", { id: toastId });
      }
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Échec ajout photo", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  function openEdit(item: GalleryItem) {
    setEditing(item);
    setEditLabel(item.label || "");
    setEditKind(item.kind || "library");
    const marketsMap = loadPhotoStore(STORAGE_MARKET);
    const productsMap = loadPhotoStore(STORAGE_PRODUCT);
    setAssignMarket(Object.entries(marketsMap).find(([, u]) => u === item.url)?.[0] || "");
    setAssignProduct(Object.entries(productsMap).find(([, u]) => u === item.url)?.[0] || "");
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    const toastId = toast.loading("Enregistrement…");
    try {
      const itemsNow = loadGalleryItems();
      const next = itemsNow.map((it) =>
        it.id === editing.id || it.url === editing.url
          ? { ...it, label: editLabel.trim() || it.label, kind: editKind }
          : it,
      );
      if (!next.some((it) => it.url === editing.url)) {
        next.unshift({
          ...editing,
          label: editLabel.trim() || editing.label,
          kind: editKind,
        });
      }
      saveGalleryItems(next);

      // Assignations marché / produit
      const mStore = { ...loadPhotoStore(STORAGE_MARKET) };
      const pStore = { ...loadPhotoStore(STORAGE_PRODUCT) };
      for (const [k, v] of Object.entries(mStore)) {
        if (v === editing.url) delete mStore[k];
      }
      for (const [k, v] of Object.entries(pStore)) {
        if (v === editing.url) delete pStore[k];
      }
      if (assignMarket) mStore[assignMarket] = editing.url;
      if (assignProduct) pStore[assignProduct] = editing.url;
      savePhotoStore(STORAGE_MARKET, mStore);
      savePhotoStore(STORAGE_PRODUCT, pStore);

      const sync = await syncGalleryToCloud();
      toast.success(sync.ok ? "Photo modifiée" : "Modifié en local (sync cloud échouée)", {
        id: toastId,
      });
      setEditing(null);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Échec modification", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function replacePhoto(file: File) {
    if (!editing) return;
    setBusy(true);
    const toastId = toast.loading("Remplacement de la photo…");
    try {
      const dataUrl = await compressFile(file);
      const res = await uploadCatalogPhoto({
        type: editKind === "library" ? "library" : editKind,
        name: editLabel || editing.label || "photo",
        dataUrl,
        register: false,
      });
      const oldUrl = editing.url;
      const oldPath = editing.path;

      // Remplace URL partout
      const itemsNow = loadGalleryItems().map((it) =>
        it.url === oldUrl
          ? {
              ...it,
              url: res.url,
              path: res.path || it.path,
              label: editLabel || it.label,
              kind: editKind,
            }
          : it,
      );
      if (!itemsNow.some((it) => it.url === res.url)) {
        registerGalleryItem({
          url: res.url,
          path: res.path,
          label: editLabel || editing.label,
          kind: editKind,
        });
      } else {
        saveGalleryItems(itemsNow);
      }

      const mStore = loadPhotoStore(STORAGE_MARKET);
      const pStore = loadPhotoStore(STORAGE_PRODUCT);
      for (const k of Object.keys(mStore)) {
        if (mStore[k] === oldUrl) mStore[k] = res.url;
      }
      for (const k of Object.keys(pStore)) {
        if (pStore[k] === oldUrl) pStore[k] = res.url;
      }
      if (assignMarket) mStore[assignMarket] = res.url;
      if (assignProduct) pStore[assignProduct] = res.url;
      savePhotoStore(STORAGE_MARKET, mStore);
      savePhotoStore(STORAGE_PRODUCT, pStore);

      if (oldPath && oldPath !== res.path) await deleteCatalogPhotoFromBucket(oldPath);
      await syncGalleryToCloud();

      toast.success("Photo remplacée (galerie + bucket)", { id: toastId });
      setEditing({ ...editing, url: res.url, path: res.path, label: editLabel, kind: editKind });
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Échec remplacement", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(item: GalleryItem) {
    if (!confirm(`Supprimer « ${item.label || "cette photo"} » de la galerie ?`)) return;
    setBusy(true);
    const toastId = toast.loading("Suppression…");
    try {
      const next = loadGalleryItems().filter((it) => it.url !== item.url && it.id !== item.id);
      saveGalleryItems(next);

      const mStore = loadPhotoStore(STORAGE_MARKET);
      const pStore = loadPhotoStore(STORAGE_PRODUCT);
      let changed = false;
      for (const k of Object.keys(mStore)) {
        if (mStore[k] === item.url) {
          delete mStore[k];
          changed = true;
        }
      }
      for (const k of Object.keys(pStore)) {
        if (pStore[k] === item.url) {
          delete pStore[k];
          changed = true;
        }
      }
      if (changed) {
        savePhotoStore(STORAGE_MARKET, mStore);
        savePhotoStore(STORAGE_PRODUCT, pStore);
      }

      if (item.path) await deleteCatalogPhotoFromBucket(item.path);
      await syncGalleryToCloud();
      toast.success("Photo supprimée", { id: toastId });
      if (editing?.id === item.id) setEditing(null);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Échec suppression", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Galerie photos</h2>
          <p className="text-sm text-muted-foreground">
            Toutes les photos du site (marchés, produits, branding). Upload → bucket{" "}
            <code className="text-xs">photos</code> + galerie.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">Toutes ({items.length})</option>
            <option value="market">Marchés</option>
            <option value="product">Produits</option>
            <option value="branding">Branding</option>
            <option value="library">Galerie libre</option>
          </select>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void refresh()}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-secondary"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Actualiser
          </button>
          <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
            Ajouter
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void handleAdd(f);
              }}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Chargement de la galerie…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          Aucune photo. Clique sur <strong>Ajouter</strong> pour uploader vers le bucket.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((item) => (
            <div
              key={item.id + item.url}
              className="group relative overflow-hidden rounded-lg border bg-card shadow-sm"
            >
              <div className="aspect-square bg-muted">
                <img
                  src={item.url}
                  alt={item.label || "photo"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = "0.25";
                  }}
                />
              </div>
              <div className="space-y-0.5 p-2">
                <p className="truncate text-xs font-medium">{item.label || "Sans nom"}</p>
                <p className="text-[10px] text-muted-foreground">
                  {KIND_LABEL[item.kind || "library"]}
                </p>
              </div>
              <div className="absolute right-1 top-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <button
                  type="button"
                  title="Modifier"
                  disabled={busy}
                  onClick={() => openEdit(item)}
                  className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Supprimer"
                  disabled={busy}
                  onClick={() => void deleteItem(item)}
                  className="rounded-md bg-red-600/90 p-1.5 text-white hover:bg-red-700"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">Modifier la photo</h3>
              <button type="button" onClick={() => setEditing(null)} className="rounded p-1 hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>
            <img
              src={editing.url}
              alt={editing.label || ""}
              className="mb-3 max-h-48 w-full rounded-lg object-cover"
            />
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Libellé</label>
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Type</label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={editKind}
                  onChange={(e) => setEditKind(e.target.value as GalleryKind)}
                >
                  <option value="library">Galerie libre</option>
                  <option value="market">Marché</option>
                  <option value="product">Produit</option>
                  <option value="branding">Branding</option>
                </select>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium">
                  <Link2 className="h-3 w-3" /> Assigner à un marché
                </label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={assignMarket}
                  onChange={(e) => setAssignMarket(e.target.value)}
                >
                  <option value="">— Aucun —</option>
                  {markets.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1 text-xs font-medium">
                  <Link2 className="h-3 w-3" /> Assigner à un produit
                </label>
                <select
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  value={assignProduct}
                  onChange={(e) => setAssignProduct(e.target.value)}
                >
                  <option value="">— Aucun —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-secondary">
                <Upload className="h-4 w-4" />
                Remplacer le fichier
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void replacePhoto(f);
                  }}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="h-10 rounded-md border px-4 text-sm"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveEdit()}
                  className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
