import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, useSeries, fbu, pct, fmtDate } from "@/lib/data";
import { Avail, Delta, Page, Stat } from "@/components/bits";
import { useI18n } from "@/lib/i18n";
import { PRODUCT_IMAGES, getProductFallback } from "@/lib/images";
import { TrendingUp, TrendingDown, Minus, MapPin, Calendar, ArrowRight, BarChart3, LineChart as ChartIcon } from "lucide-react";

export const Route = createFileRoute("/produits")({
  head: () => ({
    meta: [
      { title: "Suivi des prix par produit — Burundi Food Price" },
      { name: "description", content: "Évolution des prix du riz, du haricot, du maïs et des autres produits vivriers dans les marchés du Burundi." },
      { property: "og:title", content: "Suivi des prix par produit — Burundi" },
      { property: "og:description", content: "Courbes d'évolution et prix actuels marché par marché." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProduitsPage,
});

// Couleurs vives et contrastées avec support universel SVG
const VIBRANT_COLORS = [
  "#2563eb", // Bleu royal
  "#16a34a", // Vert émeraude
  "#ea580c", // Orange vif
  "#9333ea", // Violet
  "#dc2626", // Rouge vermillon
  "#0891b2", // Cyan
  "#d97706", // Ambre
];

function ProduitsPage() {
  const { t, tm, tp } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const d = ref.data;
  const [productId, setProductId] = useState("");
  const [days, setDays] = useState(90);

  const periods = [
    { d: 30, l: t("days30") },
    { d: 90, l: t("months3") },
    { d: 180, l: t("months6") },
    { d: 365, l: t("year1") },
  ];

  useEffect(() => {
    if (!productId && d?.products[0]) setProductId(d.products[0].id);
  }, [d, productId]);

  const series = useSeries(productId || undefined, days);
  const mktName = useMemo(() => Object.fromEntries((d?.markets ?? []).map((m) => [m.id, m.name])), [d]);
  const current = (latest.data ?? []).filter((l) => l.product_id === productId).sort((a, b) => a.unit_price - b.unit_price);

  const { chart, keys, minPrice, maxPrice } = useMemo(() => {
    const s = series.data ?? [];
    const count: Record<string, number> = {};
    s.forEach((r) => (count[r.market_id] = (count[r.market_id] ?? 0) + 1));
    const keys = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const byDay: Record<string, Record<string, number | string>> = {};
    let min = Infinity;
    let max = -Infinity;

    s.filter((r) => keys.includes(r.market_id)).forEach((r) => {
      const p = Number(r.price);
      if (p > 0) {
        if (p < min) min = p;
        if (p > max) max = p;
        (byDay[r.day] ??= { day: r.day })[r.market_id] = p;
      }
    });

    const rows = Object.values(byDay).sort((a, b) => String(a['day']).localeCompare(String(b['day'])));
    return { 
      chart: rows, 
      keys, 
      minPrice: isFinite(min) ? Math.floor(min * 0.9 / 100) * 100 : 0, 
      maxPrice: isFinite(max) ? Math.ceil(max * 1.1 / 100) * 100 : 10000 
    };
  }, [series.data]);

  const selectedProduct = d?.products.find((p) => p.id === productId);
  const prodPhoto = selectedProduct ? (PRODUCT_IMAGES[selectedProduct.name] || getProductFallback(selectedProduct.name)) : "";
  const avg = current.length ? Math.round(current.reduce((a, c) => a + Number(c.unit_price), 0) / current.length) : null;
  const unit = current[0]?.unit ?? selectedProduct?.default_unit ?? "kg";
  const minMarket = current[0];
  const maxMarket = current[current.length - 1];

  return (
    <>
      {/* ═══════════════════════════════════════════════
          BANDEAU HORIZONTAL DE SÉLECTION PRODUITS AVEC PHOTOS
      ═══════════════════════════════════════════════ */}
      <section className="border-b bg-card shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Sélectionnez un produit vivrier :
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
                  <img
                    src={photo}
                    alt={p.name}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                  <span>{tp(p.name)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Page>
        {/* ═══════════════════════════════════════════════
            FICHE DU PRODUIT SÉLECTIONNÉ
        ═══════════════════════════════════════════════ */}
        {selectedProduct && (
          <div className="mb-8 overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="grid md:grid-cols-3">
              {/* Photo du produit */}
              <div className="relative h-56 md:h-full min-h-[220px] bg-muted overflow-hidden">
                <img
                  src={prodPhoto}
                  alt={selectedProduct.name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent md:hidden" />
                <div className="absolute bottom-3 left-4 text-white md:hidden">
                  <h1 className="text-2xl font-bold">{tp(selectedProduct.name)}</h1>
                  <p className="text-xs text-white/80">{selectedProduct.name}</p>
                </div>
              </div>

              {/* Statistiques clés du produit */}
              <div className="p-6 md:col-span-2 flex flex-col justify-between">
                <div>
                  <div className="hidden md:block">
                    <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                      Fiche Produit Vivrier
                    </span>
                    <h1 className="mt-1 text-3xl font-extrabold text-foreground">
                      {tp(selectedProduct.name)}
                    </h1>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border bg-background p-3.5 shadow-2xs">
                      <span className="text-xs text-muted-foreground">Prix Moyen National</span>
                      <p className="mt-1 text-2xl font-bold text-primary tabular-nums">
                        {avg ? fbu(avg) : "—"}
                        <span className="text-xs font-normal text-muted-foreground">/{unit}</span>
                      </p>
                    </div>

                    {minMarket && (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 shadow-2xs">
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          🟢 Le moins cher
                        </span>
                        <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums truncate">
                          {fbu(minMarket.unit_price)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {mktName[minMarket.market_id]}
                        </p>
                      </div>
                    )}

                    {maxMarket && (
                      <div className="rounded-xl border border-red-500/20 bg-red-50/50 dark:bg-red-950/20 p-3.5 shadow-2xs">
                        <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                          🔴 Le plus cher
                        </span>
                        <p className="mt-1 text-lg font-bold text-red-700 dark:text-red-300 tabular-nums truncate">
                          {fbu(maxMarket.unit_price)}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {mktName[maxMarket.market_id]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Période d'analyse :
                  </span>
                  <div className="flex rounded-lg border bg-background p-0.5">
                    {periods.map((p) => (
                      <button
                        key={p.d}
                        type="button"
                        onClick={() => setDays(p.d)}
                        className={`rounded-md px-2.5 py-1 font-semibold transition-all ${
                          days === p.d ? "bg-primary text-primary-foreground shadow-2xs" : "hover:bg-muted"
                        }`}
                      >
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            GRAPHIQUE D'ÉVOLUTION DANS LE TEMPS AVEC VALEURS ET COURBES VISIBLES
        ═══════════════════════════════════════════════ */}
        <div className="mb-10 rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ChartIcon className="h-5 w-5 text-primary" />
                Évolution temporelle sur les principaux marchés
              </h2>
              <p className="text-xs text-muted-foreground">
                Comparaison dynamique des cours sur les 5 marchés les plus actifs ({days} jours)
              </p>
            </div>
            {chart.length > 0 && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary self-start sm:self-auto">
                {chart.length} relevés chronologiques
              </span>
            )}
          </div>

          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              <LineChart data={chart} margin={{ top: 15, right: 30, left: 15, bottom: 10 }}>
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
                  formatter={(val: number) => [`${fbu(val)}/${unit}`, "Prix"]}
                  labelFormatter={(lbl) => `Date du relevé : ${lbl}`}
                  contentStyle={{ backgroundColor: "var(--card)", borderRadius: "10px", border: "1px solid var(--border)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                />
                <Legend 
                  formatter={(id) => <span className="text-xs font-semibold text-foreground">{tm(mktName[id] ?? id)}</span>} 
                  wrapperStyle={{ paddingTop: "12px" }} 
                />
                {keys.map((k, i) => (
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

        {/* ═══════════════════════════════════════════════
            TABLEAU COMPARATIF DES MARCHÉS
        ═══════════════════════════════════════════════ */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="text-lg font-bold">Prix actuels constatés marché par marché</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3.5">Marché</th>
                  <th className="p-3.5 text-right">Prix constaté</th>
                  <th className="p-3.5 text-right">Variation</th>
                  <th className="p-3.5 text-center">Disponibilité</th>
                  <th className="p-3.5 text-right">Relevé le</th>
                </tr>
              </thead>
              <tbody>
                {current.map((c) => (
                  <tr key={c.market_id} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-semibold text-foreground flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {tm(mktName[c.market_id])}
                    </td>
                    <td className="p-3.5 text-right tabular-nums font-bold text-primary">
                      {fbu(c.unit_price)}/{c.unit}
                    </td>
                    <td className="p-3.5 text-right">
                      <Delta v={pct(c.unit_price, c.prev_price)} />
                    </td>
                    <td className="p-3.5 text-center">
                      <Avail v={c.availability} />
                    </td>
                    <td className="p-3.5 text-right text-xs text-muted-foreground">
                      {fmtDate(c.observed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Page>
    </>
  );
}
