import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, useSeries, fbu, pct, fmtDate } from "@/lib/data";
import { Avail, Delta, Page, PageTitle, Stat } from "@/components/bits";
import { useI18n } from "@/lib/i18n";

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

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function ProduitsPage() {
  const { t, tm, tp, lang } = useI18n();
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

  const { chart, keys } = useMemo(() => {
    const s = series.data ?? [];
    const count: Record<string, number> = {};
    s.forEach((r) => (count[r.market_id] = (count[r.market_id] ?? 0) + 1));
    const keys = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const byDay: Record<string, Record<string, number | string>> = {};
    s.filter((r) => keys.includes(r.market_id)).forEach((r) => {
      (byDay[r.day] ??= { day: r.day })[r.market_id] = Number(r.price);
    });
    return { chart: Object.values(byDay).sort((a, b) => String(a['day']).localeCompare(String(b['day']))), keys };
  }, [series.data]);

  const avg = current.length ? current.reduce((a, c) => a + Number(c.unit_price), 0) / current.length : null;
  const unit = current[0]?.unit ?? d?.products.find((p) => p.id === productId)?.default_unit ?? "kg";

  return (
    <Page>
      <PageTitle title={t("priceTrackingTitle")} sub={t("priceTrackingSub")}>
        <div className="flex flex-wrap gap-2">
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className="h-10 rounded-md border bg-card px-2 text-sm">
            {d?.products.map((p) => <option key={p.id} value={p.id}>{tp(p.name)}</option>)}
          </select>
          <div className="flex rounded-md border bg-card p-0.5">
            {periods.map((p) => (
              <button key={p.d} onClick={() => setDays(p.d)}
                className={`rounded px-3 text-sm ${days === p.d ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{p.l}</button>
            ))}
          </div>
        </div>
      </PageTitle>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label={t("avgPriceCurrent")} value={avg ? `${fbu(avg)}/${unit}` : "—"} />
        <Stat label={t("cheapest")} value={current[0] ? fbu(current[0].unit_price) : "—"} hint={current[0] && tm(mktName[current[0].market_id])} />
        <Stat label={t("mostExpensive")} value={current.at(-1) ? fbu(current.at(-1)!.unit_price) : "—"} hint={current.at(-1) && tm(mktName[current.at(-1)!.market_id])} />
      </div>

      <div className="mb-8 rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-lg font-bold">{t("priceEvolution")} ({unit})</h2>
        <div className="h-80">
          {series.isLoading ? <div className="h-full animate-pulse rounded bg-muted" /> : chart.length === 0 ? (
            <p className="grid h-full place-items-center text-muted-foreground">{t("noDataPeriod")}</p>
          ) : (
            <ResponsiveContainer>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tickFormatter={(v) => new Date(v).toLocaleDateString(lang === "rn" ? "rn-BI" : lang === "en" ? "en-US" : "fr-FR", { day: "2-digit", month: "short" })} fontSize={12} />
                <YAxis fontSize={12} width={60} />
                <Tooltip formatter={(v: number) => fbu(v)} labelFormatter={(v) => fmtDate(String(v))} />
                <Legend />
                {keys.map((k, i) => (
                  <Line key={k} dataKey={k} name={tm(mktName[k] ?? k)} stroke={COLORS[i % 5]} dot={false} strokeWidth={2} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <h2 className="mb-3 text-2xl font-bold">{t("currentPricesByMarket")}</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">{t("market")}</th>
              <th className="p-3 text-right">{t("price")}</th>
              <th className="p-3 text-right">{t("variation")}</th>
              <th className="p-3">{t("availability")}</th>
              <th className="p-3">{t("record")}</th>
            </tr>
          </thead>
          <tbody>
            {current.map((c) => (
              <tr key={c.market_id} className="border-t">
                <td className="p-3 font-medium">{tm(mktName[c.market_id])}</td>
                <td className="p-3 text-right tabular-nums">{fbu(c.unit_price)}/{c.unit}</td>
                <td className="p-3 text-right"><Delta v={pct(c.unit_price, c.prev_price)} /></td>
                <td className="p-3"><Avail v={c.availability} /></td>
                <td className="p-3 text-muted-foreground">{fmtDate(c.observed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Page>
  );
}
