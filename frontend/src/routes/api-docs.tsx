import { createFileRoute } from "@tanstack/react-router";
import { Page, PageTitle } from "@/components/bits";
import { useI18n, type TKey } from "@/lib/i18n";

export const Route = createFileRoute("/api-docs")({
  head: () => ({ meta: [
    { title: "API ouverte — Burundi Food Price" },
    { name: "description", content: "API publique JSON des prix alimentaires validés des marchés du Burundi." },
    { property: "og:title", content: "API ouverte — Burundi Food Price" },
    { property: "og:description", content: "Accédez librement aux marchés, produits et prix validés en FBu." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ApiDocs,
});

const EP: [string, TKey][] = [
  ["/api/public/v1", "epApiDesc"],
  ["/api/public/v1/provinces", "epProvinces"],
  ["/api/public/v1/markets", "epMarkets"],
  ["/api/public/v1/categories", "epCategories"],
  ["/api/public/v1/products", "epProducts"],
  ["/api/public/v1/prices/latest", "epLatestPrices"],
  ["/api/public/v1/prices/history?product_id=…&days=90", "epPriceHistory"],
  ["/api/public/v1/observations?market_id=…&product_id=…&from=2026-01-01&to=2026-12-31&limit=500&offset=0", "epObservations"],
  ["/api/public/v1/stats", "epStats"],
];

function ApiDocs() {
  const { t } = useI18n();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return (
    <Page>
      <PageTitle title={t("apiDocsTitle")} sub={t("apiDocsSub")} />
      <div className="space-y-3">
        {EP.map(([p, key]) => (
          <div key={p} className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">GET · {t(key)}</p>
            <a href={p} target="_blank" rel="noreferrer" className="break-all font-mono text-sm text-primary underline">{origin}{p}</a>
          </div>
        ))}
        <p className="text-sm text-muted-foreground">{t("apiDocsNotice")}</p>
      </div>
    </Page>
  );
}
