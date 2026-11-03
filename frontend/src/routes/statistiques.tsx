import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, fbu, PROVINCE_COLORS } from "@/lib/data";
import { Delta, Page, PageTitle, Stat } from "@/components/bits";
import { useI18n } from "@/lib/i18n";
import { getProductImage, getProductFallback } from "@/lib/images";
import { TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/statistiques")({
  head: () => ({
    meta: [
      { title: "Statistiques nationales — Burundi Food Price" },
      {
        name: "description",
        content:
          "Indice des prix alimentaires, moyennes par province et plus fortes hausses et baisses au Burundi.",
      },
      { property: "og:title", content: "Statistiques nationales — Burundi Food Price" },
      {
        property: "og:description",
        content: "Indice national, moyennes par province, hausses et baisses sur 30 jours.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatsPage,
});

const FALLBACK_PALETTE = ["#16a34a", "#2563eb", "#ea580c", "#9333ea", "#0891b2", "#dc2626", "#ca8a04"];

function provinceFill(name: string, index: number): string {
  return PROVINCE_COLORS[name] ?? FALLBACK_PALETTE[index % FALLBACK_PALETTE.length]!;
}

function StatsPage() {
  const { t, tp } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const d = ref.data;

  const s = useMemo(() => {
    if (!d || !latest.data) return null;
    const mProv = Object.fromEntries(d.markets.map((m) => [m.id, m.province_id]));
    const pName = Object.fromEntries(d.provinces.map((p) => [p.id, p.name]));
    const byProd: Record<string, { cur: number[]; prev: number[]; prov: Record<string, number[]> }> =
      {};

    latest.data.forEach((l) => {
      const x = (byProd[l.product_id] ??= { cur: [], prev: [], prov: {} });
      x.cur.push(Number(l.unit_price));
      if (l.prev_price) x.prev.push(Number(l.prev_price));
      const province = pName[mProv[l.market_id] ?? ""] ?? null;
      if (province) (x.prov[province] ??= []).push(Number(l.unit_price));
    });

    const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

    const prods = d.products
      .map((p) => {
        const x = byProd[p.id];
        const cur = avg(x?.cur ?? []);
        const prev = avg(x?.prev ?? []);
        const prov: Record<string, number | string> = { name: p.name };
        Object.entries(x?.prov ?? {}).forEach(([k, v]) => {
          const a = avg(v);
          if (a != null) prov[k] = Math.round(a);
        });
        const ch = cur != null && prev != null && prev > 0 ? ((cur - prev) / prev) * 100 : null;
        return { p, cur, prev, ch, prov };
      })
      .filter((x) => x.cur != null);

    // Provinces réellement présentes dans les prix validés (pas toute la légende vide)
    const provincesWithData = [
      ...new Set(
        prods.flatMap((x) =>
          Object.keys(x.prov).filter((k) => k !== "name" && typeof x.prov[k] === "number"),
        ),
      ),
    ].sort((a, b) => a.localeCompare(b, "fr"));

    const chartData = prods.map((x) => {
      const row: Record<string, string | number | null> = { name: x.p.name };
      for (const prov of provincesWithData) {
        const v = x.prov[prov];
        row[prov] = typeof v === "number" ? v : null;
      }
      return row;
    });

    const changes = prods.filter(
      (x): x is typeof x & { ch: number } => typeof x.ch === "number" && isFinite(x.ch),
    );
    const index = changes.length ? changes.reduce((a, x) => a + x.ch, 0) / changes.length : null;
    const sorted = [...changes].sort((a, b) => b.ch - a.ch);

    return {
      prods,
      chartData,
      provincesWithData,
      index,
      up: sorted.slice(0, 5),
      down: sorted.slice(-5).reverse(),
      upN: changes.filter((x) => x.ch > 0.5).length,
      downN: changes.filter((x) => x.ch < -0.5).length,
    };
  }, [d, latest.data]);

  if (!s) {
    return (
      <Page>
        <p className="text-muted-foreground">{t("loading")}</p>
      </Page>
    );
  }

  return (
    <Page>
      <PageTitle title={t("nationalStatsTitle")} sub={t("nationalStatsSub")} />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("nationalIndex30d")} value={<Delta v={s.index} />} hint={t("nationalIndexHint")} />
        <Stat label={t("risingProducts")} value={s.upN} />
        <Stat label={t("fallingProducts")} value={s.downN} />
        <Stat label={t("marketsFollowed")} value={d?.markets.filter((m) => m.active).length} />
      </div>

      <div className="mb-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950/40">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">Plus fortes hausses (30 jours)</h2>
              <p className="text-xs text-muted-foreground">
                Produits subissant une forte pression à la hausse
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {s.up.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pas assez d’historique (prix précédent) pour calculer des hausses.
              </p>
            ) : (
              s.up.map((x) => {
                const photo = getProductImage(x.p.name);
                return (
                  <div
                    key={x.p.id}
                    className="flex items-center justify-between rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={photo}
                        alt={x.p.name}
                        referrerPolicy="no-referrer"
                        className="h-11 w-11 rounded-lg object-cover shadow-2xs"
                        onError={(e) => {
                          (e.target as HTMLImageElement).onerror = null;
                          (e.target as HTMLImageElement).src = getProductFallback(x.p.name);
                        }}
                      />
                      <div>
                        <p className="text-sm font-semibold">{tp(x.p.name)}</p>
                        <p className="text-xs font-bold text-primary">
                          {fbu(x.cur!)}/{x.p.default_unit}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                      +{Math.abs(Number(x.ch)).toFixed(1)}%
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40">
              <TrendingDown className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">Plus fortes baisses (30 jours)</h2>
              <p className="text-xs text-muted-foreground">
                Opportunités d’achat : cours orientés à la baisse
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {s.down.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Pas assez d’historique (prix précédent) pour calculer des baisses.
              </p>
            ) : (
              s.down.map((x) => {
                const photo = getProductImage(x.p.name);
                return (
                  <div
                    key={x.p.id}
                    className="flex items-center justify-between rounded-xl border bg-background p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={photo}
                        alt={x.p.name}
                        referrerPolicy="no-referrer"
                        className="h-11 w-11 rounded-lg object-cover shadow-2xs"
                        onError={(e) => {
                          (e.target as HTMLImageElement).onerror = null;
                          (e.target as HTMLImageElement).src = getProductFallback(x.p.name);
                        }}
                      />
                      <div>
                        <p className="text-sm font-semibold">{tp(x.p.name)}</p>
                        <p className="text-xs font-bold text-primary">
                          {fbu(x.cur!)}/{x.p.default_unit}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      -{Math.abs(Number(x.ch)).toFixed(1)}%
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-bold">Moyennes des prix par province (FBu)</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Prix moyens issus des collectes validées, produit × province. Seules les provinces avec
          données apparaissent.
        </p>
        {s.provincesWithData.length === 0 || s.chartData.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aucun prix validé pour construire le graphique. Validez des collectes sur plusieurs
            marchés / provinces.
          </p>
        ) : (
          <>
            {s.provincesWithData.length === 1 && (
              <p className="mb-3 rounded-lg border border-sky-300/50 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
                Une seule province a des prix validés pour l’instant ({s.provincesWithData[0]}). Les
                autres apparaîtront dès qu’il y aura des collectes validées.
              </p>
            )}
            <div style={{ width: "100%", height: Math.max(320, 80 + s.chartData.length * 28) }}>
              <ResponsiveContainer>
                <BarChart
                  data={s.chartData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 60 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-35}
                    textAnchor="end"
                    tick={{ fontSize: 11 }}
                    height={70}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}`}
                    label={{ value: "FBu", angle: -90, position: "insideLeft", offset: 0 }}
                  />
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      val == null ? "—" : fbu(val),
                      name,
                    ]}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }} />
                  {s.provincesWithData.map((p, i) => (
                    <Bar
                      key={p}
                      dataKey={p}
                      name={p}
                      fill={provinceFill(p, i)}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={48}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
