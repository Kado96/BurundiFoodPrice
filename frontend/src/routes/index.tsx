import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { useLatest, useRef, fbu, pct, fmtDate } from "@/lib/data";
import { Avail, Delta, Page, Stat } from "@/components/bits";
import { LazyMap } from "@/components/LazyMap";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isMobilePlatform, hasOptedForPublicWeb } from "@/lib/mobile";

export const Route = createFileRoute("/")({
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
});

function Home() {
  const { t, tm, tp } = useI18n();
  const navigate = useNavigate();
  const { user, ready, roles, isStaff } = useAuth();

  // Redirection automatique sur Mobile / Android
  useEffect(() => {
    if (!ready) return;
    if (isMobilePlatform() && !hasOptedForPublicWeb()) {
      if (!user) {
        // Non connecté sur mobile -> page d'atterrissage identifiants
        navigate({ to: "/auth" });
      } else if (isStaff) {
        // Staff/Admin déjà connecté sur mobile -> tableau de bord admin
        navigate({ to: "/admin" });
      } else {
        // Agent de collecte déjà connecté sur mobile -> interface directe de collecte
        navigate({ to: "/agent" });
      }
    }
  }, [ready, user, roles, isStaff, navigate]);
  const ref = useRef();
  const latest = useLatest();
  const [qs, setQs] = useState("");
  const [market, setMarket] = useState("");

  const d = ref.data;
  const rows = latest.data ?? [];
  const prodName = useMemo(() => Object.fromEntries((d?.products ?? []).map((p) => [p.id, p.name])), [d]);
  const mktName = useMemo(() => Object.fromEntries((d?.markets ?? []).map((m) => [m.id, m.name])), [d]);

  // National average per product
  const national = useMemo(() => {
    const g: Record<string, { sum: number; prev: number; np: number; n: number; unit: string }> = {};
    rows.forEach((r) => {
      const x = (g[r.product_id] ??= { sum: 0, prev: 0, np: 0, n: 0, unit: r.unit });
      x.sum += Number(r.unit_price); x.n++;
      if (r.prev_price) { x.prev += Number(r.prev_price); x.np++; }
    });
    return Object.entries(g).map(([id, x]) => ({
      id, avg: x.sum / x.n, unit: x.unit, delta: x.np ? pct(x.sum / x.n, x.prev / x.np) : null,
    })).sort((a, b) => (prodName[a.id] ?? "").localeCompare(prodName[b.id] ?? ""));
  }, [rows, prodName]);

  const lastUpdate = rows.reduce((a, r) => (r.observed_at > a ? r.observed_at : a), "");
  const found = rows.filter((r) =>
    (!market || r.market_id === market) &&
    (!qs || (prodName[r.product_id] ?? "").toLowerCase().includes(qs.toLowerCase()) || (tp(prodName[r.product_id] ?? "")).toLowerCase().includes(qs.toLowerCase())),
  ).slice(0, 12);

  return (
    <>
      <section className="border-b bg-secondary/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-2 md:py-16">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">{t("observatory")}</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
              {t("heroTitle")}
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">
              {t("heroSub")}
            </p>
            <div className="mt-6 flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs sm:flex-row">
              <label htmlFor="home-product-search" className="flex flex-1 items-center gap-2 px-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  id="home-product-search"
                  name="product_search"
                  autoComplete="off"
                  value={qs}
                  onChange={(e) => setQs(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="h-10 w-full bg-transparent outline-none"
                />
              </label>
              <select
                id="home-market-select"
                name="market_filter"
                aria-label={t("market")}
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                className="h-10 rounded-md border bg-background px-2 text-sm"
              >
                <option value="">{t("allMarkets")}</option>
                {d?.markets.map((m) => <option key={m.id} value={m.id}>{tm(m.name)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 content-center gap-3">
            <Stat label={t("marketsFollowed")} value={d?.markets.filter((m) => m.active).length ?? "…"} />
            <Stat label={t("trackedProducts")} value={d?.products.length ?? "…"} />
            <Stat label={t("provinces")} value={d?.provinces.length ?? "…"} />
            <Stat label={t("lastUpdate")} value={lastUpdate ? fmtDate(lastUpdate) : "…"} />
          </div>
        </div>
      </section>

      <Page>
        {(qs || market) && (
          <section className="mb-10">
            <h2 className="mb-3 text-2xl font-bold">{t("results")}</h2>
            {found.length === 0 ? <p className="text-muted-foreground">{t("noResults")}</p> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {found.map((r) => (
                  <div key={r.market_id + r.product_id} className="rounded-lg border bg-card p-4">
                    <div className="flex justify-between gap-2"><b>{tp(prodName[r.product_id])}</b><Avail v={r.availability} /></div>
                    <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{tm(mktName[r.market_id])}</div>
                    <div className="mt-2 flex items-end justify-between">
                      <span className="font-display text-2xl font-bold tabular-nums">{fbu(r.unit_price)}<span className="text-sm font-normal">/{r.unit}</span></span>
                      <Delta v={pct(r.unit_price, r.prev_price)} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{t("recordedOn")} {fmtDate(r.observed_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mb-10">
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t("nationalAvgPrices")}</h2>
            <Link to="/produits" className="text-sm font-semibold text-primary">{t("followProduct")} <ArrowRight className="inline h-4 w-4" /></Link>
          </div>
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">{t("productLabel")}</th><th className="p-3 text-right">{t("avgPrice")}</th><th className="p-3 text-right">{t("over30Days")}</th></tr>
              </thead>
              <tbody>
                {national.map((n) => (
                  <tr key={n.id} className="border-t">
                    <td className="p-3 font-medium">{tp(prodName[n.id])}</td>
                    <td className="p-3 text-right tabular-nums">{fbu(n.avg)}/{n.unit}</td>
                    <td className="p-3 text-right"><Delta v={n.delta} /></td>
                  </tr>
                ))}
                {latest.isLoading && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">{t("loading")}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <h2 className="text-2xl font-bold">{t("mapPageTitle")}</h2>
            <Link to="/carte" className="text-sm font-semibold text-primary">{t("fullscreen")} <ArrowRight className="inline h-4 w-4" /></Link>
          </div>
          {d && <LazyMap markets={d.markets} provinces={d.provinces} products={d.products} latest={rows} height={420} />}
        </section>
      </Page>
    </>
  );
}
