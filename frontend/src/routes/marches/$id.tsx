import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { useLatest, useRef, fbu, pct, fmtDate } from "@/lib/data";
import { Avail, Delta, Page, PageTitle, Stat } from "@/components/bits";

export const Route = createFileRoute("/marches/$id")({
  head: () => ({ meta: [
    { title: "Fiche marché — Burundi Food Price" },
    { name: "description", content: "Derniers prix des produits vivriers relevés dans ce marché du Burundi." },
    { property: "og:title", content: "Fiche marché — Burundi Food Price" },
    { property: "og:description", content: "Prix actuels et variations sur 30 jours pour ce marché." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MarchePage,
});

function MarchePage() {
  const { id } = Route.useParams();
  const ref = useRef();
  const latest = useLatest();
  const d = ref.data;
  const m = d?.markets.find((x) => x.id === id);
  if (ref.isLoading) return <Page><p className="text-muted-foreground">Chargement…</p></Page>;
  if (!m) return <Page><p>Marché introuvable. <Link to="/marches" className="text-primary underline">Retour</Link></p></Page>;
  const prov = d?.provinces.find((p) => p.id === m.province_id)?.name;
  const prods = Object.fromEntries((d?.products ?? []).map((p) => [p.id, p]));
  const cats = Object.fromEntries((d?.categories ?? []).map((c) => [c.id, c.name]));
  const rows = (latest.data ?? []).filter((l) => l.market_id === id)
    .sort((a, b) => (prods[a.product_id]?.name ?? "").localeCompare(prods[b.product_id]?.name ?? ""));
  const last = rows.reduce((a, r) => (r.observed_at > a ? r.observed_at : a), "");
  const ups = rows.filter((r) => (pct(r.unit_price, r.prev_price) ?? 0) > 0.5).length;

  return (
    <Page>
      <Link to="/marches" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Tous les marchés</Link>
      <PageTitle title={m.name} sub={`Province de ${prov}`} />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Commune" value={<span className="flex items-center gap-1 text-lg"><MapPin className="h-4 w-4" />{m.commune ?? "—"}</span>} />
        <Stat label="Jours de marché" value={<span className="flex items-center gap-1 text-lg"><CalendarDays className="h-4 w-4" />{m.market_days ?? "Tous"}</span>} />
        <Stat label="Produits suivis" value={rows.length} />
        <Stat label="Dernière mise à jour" value={<span className="text-lg">{last ? fmtDate(last) : "—"}</span>} hint={`${ups} produit(s) en hausse sur 30 j`} />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            <th className="p-3">Produit</th><th className="p-3">Catégorie</th><th className="p-3 text-right">Prix</th>
            <th className="p-3">Unité</th><th className="p-3">Variation 30 j</th><th className="p-3">Disponibilité</th><th className="p-3">Relevé le</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id} className="border-t">
                <td className="p-3 font-medium">{prods[r.product_id]?.name}</td>
                <td className="p-3 text-muted-foreground">{cats[prods[r.product_id]?.category_id ?? ""]}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{fbu(r.unit_price)}</td>
                <td className="p-3">{r.unit}</td>
                <td className="p-3"><Delta v={pct(r.unit_price, r.prev_price)} /></td>
                <td className="p-3"><Avail v={r.availability} /></td>
                <td className="p-3 text-muted-foreground">{fmtDate(r.observed_at)}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Aucun prix validé pour ce marché.</td></tr>}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
