import { useState } from "react";
import { toast } from "sonner";
import { FileSpreadsheet, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRef } from "@/lib/data";

const input = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export function ExportPanel() {
  const ref = useRef();
  const d = ref.data;
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState("VALIDEE");
  const [market, setMarket] = useState("");
  const [product, setProduct] = useState("");
  const [busy, setBusy] = useState(false);

  async function fetchRows() {
    const rows: any[] = [];
    for (let page = 0; page < 50; page++) {
      let q = supabase.from("observations").select("*").gte("observed_at", from).lte("observed_at", to + "T23:59:59").order("observed_at").range(page * 1000, page * 1000 + 999);
      if (status) q = q.eq("status", status);
      if (market) q = q.eq("market_id", market);
      if (product) q = q.eq("product_id", product);
      const { data, error } = await q;
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < 1000) break;
    }
    const mk = Object.fromEntries((d?.markets ?? []).map((m) => [m.id, m]));
    const pv = Object.fromEntries((d?.provinces ?? []).map((p) => [p.id, p.name]));
    const pr = Object.fromEntries((d?.products ?? []).map((p) => [p.id, p.name]));
    return rows.map((o) => ({
      Date: o.observed_at.slice(0, 10), Province: pv[mk[o.market_id]?.province_id ?? ""] ?? "", Marché: mk[o.market_id]?.name ?? "",
      Produit: pr[o.product_id] ?? "", Variété: o.variety ?? "", Unité: o.unit, Quantité: Number(o.quantity), "Prix (FBu)": Number(o.price),
      "Prix unitaire (FBu)": Math.round(Number(o.price) / Number(o.quantity)), Disponibilité: o.availability, Qualité: o.quality ?? "",
      Provenance: o.origin ?? "", Statut: o.status, Alertes: (o.flags ?? []).join(" "), Latitude: o.lat ?? "", Longitude: o.lng ?? "",
    }));
  }

  async function run(kind: "csv" | "xlsx") {
    setBusy(true);
    try {
      const rows = await fetchRows();
      if (!rows.length) { toast.error("Aucune donnée pour ces critères"); return; }
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(rows);
      const name = `prix-burundi_${from}_${to}`;
      if (kind === "xlsx") {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Relevés");
        XLSX.writeFile(wb, `${name}.xlsx`);
      } else {
        const csv = XLSX.utils.sheet_to_csv(ws, { FS: ";" });
        const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(url);
      }
      toast.success(`${rows.length} lignes exportées`);
    } catch { toast.error("Échec de l'export"); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h2 className="mb-4 text-lg font-bold">Exporter les relevés</h2>
      <div className="grid gap-3 md:grid-cols-5">
        <label className="text-sm">Du<input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-sm">Au<input type="date" className={input} value={to} max={today} onChange={(e) => setTo(e.target.value)} /></label>
        <label className="text-sm">Statut<select className={input} value={status} onChange={(e) => setStatus(e.target.value)}><option value="VALIDEE">Validés</option><option value="SYNCHRONISEE">En attente</option><option value="REJETEE">Rejetés</option><option value="">Tous</option></select></label>
        <label className="text-sm">Marché<select className={input} value={market} onChange={(e) => setMarket(e.target.value)}><option value="">Tous</option>{d?.markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
        <label className="text-sm">Produit<select className={input} value={product} onChange={(e) => setProduct(e.target.value)}><option value="">Tous</option>{d?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      </div>
      <div className="mt-6 flex gap-3">
        <button disabled={busy} onClick={() => run("xlsx")} className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"><FileSpreadsheet className="h-4 w-4" />Excel (.xlsx)</button>
        <button disabled={busy} onClick={() => run("csv")} className="inline-flex h-10 items-center gap-2 rounded-md border px-5 text-sm font-medium"><FileText className="h-4 w-4" />CSV</button>
      </div>
    </div>
  );
}
