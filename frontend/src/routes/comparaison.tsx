import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, useSeries, fbu } from "@/lib/data";
import { Page, PageTitle, Stat } from "@/components/bits";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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

  return (
    <Page>
      <PageTitle title={t("comparisonTitle")} sub={t("comparisonSub")}>
        <select
          id="compare-product-select"
          name="compare_product"
          aria-label={t("productLabel")}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="h-10 rounded-md border bg-card px-2 text-sm shadow-xs"
        >
          {d?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </PageTitle>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t("cheapest")} value={fbu(min?.prix)} hint={min?.name} />
        <Stat label={t("mostExpensive")} value={fbu(max?.prix)} hint={max?.name} />
        <Stat label={t("priceGap")} value={min && max ? `${Math.round(((max.prix - min.prix) / min.prix) * 100)} %` : "—"} hint={t("priceGapSub")} />
      </div>
      <section className="mb-8 rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-lg font-bold">{t("currentPriceByMarket")}</h2>
        <div className="h-[380px]">
          {bars.length === 0 ? <p className="grid h-full place-items-center text-muted-foreground">{t("noDataProduct")}</p> : (
            <ResponsiveContainer>
              <BarChart data={bars} layout="vertical" margin={{ left: 80, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" fontSize={12} tickFormatter={(v) => fbu(v)} />
                <YAxis dataKey="name" type="category" fontSize={12} width={120} />
                <Tooltip formatter={(v: number) => fbu(v)} />
                <Bar dataKey="prix" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-1 text-lg font-bold">{t("history")} (6 {t("months3").replace("3", "6")})</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("selectMarketsToCompare")}</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {bars.map((b) => (
            <button key={b.id} onClick={() => toggle(b.id)}
              className={`rounded-full border px-3 py-1 text-xs ${sel.includes(b.id) ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}>{b.name}</button>
          ))}
        </div>
        <div className="h-80">
          <ResponsiveContainer>
            <LineChart data={lines}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} width={60} />
              <Tooltip formatter={(v: number) => fbu(v)} />
              <Legend />
              {sel.map((id, i) => (
                <Line key={id} dataKey={id} name={mkt[id] ?? id} stroke={COLORS[i % 5]} dot={false} strokeWidth={2} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </Page>
  );
}
