import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, useSeries, fbu } from "@/lib/data";
import { Page, PageTitle } from "@/components/bits";
import { useI18n } from "@/lib/i18n";
import { PRODUCT_IMAGES, getProductFallback, getMarketPhoto } from "@/lib/images";
import { ArrowLeftRight, CheckCircle2, AlertTriangle, TrendingDown } from "lucide-react";

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

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function ComparaisonPage() {
  const { t, tm, tp } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const d = ref.data;
  const [productId, setProductId] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  useEffect(() => { if (!productId && d?.products[0]) setProductId(d.products[0].id); }, [d, productId]);
  const series = useSeries(productId || undefined, 180);
  const mkt = useMemo(() => Object.fromEntries((d?.markets ?? []).map((m) => [m.id, m.name])), [d]);

  const bars = (latest.data ?? []).filter((l) => l.product_id === productId)
    .map((l) => ({ name: mkt[l.market_id] ?? "?", id: l.market_id, prix: Number(l.unit_price) }))
    .sort((a, b) => a.prix - b.prix);
  useEffect(() => { if (bars.length && !sel.length) setSel([bars[0]!.id, bars[bars.length - 1]!.id]); }, [bars, sel.length]);
  useEffect(() => setSel([]), [productId]);

  const lines = useMemo(() => {
    const by: Record<string, Record<string, number | string>> = {};
    (series.data ?? []).filter((r) => sel.includes(r.market_id)).forEach((r) => { (by[r.day] ??= { day: r.day })[r.market_id] = Number(r.price); });
    return Object.values(by).sort((a, b) => String(a['day']).localeCompare(String(b['day'])));
  }, [series.data, sel]);

  const min = bars[0], max = bars[bars.length - 1];
  const toggle = (id: string) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 5 ? s : [...s, id]);

  const selectedProduct = d?.products.find((p) => p.id === productId);
  const prodPhoto = selectedProduct ? (PRODUCT_IMAGES[selectedProduct.name] || getProductFallback(selectedProduct.name)) : "";
  const difference = (min && max) ? (max.prix - min.prix) : 0;
  const percentDiff = (min && max && min.prix > 0) ? Math.round((difference / min.prix) * 100) : 0;

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
          sub={`Comparatif en direct pour ${selectedProduct ? tp(selectedProduct.name) : "le produit"}`}
        />

        {/* ═══════════════════════════════════════════════
            DUEL VISUEL : MEILLEUR PRIX VS PRIX LE PLUS ÉLEVÉ
        ═══════════════════════════════════════════════ */}
        {min && max && (
          <div className="mb-8 grid gap-4 md:grid-cols-2">
            {/* Carte Marché le Moins Cher */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-card p-6 shadow-md">
              <img
                src={getMarketPhoto(min.name)}
                alt={min.name}
                className="absolute inset-0 h-full w-full object-cover opacity-15"
              />
              <div className="relative">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Meilleure Offre (Moins cher)
                </span>
                <h3 className="mt-3 text-2xl font-extrabold text-foreground">{tm(min.name)}</h3>
                <p className="mt-1 text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {fbu(min.prix)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Économie immédiate constatée par rapport au marché le plus cher du pays.
                </p>
              </div>
            </div>

            {/* Carte Marché le Plus Cher */}
            <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-card p-6 shadow-md">
              <img
                src={getMarketPhoto(max.name)}
                alt={max.name}
                className="absolute inset-0 h-full w-full object-cover opacity-15"
              />
              <div className="relative">
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Prix le plus élevé
                </span>
                <h3 className="mt-3 text-2xl font-extrabold text-foreground">{tm(max.name)}</h3>
                <p className="mt-1 text-3xl font-black text-red-600 dark:text-red-400 tabular-nums">
                  {fbu(max.prix)}
                </p>
                <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Écart de +{fbu(difference)} (+{percentDiff}%)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            GRAPHIQUE EN BARRES DES MARCHÉS
        ═══════════════════════════════════════════════ */}
        <div className="mb-10 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-bold">Classement des prix par marché</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Cliquez sur un marché pour l'ajouter ou le retirer du comparatif d'évolution temporelle
          </p>
          <div style={{ width: "100%", height: Math.max(300, bars.length * 28) }}>
            <ResponsiveContainer>
              <BarChart data={bars} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `${v} FBu`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip formatter={(val: number) => [`${fbu(val)}`, "Prix"]} contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }} />
                <Bar
                  dataKey="prix"
                  fill="var(--primary)"
                  radius={[0, 4, 4, 0]}
                  onClick={(entry: any) => toggle(entry.id)}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════
            COURBES TEMPORELLES COMPARATIVES
        ═══════════════════════════════════════════════ */}
        {lines.length > 0 && (
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-bold">Courbes d'évolution comparées (180 jours)</h2>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <LineChart data={lines} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number) => [`${fbu(val)}`, ""]} contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }} />
                  <Legend formatter={(id) => tm(mkt[id] ?? id)} />
                  {sel.map((k, i) => (
                    <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} strokeWidth={2.5} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Page>
    </>
  );
}
