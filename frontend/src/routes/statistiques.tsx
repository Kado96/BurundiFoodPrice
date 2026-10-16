import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, fbu, pct, PROVINCE_COLORS } from "@/lib/data";
import { Delta, Page, PageTitle, Stat } from "@/components/bits";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/statistiques")({
  head: () => ({ meta: [
    { title: "Statistiques nationales — Burundi Food Price" },
    { name: "description", content: "Indice des prix alimentaires, moyennes par province et plus fortes hausses et baisses au Burundi." },
    { property: "og:title", content: "Statistiques nationales — Burundi Food Price" },
    { property: "og:description", content: "Indice national, moyennes par province, hausses et baisses sur 30 jours." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: StatsPage,
});

function StatsPage() {
  const { t } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const d = ref.data;

  const s = useMemo(() => {
    if (!d || !latest.data) return null;
    const mProv = Object.fromEntries(d.markets.map((m) => [m.id, m.province_id]));
    const pName = Object.fromEntries(d.provinces.map((p) => [p.id, p.name]));
    const byProd: Record<string, { cur: number[]; prev: number[]; prov: Record<string, number[]> }> = {};
    latest.data.forEach((l) => {
      const x = (byProd[l.product_id] ??= { cur: [], prev: [], prov: {} });
      x.cur.push(Number(l.unit_price));
      if (l.prev_price) x.prev.push(Number(l.prev_price));
      (x.prov[pName[mProv[l.market_id] ?? ""] ?? "?"] ??= []).push(Number(l.unit_price));
    });
    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const prods = d.products.map((p) => {
      const x = byProd[p.id];
      const cur = avg(x?.cur ?? []), prev = avg(x?.prev ?? []);
      const prov: Record<string, number | string> = { name: p.name };
      Object.entries(x?.prov ?? {}).forEach(([k, v]) => (prov[k] = Math.round(avg(v)!)));
      return { p, cur, prev, ch: cur != null ? pct(cur, prev) : null, prov };
    }).filter((x) => x.cur != null);
    const changes = prods.filter((x) => x.ch != null);
    const index = changes.length ? changes.reduce((a, x) => a + x.ch!, 0) / changes.length : null;
    const sorted = [...changes].sort((a, b) => b.ch! - a.ch!);
    return { prods, index, up: sorted.slice(0, 5), down: sorted.slice(-5).reverse(), provinces: d.provinces.map((p) => p.name), upN: changes.filter((x) => x.ch! > 0.5).length, downN: changes.filter((x) => x.ch! < -0.5).length };
  }, [d, latest.data]);

  if (!s) return <Page><p className="text-muted-foreground">{t("loading")}</p></Page>;
  return (
    <Page>
      <PageTitle title={t("nationalStatsTitle")} sub={t("nationalStatsSub")} />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label={t("nationalIndex30d")} value={<Delta v={s.index} />} hint={t("nationalIndexHint")} />
        <Stat label={t("risingProducts")} value={s.upN} />
        <Stat label={t("fallingProducts")} value={s.downN} />
        <Stat label={t("marketsFollowed")} value={d?.markets.filter((m) => m.active).length} />
      </div>
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {[{ t: t("highestIncreases"), l: s.up }, { t: t("highestDecreases"), l: s.down }].map((b) => (
          <div key={b.t} className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 font-bold">{b.t}</h2>
            <div className="space-y-2">
              {b.l.map((x) => (
                <div key={x.p.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-b-0">
                  <span className="font-medium">{x.p.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums text-muted-foreground">{fbu(x.cur!)}/{x.p.default_unit}</span>
                    <Delta v={x.ch} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-lg font-bold">{t("provincialAverages")}</h2>
        <div className="h-96">
          <ResponsiveContainer>
            <BarChart data={s.prods.map((x) => x.prov)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => fbu(v)} />
              <Tooltip formatter={(v: number) => fbu(v)} />
              <Legend />
              {s.provinces.map((pr, i) => (
                <Bar key={pr} dataKey={pr} fill={PROVINCE_COLORS[i % PROVINCE_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Page>
  );
}
