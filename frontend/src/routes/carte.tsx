import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLatest, useRef } from "@/lib/data";
import { Page, PageTitle } from "@/components/bits";
import { LazyMap } from "@/components/LazyMap";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/carte")({
  head: () => ({
    meta: [
      { title: "Carte interactive des marchés — Burundi Food Price" },
      { name: "description", content: "Carte des marchés du Burundi avec les derniers prix relevés pour chaque produit vivrier." },
      { property: "og:title", content: "Carte interactive des marchés du Burundi" },
      { property: "og:description", content: "Cliquez sur un marché pour voir ses derniers prix vérifiés." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CartePage,
});

function CartePage() {
  const { t } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const [prov, setProv] = useState("");
  const [product, setProduct] = useState("");
  const d = ref.data;

  const markets = useMemo(() => {
    if (!d) return [];
    const withProduct = new Set((latest.data ?? []).filter((l) => l.product_id === product).map((l) => l.market_id));
    return d.markets.filter((m) => (!prov || m.province_id === prov) && (!product || withProduct.has(m.id)));
  }, [d, prov, product, latest.data]);
  const rows = useMemo(() => (latest.data ?? []).filter((l) => !product || l.product_id === product), [latest.data, product]);

  return (
    <Page>
      <PageTitle title={t("mapPageTitle")} sub={t("mapPageSub")}>
        <div className="flex flex-wrap gap-2">
          <select value={prov} onChange={(e) => setProv(e.target.value)} className="h-10 rounded-md border bg-card px-2 text-sm">
            <option value="">{t("allProvinces")}</option>
            {d?.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select value={product} onChange={(e) => setProduct(e.target.value)} className="h-10 rounded-md border bg-card px-2 text-sm">
            <option value="">{t("allProducts")}</option>
            {d?.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </PageTitle>
      {d ? <LazyMap markets={markets} provinces={d.provinces} products={d.products} latest={rows} height={620} />
        : <div className="h-[620px] animate-pulse rounded-lg border bg-muted" />}
    </Page>
  );
}
