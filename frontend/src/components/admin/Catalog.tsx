import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRef, type Market, type Product } from "@/lib/data";

const input = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export function Markets() {
  const ref = useRef();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<Market> | null>(null);
  const d = ref.data;
  const prov = Object.fromEntries((d?.provinces ?? []).map((p) => [p.id, p.name]));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const row = { name: edit.name!, province_id: edit.province_id!, commune: edit.commune || null, lat: Number(edit.lat), lng: Number(edit.lng), market_days: edit.market_days || null, active: edit.active ?? true };
    if (!row.name || !row.province_id || isNaN(row.lat) || isNaN(row.lng)) { toast.error("Nom, province et coordonnées GPS sont obligatoires"); return; }
    const { error } = edit.id ? await supabase.from("markets").update(row).eq("id", edit.id) : await supabase.from("markets").insert(row);
    if (error) { toast.error("Échec de l'enregistrement"); return; }
    toast.success("Marché enregistré"); setEdit(null); qc.invalidateQueries({ queryKey: ["ref"] });
  }
  return (
    <div>
      <div className="mb-4 flex justify-end"><button onClick={() => setEdit({ active: true, province_id: d?.provinces[0]?.id ?? "" })} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" />Nouveau marché</button></div>
      {edit && (
        <form onSubmit={save} className="mb-6 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-3">
          <label className="text-sm">Nom<input className={input} value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          <label className="text-sm">Province<select className={input} value={edit.province_id ?? ""} onChange={(e) => setEdit({ ...edit, province_id: e.target.value })}>{d?.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
          <label className="text-sm">Commune<input className={input} value={edit.commune ?? ""} onChange={(e) => setEdit({ ...edit, commune: e.target.value })} /></label>
          <label className="text-sm">Latitude<input className={input} value={edit.lat ?? ""} onChange={(e) => setEdit({ ...edit, lat: e.target.value as any })} placeholder="-3.38" /></label>
          <label className="text-sm">Longitude<input className={input} value={edit.lng ?? ""} onChange={(e) => setEdit({ ...edit, lng: e.target.value as any })} placeholder="29.36" /></label>
          <label className="text-sm">Jours de marché<input className={input} value={edit.market_days ?? ""} onChange={(e) => setEdit({ ...edit, market_days: e.target.value })} placeholder="Lundi, Jeudi" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Actif</label>
          <div className="flex gap-2 md:col-span-3"><button className="h-10 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">Enregistrer</button><button type="button" onClick={() => setEdit(null)} className="h-10 px-4 text-sm">Annuler</button></div>
        </form>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">Marché</th><th className="p-3">Province</th><th className="p-3">Commune</th><th className="p-3">GPS</th><th className="p-3">Jours</th><th className="p-3">Statut</th><th className="p-3"></th></tr></thead>
          <tbody>{d?.markets.map((m) => (
            <tr key={m.id} className="border-t"><td className="p-3 font-medium">{m.name}</td><td className="p-3">{prov[m.province_id]}</td><td className="p-3">{m.commune}</td>
              <td className="p-3 tabular-nums text-muted-foreground">{m.lat.toFixed(4)}, {m.lng.toFixed(4)}</td><td className="p-3">{m.market_days}</td>
              <td className="p-3">{m.active ? <span className="text-success">Actif</span> : <span className="text-muted-foreground">Inactif</span>}</td>
              <td className="p-3"><button onClick={() => setEdit(m)} className="rounded border p-1.5" title="Modifier"><Pencil className="h-4 w-4" /></button></td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Products() {
  const ref = useRef();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Partial<Product> | null>(null);
  const [cat, setCat] = useState("");
  const d = ref.data;
  const cats = Object.fromEntries((d?.categories ?? []).map((c) => [c.id, c.name]));
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit?.name || !edit.category_id) { toast.error("Nom et catégorie obligatoires"); return; }
    const row = { name: edit.name, category_id: edit.category_id, default_unit: edit.default_unit || "kg", active: edit.active ?? true };
    const { error } = edit.id ? await supabase.from("products").update(row).eq("id", edit.id) : await supabase.from("products").insert(row);
    if (error) { toast.error("Échec de l'enregistrement"); return; }
    toast.success("Produit enregistré"); setEdit(null); qc.invalidateQueries({ queryKey: ["ref"] });
  }
  async function addCat() {
    if (!cat.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: cat.trim(), sort: (d?.categories.length ?? 0) + 1 });
    if (error) { toast.error("Échec"); return; }
    setCat(""); toast.success("Catégorie ajoutée"); qc.invalidateQueries({ queryKey: ["ref"] });
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2"><input className={input + " w-56"} value={cat} onChange={(e) => setCat(e.target.value)} placeholder="Nouvelle catégorie" /><button onClick={addCat} className="h-10 rounded-md border px-3 text-sm">Ajouter</button></div>
        <button onClick={() => setEdit({ active: true, default_unit: "kg", category_id: d?.categories[0]?.id ?? "" })} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" />Nouveau produit</button>
      </div>
      {edit && (
        <form onSubmit={save} className="mb-6 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
          <label className="text-sm">Nom<input className={input} value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
          <label className="text-sm">Catégorie<select className={input} value={edit.category_id ?? ""} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })}>{d?.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-sm">Unité par défaut<select className={input} value={edit.default_unit ?? "kg"} onChange={(e) => setEdit({ ...edit, default_unit: e.target.value })}>{["kg", "litre", "régime", "pièce", "tas", "botte"].map((u) => <option key={u}>{u}</option>)}</select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} />Actif</label>
          <div className="flex gap-2 md:col-span-4"><button className="h-10 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">Enregistrer</button><button type="button" onClick={() => setEdit(null)} className="h-10 px-4 text-sm">Annuler</button></div>
        </form>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr><th className="p-3">Produit</th><th className="p-3">Catégorie</th><th className="p-3">Unité</th><th className="p-3">Statut</th><th className="p-3"></th></tr></thead>
          <tbody>{d?.products.map((p) => (
            <tr key={p.id} className="border-t"><td className="p-3 font-medium">{p.name}</td><td className="p-3">{cats[p.category_id]}</td><td className="p-3">{p.default_unit}</td>
              <td className="p-3">{p.active ? <span className="text-success">Actif</span> : <span className="text-muted-foreground">Inactif</span>}</td>
              <td className="p-3"><button onClick={() => setEdit(p)} className="rounded border p-1.5" title="Modifier"><Pencil className="h-4 w-4" /></button></td></tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
