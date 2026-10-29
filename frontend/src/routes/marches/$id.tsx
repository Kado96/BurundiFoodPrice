import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { ArrowLeft, CalendarDays, MapPin, Search, Store, Filter, Sparkles, TrendingUp } from "lucide-react";
import { useLatest, useRef, fbu, pct, fmtDate } from "@/lib/data";
import { Avail, Delta, Page, Stat } from "@/components/bits";
import { PRODUCT_IMAGES, getProductFallback, getMarketPhoto } from "@/lib/images";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/marches/$id")({
  head: () => ({ meta: [
    { title: "Fiche marché — Burundi Food Price" },
    { name: "description", content: "Derniers prix des produits vivriers relevés dans ce marché du Burundi." },
    { property: "og:title", content: "Fiche marché — Burundi Food Price" },
    { property: "og:description", content: "Prix actuels et variations sur 30 jours pour ce marché." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: MarchePage,
});

function MarchePage() {
  const { id } = Route.useParams();
  const { t, tm, tp } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const d = ref.data;

  // Tous les Hooks d'état et mémoïsation TOUJOURS au sommet absolu
  const [searchProd, setSearchProd] = useState("");
  const [selectedCat, setSelectedCat] = useState("");

  const m = useMemo(() => d?.markets.find((x) => x.id === id), [d, id]);
  const prov = useMemo(() => d?.provinces.find((p) => p.id === m?.province_id)?.name, [d, m]);
  const prods = useMemo(() => Object.fromEntries((d?.products ?? []).map((p) => [p.id, p])), [d]);
  const cats = useMemo(() => Object.fromEntries((d?.categories ?? []).map((c) => [c.id, c.name])), [d]);
  const allCategories = useMemo(() => d?.categories ?? [], [d]);

  const rawRows = useMemo(() => {
    return (latest.data ?? [])
      .filter((l) => l.market_id === id)
      .sort((a, b) => (prods[a.product_id]?.name ?? "").localeCompare(prods[b.product_id]?.name ?? ""));
  }, [latest.data, id, prods]);

  const filteredRows = useMemo(() => {
    return rawRows.filter((r) => {
      const p = prods[r.product_id];
      if (!p) return false;
      const matchesText = !searchProd || 
        p.name.toLowerCase().includes(searchProd.toLowerCase()) || 
        tp(p.name).toLowerCase().includes(searchProd.toLowerCase());
      const matchesCat = !selectedCat || p.category_id === selectedCat;
      return matchesText && matchesCat;
    });
  }, [rawRows, prods, searchProd, selectedCat, tp]);

  // Conditions de chargement / introuvable APRÈS tous les hooks
  if (ref.isLoading) return <Page><p className="text-muted-foreground">{t("loading")}</p></Page>;
  if (!m) return <Page><p>Marché introuvable. <Link to="/marches" className="text-primary underline">Retour</Link></p></Page>;

  const last = rawRows.reduce((a, r) => (r.observed_at > a ? r.observed_at : a), "");
  const marketPhoto = getMarketPhoto(m.name);

  return (
    <>
      {/* ═══════════════════════════════════════════════
          HERO BANNER AVEC PHOTO DU MARCHÉ EN FOND
      ═══════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-slate-900 text-white">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40 transition-transform duration-700 hover:scale-105"
          style={{ backgroundImage: `url('${marketPhoto}')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-black/60 to-black/30" />

        <div className="relative mx-auto max-w-7xl px-4 py-8 md:py-12">
          <Link
            to="/marches"
            className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-xs hover:bg-black/60 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tous les marchés
          </Link>

          <div className="mt-2 flex flex-col gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Store className="h-3.5 w-3.5" />
              Marché Vivrier Local
            </span>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl text-white">
              {tm(m.name)}
            </h1>
            <p className="flex items-center gap-1.5 text-sm font-medium text-white/80">
              <MapPin className="h-4 w-4 text-primary" />
              Province de {prov} {m.commune ? `· Commune de ${m.commune}` : ""}
            </p>
          </div>

          {/* Cartes de statistiques en surimpression */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 backdrop-blur-md">
              <span className="text-xs text-white/70">Commune</span>
              <p className="mt-1 text-base font-bold text-white truncate">{m.commune ?? "—"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 backdrop-blur-md">
              <span className="text-xs text-white/70">Jours de marché</span>
              <p className="mt-1 text-base font-bold text-white truncate">{m.market_days ?? "Tous les jours"}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 backdrop-blur-md">
              <span className="text-xs text-white/70">Produits suivis</span>
              <p className="mt-1 text-base font-bold text-emerald-400">{rawRows.length} vivriers</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/40 p-3.5 backdrop-blur-md">
              <span className="text-xs text-white/70">Dernier relevé</span>
              <p className="mt-1 text-base font-bold text-white">{last ? fmtDate(last) : "—"}</p>
            </div>
          </div>
        </div>
      </section>

      <Page>
        {/* ═══════════════════════════════════════════════
            BARRE DE FILTRAGE PRODUITS & CATÉGORIES
        ═══════════════════════════════════════════════ */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            {/* Recherche textuelle */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
                placeholder="Filtrer les produits de ce marché (ex: riz, haricot)..."
                className="h-10 w-full rounded-xl border bg-card pl-9 pr-3 text-xs outline-none focus:ring-2 focus:ring-primary shadow-xs"
              />
            </div>

            {/* Filtre par catégorie de denrées */}
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              aria-label="Filtrer par catégorie"
              className="h-10 rounded-xl border bg-card px-3 text-xs outline-none focus:ring-2 focus:ring-primary shadow-xs font-semibold"
            >
              <option value="">Toutes les catégories</option>
              {allCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <span className="text-xs text-muted-foreground font-medium self-end sm:self-auto">
            {filteredRows.length} sur {rawRows.length} produit(s)
          </span>
        </div>

        {/* ═══════════════════════════════════════════════
            TABLEAU AVEC PHOTOS RÉELLES DE CHAQUE PRODUIT
        ═══════════════════════════════════════════════ */}
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3.5 w-16">Photo</th>
                  <th className="p-3.5">Produit</th>
                  <th className="p-3.5">Catégorie</th>
                  <th className="p-3.5 text-right">Prix relevé</th>
                  <th className="p-3.5 text-right">Variation 30 j</th>
                  <th className="p-3.5 text-center">Disponibilité</th>
                  <th className="p-3.5 text-right">Date relevé</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => {
                  const p = prods[r.product_id];
                  if (!p) return null;
                  const photo = PRODUCT_IMAGES[p.name] || getProductFallback(p.name);
                  const fallback = getProductFallback(p.name);

                  return (
                    <tr key={r.product_id} className="border-t hover:bg-muted/30 transition-colors">
                      {/* Miniature Photo réelle */}
                      <td className="p-2.5">
                        <img
                          src={photo}
                          alt={p.name}
                          loading="lazy"
                          onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
                          className="h-11 w-14 rounded-lg object-cover shadow-2xs border"
                        />
                      </td>

                      {/* Nom du produit */}
                      <td className="p-3.5">
                        <Link
                          to="/produits"
                          search={{ product: p.id } as any}
                          className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          {tp(p.name)}
                        </Link>
                        <span className="text-[11px] text-muted-foreground">{p.name}</span>
                      </td>

                      {/* Catégorie */}
                      <td className="p-3.5 text-xs text-muted-foreground font-medium">
                        {cats[p.category_id ?? ""] ?? "Vivres"}
                      </td>

                      {/* Prix constaté */}
                      <td className="p-3.5 text-right font-black text-primary text-base tabular-nums">
                        {fbu(r.unit_price)}
                        <span className="text-xs font-normal text-muted-foreground">/{r.unit}</span>
                      </td>

                      {/* Tendance */}
                      <td className="p-3.5 text-right">
                        <Delta v={pct(r.unit_price, r.prev_price)} />
                      </td>

                      {/* Disponibilité */}
                      <td className="p-3.5 text-center">
                        <Avail v={r.availability} />
                      </td>

                      {/* Date */}
                      <td className="p-3.5 text-right text-xs text-muted-foreground tabular-nums">
                        {fmtDate(r.observed_at)}
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                      Aucun produit ne correspond à votre filtre.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Page>
    </>
  );
}
