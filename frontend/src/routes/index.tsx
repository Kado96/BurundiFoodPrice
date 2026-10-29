import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Search, BarChart3, Users, Package } from "lucide-react";
import { useLatest, useRef, fbu, pct, fmtDate } from "@/lib/data";
import { Avail, Delta, Page, Stat } from "@/components/bits";
import { LazyMap } from "@/components/LazyMap";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isMobilePlatform, hasOptedForPublicWeb } from "@/lib/mobile";
import { MarketHeroCarousel } from "@/components/MarketHeroCarousel";
import { ProductPhotoGrid } from "@/components/ProductPhotoGrid";

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
      id, avg: x.sum / x.n, unit: x.unit,
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
            TABLEAU SYNTHÉTIQUE DES PRIX (garde-fou données)
        ═══════════════════════════════════════════════ */}
        {!latest.isLoading && national.length > 0 && (
          <section className="mb-12">
            <div className="mb-3 flex items-end justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold">Comparatif détaillé des prix</h2>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-3">{t("productLabel")}</th>
                    <th className="p-3 text-right">{t("avgPrice")}</th>
                    <th className="p-3 text-right">{t("over30Days")}</th>
                  </tr>
                </thead>
                <tbody>
                  {national.map((n) => (
                    <tr key={n.id} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-medium">{tp(n.name)}</td>
                      <td className="p-3 text-right tabular-nums font-semibold text-primary">{fbu(n.avg)}/{n.unit}</td>
                      <td className="p-3 text-right"><Delta v={n.delta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
