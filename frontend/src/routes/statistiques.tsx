import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, fbu, pct, PROVINCE_COLORS } from "@/lib/data";
import { Delta, Page, PageTitle, Stat } from "@/components/bits";
import { useI18n } from "@/lib/i18n";
import { PRODUCT_IMAGES, getProductFallback } from "@/lib/images";
import { TrendingUp, TrendingDown, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";

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
  const { t, tp } = useI18n();
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

      {/* Cartes de statistiques clés */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("nationalIndex30d")} value={<Delta v={s.index} />} hint={t("nationalIndexHint")} />
        <Stat label={t("risingProducts")} value={s.upN} />
        <Stat label={t("fallingProducts")} value={s.downN} />
        <Stat label={t("marketsFollowed")} value={d?.markets.filter((m) => m.active).length} />
      </div>

      {/* ═══════════════════════════════════════════════
          PODIUMS VISUELS : PLUS FORTES HAUSSES & BAISSES
      ═══════════════════════════════════════════════ */}
      <div className="mb-10 grid gap-6 md:grid-cols-2">
        {/* Plus fortes hausses */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/40">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">Plus fortes hausses (30 jours)</h2>
              <p className="text-xs text-muted-foreground">Produits subissant une forte pression à la hausse</p>
            </div>
          </div>

          <div className="space-y-3">
            {s.up.map((x) => {
              const photo = PRODUCT_IMAGES[x.p.name] || getProductFallback(x.p.name);
              return (
                <div key={x.p.id} className="flex items-center justify-between rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <img src={photo} alt={x.p.name} className="h-11 w-11 rounded-lg object-cover shadow-2xs" />
                    <div>
                      <p className="text-sm font-semibold">{tp(x.p.name)}</p>
                      <p className="text-xs font-bold text-primary">{fbu(x.cur!)}/{x.p.default_unit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      +{x.ch!.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Plus fortes baisses */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
              <TrendingDown className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">Plus fortes baisses (30 jours)</h2>
              <p className="text-xs text-muted-foreground">Opportunités d'achat : cours orientés à la baisse</p>
            </div>
          </div>

          <div className="space-y-3">
            {s.down.map((x) => {
              const photo = PRODUCT_IMAGES[x.p.name] || getProductFallback(x.p.name);
              return (
                <div key={x.p.id} className="flex items-center justify-between rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <img src={photo} alt={x.p.name} className="h-11 w-11 rounded-lg object-cover shadow-2xs" />
                    <div>
                      <p className="text-sm font-semibold">{tp(x.p.name)}</p>
                      <p className="text-xs font-bold text-primary">{fbu(x.cur!)}/{x.p.default_unit}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {x.ch!.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════
          MOYENNES DES PRIX PAR PROVINCE
      ═══════════════════════════════════════════════ */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Moyennes des prix par province (FBu)</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Comparaison territoriale de l'accessibilité des produits de première nécessité
        </p>
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <BarChart data={s.prods.map((x) => x.prov)} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" interval={0} angle={-35} textAnchor="end" tick={{ fontSize: 11 }} height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val: number) => [`${fbu(val)}`, ""]} contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }} />
              <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
              {s.provinces.map((p, i) => (
                <Bar key={p} dataKey={p} fill={PROVINCE_COLORS[i % PROVINCE_COLORS.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Page>
  );
}
