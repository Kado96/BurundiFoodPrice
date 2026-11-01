import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, useSeries, fbu } from "@/lib/data";
import { Page, PageTitle } from "@/components/bits";
import { MultiSelect } from "@/components/MultiSelect";
import { useI18n } from "@/lib/i18n";
import { PRODUCT_IMAGES, getProductFallback, getMarketPhoto } from "@/lib/images";
import { TrendingDown, LineChart as ChartIcon, Store, BarChart2 } from "lucide-react";

export const Route = createFileRoute("/comparaison")({
  head: () => ({ meta: [
    { title: "Comparer les marchés — Burundi Food Price" },
    { name: "description", content: "Comparez le prix d'un produit entre les marchés du Burundi : barres des prix actuels et courbes d'évolution." },
    { property: "og:title", content: "Comparer les marchés — Burundi Food Price" },
    { property: "og:description", content: "Où acheter moins cher ? Comparez les prix marché par marché." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ComparaisonPage,
});

const VIBRANT_COLORS = [
  "#2563eb", // Bleu royal
  "#16a34a", // Vert émeraude
  "#ea580c", // Orange vif
  "#9333ea", // Violet
  "#dc2626", // Rouge vermillon
  "#0891b2", // Cyan
  "#d97706", // Ambre
  "#4f46e5", // Indigo
  "#db2777", // Rose
  "#059669", // Menthe
  "#ca8a04", // Or
];

function ComparaisonPage() {
  const { t, tm, tp } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const d = ref.data;

  const [productId, setProductId] = useState("");
  // Sélection multiple de marchés
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);

  useEffect(() => {
    if (!productId && d?.products[0]) {
      setProductId(d.products[0].id);
    }
  }, [d, productId]);

  const series = useSeries(productId || undefined, 180);
  const allMarkets = useMemo(() => d?.markets ?? [], [d]);
  const mkt = useMemo(() => Object.fromEntries(allMarkets.map((m) => [m.id, m.name])), [allMarkets]);

  // Tous les marchés avec prix pour le produit sélectionné
  const productBars = useMemo(() => {
    return (latest.data ?? [])
      .filter((l) => l.product_id === productId)
      .map((l) => ({ name: mkt[l.market_id] ?? "?", id: l.market_id, prix: Number(l.unit_price) }))
      .sort((a, b) => a.prix - b.prix);
  }, [latest.data, productId, mkt]);

  // Initialisation par défaut : les 3 premiers marchés ou les 2 extrêmes si rien n'est sélectionné
  useEffect(() => {
    if (productBars.length >= 2 && selectedMarkets.length === 0) {
      if (productBars.length <= 4) {
        setSelectedMarkets(productBars.map((b) => b.id));
      } else {
        // Le moins cher et le plus cher par défaut
        setSelectedMarkets([productBars[0]!.id, productBars[productBars.length - 1]!.id]);
      }
    }
  }, [productBars, selectedMarkets.length]);

  // Réinitialiser la sélection au changement de produit pour s'adapter aux marchés disponibles
  useEffect(() => {
    setSelectedMarkets([]);
  }, [productId]);

  // Options pour le composant MultiSelect
  const marketOptions = useMemo(() => {
    return productBars.map((b, i) => ({
      value: b.id,
      label: `${tm(b.name)} (${fbu(b.prix)})`,
      color: VIBRANT_COLORS[i % VIBRANT_COLORS.length],
    }));
  }, [productBars, tm]);

  // Attribution d'une couleur fixe à chaque marché
  const marketColorMap = useMemo(() => {
    const map = new Map<string, string>();
    productBars.forEach((b, i) => {
      map.set(b.id, VIBRANT_COLORS[i % VIBRANT_COLORS.length]);
    });
    return map;
  }, [productBars]);

  // Les barres filtrées selon la sélection (ou toutes si rien n'est sélectionné)
  const displayedBars = useMemo(() => {
    if (selectedMarkets.length === 0) return productBars;
    return productBars.filter((b) => selectedMarkets.includes(b.id));
  }, [productBars, selectedMarkets]);

  // Marchés actifs pour le graphique temporel
  const activeChartMarketIds = useMemo(() => {
    if (selectedMarkets.length > 0) return selectedMarkets;
    return productBars.slice(0, 5).map((b) => b.id);
  }, [selectedMarkets, productBars]);

  const { lines, minPrice, maxPrice } = useMemo(() => {
    const by: Record<string, Record<string, number | string>> = {};
    let min = Infinity;
    let max = -Infinity;

    (series.data ?? []).filter((r) => activeChartMarketIds.includes(r.market_id)).forEach((r) => {
      const p = Number(r.price);
      if (p > 0) {
        if (p < min) min = p;
        if (p > max) max = p;
        (by[r.day] ??= { day: r.day })[r.market_id] = p;
      }
    });

    const rows = Object.values(by).sort((a, b) => String(a['day']).localeCompare(String(b['day'])));
    return {
      lines: rows,
      minPrice: isFinite(min) ? Math.floor(min * 0.9 / 100) * 100 : 0,
      maxPrice: isFinite(max) ? Math.ceil(max * 1.1 / 100) * 100 : 10000
    };
  }, [series.data, activeChartMarketIds]);

  const selectedProduct = d?.products.find((p) => p.id === productId);

  // Statistiques sur les marchés sélectionnés
  const stats = useMemo(() => {
    if (displayedBars.length < 2) return null;
    const sorted = [...displayedBars].sort((a, b) => a.prix - b.prix);
    const cheapest = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];
    const diff = mostExpensive.prix - cheapest.prix;
    const pctDiff = cheapest.prix > 0 ? Math.round((diff / cheapest.prix) * 100) : 0;
    return { cheapest, mostExpensive, diff, pctDiff };
  }, [displayedBars]);

  const toggleMarketInBar = (id: string) => {
    if (selectedMarkets.includes(id)) {
      setSelectedMarkets(selectedMarkets.filter((m) => m !== id));
    } else {
      setSelectedMarkets([...selectedMarkets, id]);
    }
  };

  return (
    <>
      {/* ═══════════════════════════════════════════════
          BANDEAU SÉLECTION DU PRODUIT AVEC PHOTOS
      ═══════════════════════════════════════════════ */}
      <section className="border-b bg-card shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Produit à comparer :
          </p>
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {d?.products.map((p) => {
              const active = p.id === productId;
              const photo = PRODUCT_IMAGES[p.name] || getProductFallback(p.name);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProductId(p.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl border p-1.5 pr-3 text-xs font-semibold transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/30"
                      : "border-border bg-background hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <img src={photo} alt={p.name} className="h-8 w-8 rounded-lg object-cover" />
                  <span>{tp(p.name)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Page>
        <PageTitle
          title={t("comparisonTitle")}
          sub={`Comparatif multi-marchés synchronisé pour ${selectedProduct ? tp(selectedProduct.name) : "le produit sélectionné"}`}
        />

        {/* ═══════════════════════════════════════════════
            SÉLECTEUR UNIVERSEL MULTI-MARCHÉS
        ═══════════════════════════════════════════════ */}
        <div className="mb-8 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Sélection des marchés à comparer
              </h2>
              <p className="text-xs text-muted-foreground">
                Choisissez 1, 2, 3, 5 ou tous les marchés pour synchroniser instantanément les graphiques et métriques ci-dessous.
              </p>
            </div>
            {selectedMarkets.length > 0 && (
              <span className="text-xs font-semibold text-primary self-start sm:self-auto">
                {selectedMarkets.length} marché{selectedMarkets.length > 1 ? "s" : ""} sélectionné{selectedMarkets.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="max-w-2xl">
            <MultiSelect
              options={marketOptions}
              selected={selectedMarkets}
              onChange={setSelectedMarkets}
              placeholder="Tous les marchés (ou sélectionnez)"
              allLabel="Tous les marchés"
              maxBadges={3}
            />
          </div>

          {/* Cartes d'aperçu des marchés sélectionnés */}
          {displayedBars.length > 0 && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {displayedBars.map((b) => {
                const color = marketColorMap.get(b.id) || "var(--primary)";
                const isCheapest = stats && b.id === stats.cheapest.id;
                const isExpensive = stats && b.id === stats.mostExpensive.id && stats.cheapest.id !== stats.mostExpensive.id;
                return (
                  <div
                    key={b.id}
                    className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-xs transition-transform hover:-translate-y-0.5"
                    style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                  >
                    <img
                      src={getMarketPhoto(b.name)}
                      alt={b.name}
                      className="absolute inset-0 h-full w-full object-cover opacity-10 pointer-events-none"
                    />
                    <div className="relative">
                      <div className="text-xs font-semibold text-muted-foreground truncate">{tm(b.name)}</div>
                      <div className="mt-1 font-display text-lg font-black tabular-nums text-foreground">
                        {fbu(b.prix)}
                      </div>
                      {isCheapest && (
                        <span className="mt-1 inline-block rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Moins cher
                        </span>
                      )}
                      {isExpensive && (
                        <span className="mt-1 inline-block rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
                          Plus cher
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bandeau d'écart de prix si au moins 2 marchés sélectionnés */}
          {stats && stats.diff > 0 && (
            <div className="mt-4 rounded-xl border border-orange-300/50 bg-orange-50/80 p-3.5 dark:bg-orange-950/20 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-orange-600 shrink-0" />
                <span className="text-xs sm:text-sm font-semibold text-foreground">
                  Écart entre <strong>{tm(stats.cheapest.name)}</strong> ({fbu(stats.cheapest.prix)}) et <strong>{tm(stats.mostExpensive.name)}</strong> ({fbu(stats.mostExpensive.prix)}) :
                </span>
              </div>
              <span className="text-sm sm:text-base font-black text-orange-600 tabular-nums">
                +{fbu(stats.diff)} (+{stats.pctDiff}%)
              </span>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════
            GRAPHIQUE EN BARRES COMPARATIVES
        ═══════════════════════════════════════════════ */}
        <div className="mb-10 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BarChart2 className="h-5 w-5 text-primary" />
                Comparatif des prix constatés ({displayedBars.length} marchés)
              </h2>
              <p className="text-xs text-muted-foreground">
                Cliquez sur une barre pour ajouter ou retirer un marché de la sélection active
              </p>
            </div>
          </div>

          <div style={{ width: "100%", height: Math.max(300, displayedBars.length * 32) }}>
            <ResponsiveContainer>
              <BarChart data={displayedBars} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${v} FBu`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip
                  formatter={(val: number) => [`${fbu(val)}`, "Prix constaté"]}
                  contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }}
                />
                <Bar
                  dataKey="prix"
                  radius={[0, 4, 4, 0]}
                  onClick={(entry: any) => toggleMarketInBar(entry.id)}
                  fill="var(--primary)"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            COURBES TEMPORELLES 180 JOURS
        ═══════════════════════════════════════════════ */}
        {lines.length > 0 ? (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ChartIcon className="h-5 w-5 text-primary" />
              Évolution des prix sur 180 jours ({activeChartMarketIds.length} marchés)
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Courbe comparative synchronisée avec vos marchés sélectionnés
            </p>
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer>
                <LineChart data={lines} margin={{ top: 15, right: 30, left: 15, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(dayStr) => {
                      const parts = dayStr.split("-");
                      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dayStr;
                    }}
                  />
                  <YAxis
                    domain={[minPrice, maxPrice]}
                    tickFormatter={(v) => `${v} FBu`}
                    tick={{ fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip
                    formatter={(val: number) => [`${fbu(val)}`, ""]}
                    labelFormatter={(lbl) => `Date : ${lbl}`}
                    contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }}
                  />
                  <Legend
                    formatter={(id) => <span className="text-xs font-semibold">{tm(mkt[id] ?? id)}</span>}
                    wrapperStyle={{ paddingTop: "12px" }}
                  />
                  {activeChartMarketIds.map((k) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={marketColorMap.get(k) || "#2563eb"}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 1.5, fill: "#fff" }}
                      activeDot={{ r: 6, stroke: marketColorMap.get(k) || "#2563eb", strokeWidth: 2 }}
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
            Sélectionnez au moins un marché avec des données historiques pour voir l'évolution sur 180 jours.
          </div>
        )}
      </Page>
    </>
  );
}
