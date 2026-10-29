import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, useSeries, fbu } from "@/lib/data";
import { Page, PageTitle } from "@/components/bits";
import { useI18n } from "@/lib/i18n";
import { PRODUCT_IMAGES, getProductFallback, getMarketPhoto } from "@/lib/images";
import { CheckCircle2, AlertTriangle, TrendingDown, LineChart as ChartIcon, ArrowLeftRight, ChevronDown } from "lucide-react";

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
];

function ComparaisonPage() {
  const { t, tm, tp } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const d = ref.data;

  const [productId, setProductId] = useState("");
  // Deux marchés sélectionnés MANUELLEMENT par l'utilisateur pour le duel
  const [marketLeft, setMarketLeft] = useState(""); // Marché gauche (carte verte)
  const [marketRight, setMarketRight] = useState(""); // Marché droit (carte rouge)
  // Marchés supplémentaires dans le graphique temporel (jusqu'à 5 total)
  const [extraSel, setExtraSel] = useState<string[]>([]);

  useEffect(() => { if (!productId && d?.products[0]) setProductId(d.products[0].id); }, [d, productId]);

  const series = useSeries(productId || undefined, 180);
  const allMarkets = useMemo(() => d?.markets ?? [], [d]);
  const mkt = useMemo(() => Object.fromEntries(allMarkets.map((m) => [m.id, m.name])), [allMarkets]);

  const bars = useMemo(() => {
    return (latest.data ?? [])
      .filter((l) => l.product_id === productId)
      .map((l) => ({ name: mkt[l.market_id] ?? "?", id: l.market_id, prix: Number(l.unit_price) }))
      .sort((a, b) => a.prix - b.prix);
  }, [latest.data, productId, mkt]);

  // Initialiser automatiquement les deux marchés au 1er chargement
  useEffect(() => {
    if (bars.length >= 2 && !marketLeft && !marketRight) {
      setMarketLeft(bars[0]!.id);    // le moins cher par défaut à gauche
      setMarketRight(bars[bars.length - 1]!.id); // le plus cher par défaut à droite
    }
  }, [bars, marketLeft, marketRight]);

  // Réinitialiser quand on change de produit
  useEffect(() => {
    setMarketLeft("");
    setMarketRight("");
    setExtraSel([]);
  }, [productId]);

  // Données des deux marchés sélectionnés pour le duel
  const leftData = bars.find((b) => b.id === marketLeft);
  const rightData = bars.find((b) => b.id === marketRight);

  // Liste des marchés actifs dans le graphique (les deux + extras)
  const chartMarketIds = useMemo(() => {
    const ids = new Set<string>();
    if (marketLeft) ids.add(marketLeft);
    if (marketRight) ids.add(marketRight);
    extraSel.forEach((id) => ids.add(id));
    return Array.from(ids);
  }, [marketLeft, marketRight, extraSel]);

  const { lines, minPrice, maxPrice } = useMemo(() => {
    const by: Record<string, Record<string, number | string>> = {};
    let min = Infinity;
    let max = -Infinity;

    (series.data ?? []).filter((r) => chartMarketIds.includes(r.market_id)).forEach((r) => {
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
  }, [series.data, chartMarketIds]);

  const selectedProduct = d?.products.find((p) => p.id === productId);
  const difference = (leftData && rightData) ? Math.abs(rightData.prix - leftData.prix) : 0;
  const minPrix = leftData && rightData ? Math.min(leftData.prix, rightData.prix) : 1;
  const percentDiff = minPrix > 0 ? Math.round((difference / minPrix) * 100) : 0;
  const leftCheaper = leftData && rightData && leftData.prix <= rightData.prix;

  // Toggle pour les marchés supplémentaires dans le graphique
  const toggleExtra = (id: string) => {
    if (id === marketLeft || id === marketRight) return; // Ne pas dupliquer
    setExtraSel((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 3 ? s : [...s, id]);
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
          sub={`Comparatif en direct pour ${selectedProduct ? tp(selectedProduct.name) : "le produit sélectionné"}`}
        />

        {/* ═══════════════════════════════════════════════
            DUEL INTERACTIF : DEUX SÉLECTEURS DE MARCHÉS AVEC PHOTOS
        ═══════════════════════════════════════════════ */}
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            Choisissez les deux marchés à confronter :
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {/* ─── Marché Gauche (Gauche) ─── */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-card shadow-md">
              {/* Photo en arrière-plan */}
              {leftData && (
                <img
                  src={getMarketPhoto(leftData.name)}
                  alt={leftData.name}
                  className="absolute inset-0 h-full w-full object-cover opacity-15"
                />
              )}
              <div className="relative p-5">
                {/* Sélecteur de marché gauche */}
                <div className="relative mb-3">
                  <label className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1 block">
                    <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" />
                    Marché A (Gauche)
                  </label>
                  <div className="relative">
                    <select
                      value={marketLeft}
                      onChange={(e) => setMarketLeft(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border-2 border-emerald-500/40 bg-card px-3 pr-8 text-sm font-semibold outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                    >
                      <option value="">— Sélectionner un marché —</option>
                      {bars.map((b) => (
                        <option key={b.id} value={b.id} disabled={b.id === marketRight}>
                          {tm(b.name)} — {fbu(b.prix)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none text-muted-foreground" />
                  </div>
                </div>

                {/* Affichage des données du marché gauche */}
                {leftData ? (
                  <>
                    <h3 className="text-xl font-extrabold text-foreground">{tm(leftData.name)}</h3>
                    <p className={`mt-1 text-3xl font-black tabular-nums ${leftCheaper ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {fbu(leftData.prix)}
                    </p>
                    {leftCheaper && leftData.id !== rightData?.id && (
                      <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        ✅ Moins cher
                      </span>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sélectionnez un marché ci-dessus</p>
                )}
              </div>
            </div>

            {/* ─── Marché Droit ─── */}
            <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-card shadow-md">
              {/* Photo en arrière-plan */}
              {rightData && (
                <img
                  src={getMarketPhoto(rightData.name)}
                  alt={rightData.name}
                  className="absolute inset-0 h-full w-full object-cover opacity-15"
                />
              )}
              <div className="relative p-5">
                {/* Sélecteur de marché droit */}
                <div className="relative mb-3">
                  <label className="text-xs font-bold text-red-700 dark:text-red-400 mb-1 block">
                    <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
                    Marché B (Droite)
                  </label>
                  <div className="relative">
                    <select
                      value={marketRight}
                      onChange={(e) => setMarketRight(e.target.value)}
                      className="h-10 w-full appearance-none rounded-xl border-2 border-red-500/40 bg-card px-3 pr-8 text-sm font-semibold outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/30 cursor-pointer"
                    >
                      <option value="">— Sélectionner un marché —</option>
                      {bars.map((b) => (
                        <option key={b.id} value={b.id} disabled={b.id === marketLeft}>
                          {tm(b.name)} — {fbu(b.prix)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 pointer-events-none text-muted-foreground" />
                  </div>
                </div>

                {/* Affichage des données du marché droit */}
                {rightData ? (
                  <>
                    <h3 className="text-xl font-extrabold text-foreground">{tm(rightData.name)}</h3>
                    <p className={`mt-1 text-3xl font-black tabular-nums ${!leftCheaper ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {fbu(rightData.prix)}
                    </p>
                    {!leftCheaper && leftData?.id !== rightData?.id && (
                      <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        ✅ Moins cher
                      </span>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sélectionnez un marché ci-dessus</p>
                )}
              </div>
            </div>
          </div>

          {/* Bandeau récapitulatif de l'écart de prix */}
          {leftData && rightData && leftData.id !== rightData.id && (
            <div className={`mt-4 rounded-xl border p-4 flex items-center justify-between ${
              difference > 0 ? "border-orange-300/50 bg-orange-50/80 dark:bg-orange-950/20" : "border-emerald-300/50 bg-emerald-50/80"
            }`}>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-orange-600" />
                <span className="text-sm font-bold text-foreground">
                  Écart de prix constaté entre {tm(marketLeft ? mkt[marketLeft] : "")} et {tm(marketRight ? mkt[marketRight] : "")} :
                </span>
              </div>
              <span className="text-lg font-black text-orange-600 tabular-nums">
                +{fbu(difference)} (+{percentDiff}%)
              </span>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════
            GRAPHIQUE EN BARRES DE TOUS LES MARCHÉS
        ═══════════════════════════════════════════════ */}
        <div className="mb-10 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">Classement de tous les marchés</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Cliquez sur une barre pour ajouter ce marché aux courbes de tendance
          </p>
          <div style={{ width: "100%", height: Math.max(300, bars.length * 28) }}>
            <ResponsiveContainer>
              <BarChart data={bars} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${v} FBu`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} />
                <Tooltip formatter={(val: number) => [`${fbu(val)}`, "Prix constaté"]} contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }} />
                <Bar
                  dataKey="prix"
                  radius={[0, 4, 4, 0]}
                  onClick={(entry: any) => toggleExtra(entry.id)}
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
              Évolution des prix sur 180 jours
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Courbe comparative des marchés sélectionnés
            </p>
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer>
                <LineChart data={lines} margin={{ top: 15, right: 30, left: 15, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d) => {
                      const parts = d.split("-");
                      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
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
                  {chartMarketIds.map((k, i) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      stroke={VIBRANT_COLORS[i % VIBRANT_COLORS.length]}
                      strokeWidth={3}
                      dot={{ r: 4, strokeWidth: 1.5, fill: "#fff" }}
                      activeDot={{ r: 6, stroke: VIBRANT_COLORS[i % VIBRANT_COLORS.length], strokeWidth: 2 }}
                      connectNulls={true}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed bg-card/50 p-8 text-center text-sm text-muted-foreground">
            Sélectionnez deux marchés pour voir l'évolution comparative sur 180 jours.
          </div>
        )}
      </Page>
    </>
  );
}
