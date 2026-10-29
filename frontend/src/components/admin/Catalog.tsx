/**
 * Catalog.tsx — Administration des Marchés et Produits
 * Fonctionnalités :
 *   - Tableau avec photos pour chaque marché / produit
 *   - Modification de l'URL photo directement dans le formulaire d'édition
 *   - Prévisualisation en temps réel de la photo
 *   - Stockage des photos personnalisées dans localStorage (clé: bfp_photo_market / bfp_photo_product)
 *   - Fallback automatique sur images.ts si aucune photo personnalisée
 */

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Image, RefreshCcw, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRef, type Market, type Product } from "@/lib/data";
import {
  PRODUCT_IMAGES,
  MARKET_IMAGES,
  getMarketPhoto,
  getProductFallback,
} from "@/lib/images";

const input = "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30";

// ─── Utilitaires localStorage & Cloud Supabase photos ───────────────────────

const STORAGE_MARKET = "bfp_photo_market";
const STORAGE_PRODUCT = "bfp_photo_product";

function loadPhotoStore(key: string): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return {}; }
}
function savePhotoStore(key: string, store: Record<string, string>) {
  localStorage.setItem(key, JSON.stringify(store));
}

// Synchronise de manière transparente et persistante vers Supabase cloud
async function syncPhotosToSupabaseCloud() {
  try {
    const markets = loadPhotoStore(STORAGE_MARKET);
    const products = loadPhotoStore(STORAGE_PRODUCT);
    const payload = { markets, products };
    const jsonStr = JSON.stringify(payload);
    const encoded = "__SYSTEM_PHOTOS__:" + btoa(unescape(encodeURIComponent(jsonStr)));

    // Rechercher l'enregistrement existant
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .like("name", "__SYSTEM_PHOTOS__:%")
      .limit(1);

    if (existing && existing.length > 0) {
      await supabase
        .from("categories")
        .update({ name: encoded, sort: 999 })
        .eq("id", existing[0].id);
    } else {
      await supabase
        .from("categories")
        .insert({ name: encoded, sort: 999 });
    }
  } catch (err) {
    console.warn("[cloud-sync] error uploading photos metadata to Supabase:", err);
  }
}

export function useMarketPhotos() {
  const [store, setStore] = useState<Record<string, string>>(() => loadPhotoStore(STORAGE_MARKET));
  function setPhoto(name: string, url: string) {
    const next = { ...store, [name]: url };
    setStore(next);
    savePhotoStore(STORAGE_MARKET, next);
    syncPhotosToSupabaseCloud();
  }
  function resetPhoto(name: string) {
    const next = { ...store };
    delete next[name];
    setStore(next);
    savePhotoStore(STORAGE_MARKET, next);
    syncPhotosToSupabaseCloud();
  }
  function getPhoto(name: string) {
    return store[name] || MARKET_IMAGES[name] || getMarketPhoto(name);
  }
  return { store, setPhoto, resetPhoto, getPhoto };
}

export function useProductPhotos() {
  const [store, setStore] = useState<Record<string, string>>(() => loadPhotoStore(STORAGE_PRODUCT));
  function setPhoto(name: string, url: string) {
    const next = { ...store, [name]: url };
    setStore(next);
    savePhotoStore(STORAGE_PRODUCT, next);
    syncPhotosToSupabaseCloud();
  }
  function resetPhoto(name: string) {
    const next = { ...store };
    delete next[name];
    setStore(next);
    savePhotoStore(STORAGE_PRODUCT, next);
    syncPhotosToSupabaseCloud();
  }
  function getPhoto(name: string) {
    return store[name] || PRODUCT_IMAGES[name] || getProductFallback(name);
  }
  return { store, setPhoto, resetPhoto, getPhoto };
}

// ─── Composant de prévisualisation photo ───────────────────────────────────

function PhotoPreview({ url, alt, className = "" }: { url: string; alt: string; className?: string }) {
  const [ok, setOk] = useState(true);
  useEffect(() => { setOk(true); }, [url]);
  return (
    <div className={`overflow-hidden rounded-xl border bg-muted/30 ${className}`}>
      {ok && url ? (
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setOk(false)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Image className="h-8 w-8 opacity-40" />
        </div>
      )}
    </div>
  );
}

// ─── Badge statut ──────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
      <CheckCircle className="h-3 w-3" /> Actif
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
      <XCircle className="h-3 w-3" /> Inactif
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  MARCHÉS
// ═══════════════════════════════════════════════════════════════════════════

export function Markets() {
  const ref = useRef();
  const qc = useQueryClient();
  const { getPhoto, setPhoto, resetPhoto } = useMarketPhotos();
  const [edit, setEdit] = useState<Partial<Market> | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState("");
  const d = ref.data;
  const prov = Object.fromEntries((d?.provinces ?? []).map((p) => [p.id, p.name]));

  function openEdit(m: Partial<Market>) {
    setEdit(m);
    setPhotoUrl(m.name ? getPhoto(m.name) : "");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const row = {
      name: edit.name!,
      province_id: edit.province_id!,
      commune: edit.commune || null,
      lat: Number(edit.lat),
      lng: Number(edit.lng),
      market_days: edit.market_days || null,
      active: edit.active ?? true,
    };
    if (!row.name || !row.province_id || isNaN(row.lat) || isNaN(row.lng)) {
      toast.error("Nom, province et coordonnées GPS sont obligatoires");
      return;
    }
    const { error } = edit.id
      ? await supabase.from("markets").update(row).eq("id", edit.id)
      : await supabase.from("markets").insert(row);
    if (error) { toast.error("Échec de l'enregistrement"); return; }

    // Sauvegarder la photo personnalisée
    if (photoUrl && edit.name) setPhoto(edit.name, photoUrl);
    else if (!photoUrl && edit.name) resetPhoto(edit.name);

    toast.success("Marché enregistré ✅");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["ref"] });
  }

  return (
    <div className="space-y-6">
      {/* Bouton nouveau marché */}
      <div className="flex justify-end">
        <button
          onClick={() => openEdit({ active: true, province_id: d?.provinces[0]?.id ?? "" })}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nouveau marché
        </button>
      </div>

      {/* Formulaire d'édition */}
      {edit && (
        <form onSubmit={save} className="rounded-2xl border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            {edit.id ? `Modifier : ${edit.name}` : "Nouveau marché"}
          </h3>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="text-sm font-medium">
              Nom du marché
              <input className={`mt-1 ${input}`} value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Ex: Marché de Gitega" />
            </label>
            <label className="text-sm font-medium">
              Province
              <select className={`mt-1 ${input}`} value={edit.province_id ?? ""} onChange={(e) => setEdit({ ...edit, province_id: e.target.value })}>
                {d?.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Commune
              <input className={`mt-1 ${input}`} value={edit.commune ?? ""} onChange={(e) => setEdit({ ...edit, commune: e.target.value })} />
            </label>
            <label className="text-sm font-medium">
              Latitude
              <input className={`mt-1 ${input}`} value={edit.lat ?? ""} onChange={(e) => setEdit({ ...edit, lat: e.target.value as any })} placeholder="-3.38" />
            </label>
            <label className="text-sm font-medium">
              Longitude
              <input className={`mt-1 ${input}`} value={edit.lng ?? ""} onChange={(e) => setEdit({ ...edit, lng: e.target.value as any })} placeholder="29.36" />
            </label>
            <label className="text-sm font-medium">
              Jours de marché
              <input className={`mt-1 ${input}`} value={edit.market_days ?? ""} onChange={(e) => setEdit({ ...edit, market_days: e.target.value })} placeholder="Lundi, Jeudi" />
            </label>

            {/* ─── Champ URL Photo ─── */}
            <label className="text-sm font-medium md:col-span-2">
              <span className="flex items-center gap-1.5 mb-1">
                <Image className="h-3.5 w-3.5 text-primary" />
                URL de la photo (Unsplash, HTTP...)
              </span>
              <input
                className={`mt-1 ${input} font-mono text-xs`}
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
              />
              {MARKET_IMAGES[edit.name ?? ""] && (
                <button type="button" onClick={() => setPhotoUrl(MARKET_IMAGES[edit.name!])}
                  className="mt-1 text-xs text-primary underline"
                >
                  Utiliser la photo par défaut
                </button>
              )}
            </label>

            {/* Prévisualisation */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Prévisualisation</span>
              <PhotoPreview url={photoUrl || getPhoto(edit.name ?? "")} alt={edit.name ?? ""} className="h-28" />
            </div>

            <label className="flex items-center gap-2 text-sm font-medium md:col-span-3">
              <input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4" />
              Marché actif
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="h-10 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90">Enregistrer</button>
            <button type="button" onClick={() => setEdit(null)} className="h-10 rounded-xl border px-4 text-sm hover:bg-muted">Annuler</button>
          </div>
        </form>
      )}

      {/* ─── Modal dédiée : Modifier / Supprimer la photo du marché ─── */}
      {photoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                Photo du marché : {photoModal}
              </h3>
              <button
                type="button"
                onClick={() => setPhotoModal(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <PhotoPreview
                url={modalUrl || getPhoto(photoModal)}
                alt={photoModal}
                className="h-44 w-full"
              />

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  URL de l'image (Unsplash, HTTPS...)
                </label>
                <input
                  className={`${input} font-mono text-xs`}
                  value={modalUrl}
                  onChange={(e) => setModalUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {MARKET_IMAGES[photoModal] && (
                  <button
                    type="button"
                    onClick={() => setModalUrl(MARKET_IMAGES[photoModal])}
                    className="rounded-lg border px-2.5 py-1.5 font-medium hover:bg-muted"
                  >
                    Restaurer l'image officielle
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalUrl(getProductFallback(photoModal))}
                  className="rounded-lg border border-red-200 text-red-600 px-2.5 py-1.5 font-medium hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  Supprimer (icône par défaut)
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setPhotoModal(null)}
                  className="h-9 rounded-xl border px-4 text-xs font-medium hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (modalUrl.trim()) {
                      setPhoto(photoModal, modalUrl.trim());
                      toast.success(`Photo de ${photoModal} mise à jour et synchronisée`);
                    } else {
                      resetPhoto(photoModal);
                      toast.info(`Photo de ${photoModal} réinitialisée`);
                    }
                    setPhotoModal(null);
                  }}
                  className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 shadow-xs"
                >
                  Enregistrer la photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tableau des marchés avec photos ─── */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 w-20">Photo</th>
              <th className="p-3">Marché</th>
              <th className="p-3 hidden md:table-cell">Province</th>
              <th className="p-3 hidden lg:table-cell">Commune</th>
              <th className="p-3 hidden lg:table-cell">GPS</th>
              <th className="p-3 hidden md:table-cell">Jours</th>
              <th className="p-3">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {d?.markets.map((m) => (
              <tr key={m.id} className="border-t hover:bg-muted/20 transition-colors">
                <td className="p-2">
                  <div
                    onClick={() => { setPhotoModal(m.name); setModalUrl(getPhoto(m.name)); }}
                    className="group relative cursor-pointer overflow-hidden rounded-lg"
                    title="Cliquer pour changer ou supprimer la photo"
                  >
                    <PhotoPreview url={getPhoto(m.name)} alt={m.name} className="h-12 w-16 rounded-lg transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Image className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </td>
                <td className="p-3 font-semibold">{m.name}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{prov[m.province_id]}</td>
                <td className="p-3 hidden lg:table-cell text-muted-foreground">{m.commune}</td>
                <td className="p-3 hidden lg:table-cell tabular-nums text-muted-foreground text-xs">{m.lat.toFixed(3)}, {m.lng.toFixed(3)}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{m.market_days ?? "—"}</td>
                <td className="p-3"><StatusBadge active={m.active} /></td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => { setPhotoModal(m.name); setModalUrl(getPhoto(m.name)); }}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors text-primary"
                      title="Changer, supprimer ou réinitialiser la photo"
                    >
                      <Image className="h-3.5 w-3.5" /> Photo
                    </button>
                    <button
                      onClick={() => openEdit(m)}
                      className="rounded-lg border p-1.5 hover:bg-muted transition-colors"
                      title="Modifier les détails du marché"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  PRODUITS
// ═══════════════════════════════════════════════════════════════════════════

export function Products() {
  const ref = useRef();
  const qc = useQueryClient();
  const { getPhoto, setPhoto, resetPhoto } = useProductPhotos();
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const [modalUrl, setModalUrl] = useState("");
  const [cat, setCat] = useState("");
  const d = ref.data;
  const cats = Object.fromEntries((d?.categories ?? []).map((c) => [c.id, c.name]));

  function openEdit(p: Partial<Product>) {
    setEdit(p);
    setPhotoUrl(p.name ? getPhoto(p.name) : "");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit?.name || !edit.category_id) { toast.error("Nom et catégorie obligatoires"); return; }
    const row = {
      name: edit.name,
      category_id: edit.category_id,
      default_unit: edit.default_unit || "kg",
      active: edit.active ?? true,
    };
    const { error } = edit.id
      ? await supabase.from("products").update(row).eq("id", edit.id)
      : await supabase.from("products").insert(row);
    if (error) { toast.error("Échec de l'enregistrement"); return; }

    // Sauvegarder la photo personnalisée
    if (photoUrl && edit.name) setPhoto(edit.name, photoUrl);
    else if (!photoUrl && edit.name) resetPhoto(edit.name);

    toast.success("Produit enregistré ✅");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["ref"] });
  }

  async function addCat() {
    if (!cat.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: cat.trim(), sort: (d?.categories.length ?? 0) + 1 });
    if (error) { toast.error("Échec"); return; }
    setCat(""); toast.success("Catégorie ajoutée"); qc.invalidateQueries({ queryKey: ["ref"] });
  }

  return (
    <div className="space-y-6">
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <input
            className={`${input} w-52`}
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            placeholder="Nouvelle catégorie"
            onKeyDown={(e) => e.key === "Enter" && addCat()}
          />
          <button onClick={addCat} className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-muted">
            Ajouter
          </button>
        </div>
        <button
          onClick={() => openEdit({ active: true, default_unit: "kg", category_id: d?.categories[0]?.id ?? "" })}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nouveau produit
        </button>
      </div>

      {/* Formulaire d'édition */}
      {edit && (
        <form onSubmit={save} className="rounded-2xl border bg-card p-6 shadow-sm">
          <h3 className="mb-4 text-base font-bold flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            {edit.id ? `Modifier : ${edit.name}` : "Nouveau produit"}
          </h3>

          <div className="grid gap-4 md:grid-cols-4">
            <label className="text-sm font-medium">
              Nom du produit
              <input className={`mt-1 ${input}`} value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </label>
            <label className="text-sm font-medium">
              Catégorie
              <select className={`mt-1 ${input}`} value={edit.category_id ?? ""} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>
                {d?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium">
              Unité par défaut
              <select className={`mt-1 ${input}`} value={edit.default_unit ?? "kg"} onChange={(e) => setEdit({ ...edit, default_unit: e.target.value })}>
                {["kg", "litre", "régime", "pièce", "tas", "botte"].map((u) => <option key={u}>{u}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm font-medium self-end mb-2">
              <input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} className="h-4 w-4" />
              Produit actif
            </label>

            {/* ─── Champ URL Photo ─── */}
            <label className="text-sm font-medium md:col-span-3">
              <span className="flex items-center gap-1.5 mb-1">
                <Image className="h-3.5 w-3.5 text-primary" />
                URL de la photo (Unsplash, HTTP...)
              </span>
              <input
                className={`mt-1 ${input} font-mono text-xs`}
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
              />
              <div className="mt-1 flex gap-3">
                {PRODUCT_IMAGES[edit.name ?? ""] && (
                  <button type="button" onClick={() => setPhotoUrl(PRODUCT_IMAGES[edit.name!])}
                    className="text-xs text-primary underline"
                  >
                    Photo par défaut
                  </button>
                )}
                {photoUrl && (
                  <button type="button" onClick={() => setPhotoUrl("")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <RefreshCcw className="h-3 w-3" /> Réinitialiser
                  </button>
                )}
              </div>
            </label>

            {/* Prévisualisation */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Prévisualisation</span>
              <PhotoPreview
                url={photoUrl || getPhoto(edit.name ?? "")}
                alt={edit.name ?? ""}
                className="h-28"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="h-10 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:opacity-90">Enregistrer</button>
            <button type="button" onClick={() => setEdit(null)} className="h-10 rounded-xl border px-4 text-sm hover:bg-muted">Annuler</button>
          </div>
        </form>
      )}

      {/* ─── Modal dédiée : Modifier / Supprimer la photo du produit ─── */}
      {photoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Image className="h-5 w-5 text-primary" />
                Photo du produit : {photoModal}
              </h3>
              <button
                type="button"
                onClick={() => setPhotoModal(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <PhotoPreview
                url={modalUrl || getPhoto(photoModal)}
                alt={photoModal}
                className="h-44 w-full"
              />

              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground block mb-1">
                  URL de l'image (Unsplash, HTTPS...)
                </label>
                <input
                  className={`${input} font-mono text-xs`}
                  value={modalUrl}
                  onChange={(e) => setModalUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                {PRODUCT_IMAGES[photoModal] && (
                  <button
                    type="button"
                    onClick={() => setModalUrl(PRODUCT_IMAGES[photoModal])}
                    className="rounded-lg border px-2.5 py-1.5 font-medium hover:bg-muted"
                  >
                    Restaurer l'image officielle
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalUrl(getProductFallback(photoModal))}
                  className="rounded-lg border border-red-200 text-red-600 px-2.5 py-1.5 font-medium hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  Supprimer (icône colorée)
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setPhotoModal(null)}
                  className="h-9 rounded-xl border px-4 text-xs font-medium hover:bg-muted"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (modalUrl.trim()) {
                      setPhoto(photoModal, modalUrl.trim());
                      toast.success(`Photo de ${photoModal} mise à jour et synchronisée`);
                    } else {
                      resetPhoto(photoModal);
                      toast.info(`Photo de ${photoModal} réinitialisée`);
                    }
                    setPhotoModal(null);
                  }}
                  className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground hover:opacity-90 shadow-xs"
                >
                  Enregistrer la photo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tableau des produits avec photos ─── */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-3 w-20">Photo</th>
              <th className="p-3">Produit</th>
              <th className="p-3 hidden md:table-cell">Catégorie</th>
              <th className="p-3 hidden md:table-cell">Unité</th>
              <th className="p-3">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {d?.products.map((p) => (
              <tr key={p.id} className="border-t hover:bg-muted/20 transition-colors">
                <td className="p-2">
                  <div
                    onClick={() => { setPhotoModal(p.name); setModalUrl(getPhoto(p.name)); }}
                    className="group relative cursor-pointer overflow-hidden rounded-lg"
                    title="Cliquer pour changer ou supprimer la photo"
                  >
                    <PhotoPreview url={getPhoto(p.name)} alt={p.name} className="h-12 w-16 rounded-lg transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Image className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </td>
                <td className="p-3 font-semibold">{p.name}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{cats[p.category_id]}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{p.default_unit}</td>
                <td className="p-3"><StatusBadge active={p.active} /></td>
                <td className="p-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      onClick={() => { setPhotoModal(p.name); setModalUrl(getPhoto(p.name)); }}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors text-primary"
                      title="Changer, supprimer ou réinitialiser la photo"
                    >
                      <Image className="h-3.5 w-3.5" /> Photo
                    </button>
                    <button
                      onClick={() => openEdit(p)}
                      className="rounded-lg border p-1.5 hover:bg-muted transition-colors"
                      title="Modifier les détails du produit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
