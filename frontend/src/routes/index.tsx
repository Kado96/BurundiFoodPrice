import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Search, BarChart3, Package, Table as TableIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { useLatest, useRef, fbu, pct, fmtDate } from "@/lib/data";
import { Avail, Delta, Page, Stat } from "@/components/bits";
import { LazyMap } from "@/components/LazyMap";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isMobilePlatform, hasOptedForPublicWeb } from "@/lib/mobile";
import { MarketHeroCarousel } from "@/components/MarketHeroCarousel";
import { ProductPhotoGrid } from "@/components/ProductPhotoGrid";
import { PRODUCT_IMAGES, getProductFallback } from "@/lib/images";

export const Route = createFileRoute("/")(
  {
    head: () => ({
      meta: [
        { title: "Burundi Food Price — Prix alimentaires des marchés" },
        { name: "description", content: "Combien coûte aujourd'hui le riz, le haricot ou le maïs dans chaque marché du Burundi ? Prix vérifiés, cartes et tendances." },
        { property: "og:title", content: "Burundi Food Price — Prix alimentaires des marchés" },
        { property: "og:description", content: "Prix vérifiés des produits vivriers dans les marchés du Burundi." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    }),
    component: Home,
  }
);

function Home() {
  const { t, tm, tp } = useI18n();
  const navigate = useNavigate();
  const { user, ready, roles, isStaff } = useAuth();

  // Mode d'affichage comparatif : Tableau vs Graphique
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");

  // Redirection automatique sur Mobile / Android
  useEffect(() => {
    if (!ready) return;
    if (isMobilePlatform() && !hasOptedForPublicWeb()) {
      if (!user) navigate({ to: "/auth" });
      else if (isStaff) navigate({ to: "/admin" });
      else navigate({ to: "/agent" });
    }
  }, [ready, user, roles, isStaff, navigate]);

  const ref = useRef();
  const latest = useLatest();
  const [qs, setQs] = useState("");
  const [market, setMarket] = useState("");

  const d = ref.data;
  const rows = latest.data ?? [];
  const prodName = useMemo(
    () => Object.fromEntries((d?.products ?? []).map((p) => [p.id, p.name])),
    [d]
  );
  const mktName = useMemo(
    () => Object.fromEntries((d?.markets ?? []).map((m) => [m.id, m.name])),
    [d]
  );

  // Moyenne nationale par produit
  const national = useMemo(() => {
    const g: Record<string, { sum: number; prev: number; np: number; n: number; unit: string }> = {};
    rows.forEach((r) => {
      const x = (g[r.product_id] ??= { sum: 0, prev: 0, np: 0, n: 0, unit: r.unit });
      x.sum += Number(r.unit_price); x.n++;
      if (r.prev_price) { x.prev += Number(r.prev_price); x.np++; }
    });
    return Object.entries(g).map(([id, x]) => ({
      id, avg: Math.round(x.sum / x.n), unit: x.unit,
      delta: x.np ? pct(x.sum / x.n, x.prev / x.np) : null,
      name: prodName[id] ?? "",
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, prodName]);

  const lastUpdate = rows.reduce((a, r) => (r.observed_at > a ? r.observed_at : a), "");

  const found = rows.filter((r) =>
    (!market || r.market_id === market) &&
    (!qs || (prodName[r.product_id] ?? "").toLowerCase().includes(qs.toLowerCase()) ||
      (tp(prodName[r.product_id] ?? "")).toLowerCase().includes(qs.toLowerCase()))
  ).slice(0, 12);

  return (
    <>
      {/* ═══════════════════════════════════════════════
          HERO — Carrousel Photos des Marchés
      ═══════════════════════════════════════════════ */}
      <section className="border-b bg-gradient-to-b from-background to-secondary/30">
        <div className="mx-auto max-w-7xl px-4 pt-6 pb-0 md:pt-10">
          <MarketHeroCarousel />
        </div>

        {/* Stats rapides sous le carrousel */}
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("marketsFollowed")} value={d?.markets.filter((m) => m.active).length ?? "…"} />
            <Stat label={t("trackedProducts")} value={d?.products.length ?? "…"} />
            <Stat label={t("provinces")} value={d?.provinces.length ?? "…"} />
            <Stat label={t("lastUpdate")} value={lastUpdate ? fmtDate(lastUpdate) : "…"} />
          </div>
        </div>
      </section>

      <Page>
        {/* ═══════════════════════════════════════════════
            BARRE DE RECHERCHE
        ═══════════════════════════════════════════════ */}
        <section className="mb-8 -mt-1">
          <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-md sm:flex-row">
            <label htmlFor="home-product-search" className="flex flex-1 items-center gap-2 px-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                id="home-product-search"
                name="product_search"
                autoComplete="off"
                value={qs}
                onChange={(e) => setQs(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-10 w-full bg-transparent outline-none text-sm"
              />
            </label>
            <select
              id="home-market-select"
              name="market_filter"
              aria-label={t("market")}
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            >
              <option value="">{t("allMarkets")}</option>
              {d?.markets.map((m) => <option key={m.id} value={m.id}>{tm(m.name)}</option>)}
            </select>
          </div>

          {/* Résultats de recherche */}
          {(qs || market) && (
            <div className="mt-4">
              <h2 className="mb-3 text-xl font-bold">{t("results")}</h2>
              {found.length === 0 ? (
                <p className="text-muted-foreground">{t("noResults")}</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {found.map((r) => (
                    <div key={r.market_id + r.product_id} className="rounded-xl border bg-card p-4 shadow-sm">
                      <div className="flex justify-between gap-2"><b>{tp(prodName[r.product_id])}</b><Avail v={r.availability} /></div>
                      <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{tm(mktName[r.market_id])}</div>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="font-display text-2xl font-bold tabular-nums text-primary">{fbu(r.unit_price)}<span className="text-sm font-normal text-muted-foreground">/{r.unit}</span></span>
                        <Delta v={pct(r.unit_price, r.prev_price)} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{t("recordedOn")} {fmtDate(r.observed_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════
            GRILLE PHOTOS PRODUITS VIVRIERS
        ═══════════════════════════════════════════════ */}
        <section className="mb-12">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-0.5">
                <Package className="inline h-3.5 w-3.5 mr-1" />{t("trackedProducts")}
              </p>
              <h2 className="text-2xl font-bold">{t("nationalAvgPrices")}</h2>
            </div>
            <Link to="/produits" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              {t("followProduct")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <ProductPhotoGrid
            products={national}
            loading={latest.isLoading}
          />
        </section>

        {/* ═══════════════════════════════════════════════
            COMPARATIF DÉTAILLÉ : PHOTOS + BASCULE TABLEAU / GRAPHIQUE
        ═══════════════════════════════════════════════ */}
        {!latest.isLoading && national.length > 0 && (
          <section className="mb-12">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Comparatif détaillé des prix</h2>
              </div>

              {/* Bouton bascule Tableau vs Graphique */}
              <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === "table"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <TableIcon className="h-3.5 w-3.5" />
                  Tableau avec Photos
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("chart")}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    viewMode === "chart"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  Graphique Interactif
                </button>
              </div>
            </div>

            {viewMode === "table" ? (
              /* Vue Tableau enrichi avec Photos réelles */
              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-3 w-16">Photo</th>
                      <th className="p-3">{t("productLabel")}</th>
                      <th className="p-3 text-right">{t("avgPrice")}</th>
                      <th className="p-3 text-right">{t("over30Days")}</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {national.map((n) => {
                      const img = PRODUCT_IMAGES[n.name] || getProductFallback(n.name);
                      const fallback = getProductFallback(n.name);
                      return (
                        <tr key={n.id} className="border-t hover:bg-muted/30 transition-colors">
                          <td className="p-2.5">
                            <img
                              src={img}
                              alt={n.name}
                              loading="lazy"
                              onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
                              className="h-10 w-12 rounded-md object-cover shadow-xs border"
                            />
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {tp(n.name)}
                          </td>
                          <td className="p-3 text-right tabular-nums font-bold text-primary">
                            {fbu(n.avg)}
                            <span className="text-xs font-normal text-muted-foreground">/{n.unit}</span>
                          </td>
                          <td className="p-3 text-right">
                            <Delta v={n.delta} />
                          </td>
                          <td className="p-3 text-right">
                            <Link
                              to="/produits"
                              search={{ product: n.id } as any}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              Détails <ArrowRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Vue Graphique Interactif en Barres Horizontales */
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <p className="mb-3 text-xs text-muted-foreground">
                  Classement des prix moyens nationaux (du moins cher au plus cher en FBu)
                </p>
                <div style={{ width: "100%", height: Math.max(380, national.length * 28) }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={national.slice().sort((a, b) => a.avg - b.avg)}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => `${v} FBu`} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={110}
                      />
                      <RechartsTooltip
                        formatter={(val: number) => [`${fbu(val)}`, "Prix moyen"]}
                        contentStyle={{ backgroundColor: "var(--card)", borderRadius: "8px", border: "1px solid var(--border)" }}
                      />
                      <Bar dataKey="avg" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════
            CARTE DES MARCHÉS
        ═══════════════════════════════════════════════ */}
        <section className="mb-4">
          <div className="mb-3 flex items-end justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">{t("mapPageTitle")}</h2>
            </div>
            <Link to="/carte" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              {t("fullscreen")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {d && (
            <div className="rounded-xl overflow-hidden border shadow-sm">
              <LazyMap markets={d.markets} provinces={d.provinces} products={d.products} latest={rows} height={420} />
            </div>
          )}
        </section>
      </Page>
    </>
  );
}
