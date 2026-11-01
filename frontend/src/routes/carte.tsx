import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useLatest, useRef } from "@/lib/data";
import { Page, PageTitle } from "@/components/bits";
import { LazyMap } from "@/components/LazyMap";
import { MultiSelect } from "@/components/MultiSelect";
import { useI18n } from "@/lib/i18n";
import { PROVINCE_COLORS } from "@/lib/data";

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
  const { t, tp } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  // Multi-sélection des provinces et produits
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const d = ref.data;

  // Options pour MultiSelect Provinces
  const provinceOptions = useMemo(() => {
    return (d?.provinces ?? []).map((p) => ({
      value: p.id,
      label: p.name,
      color: PROVINCE_COLORS[p.name],
    }));
  }, [d]);

  // Options pour MultiSelect Produits
  const productOptions = useMemo(() => {
    return (d?.products ?? []).map((p) => ({
      value: p.id,
      label: tp(p.name),
    }));
  }, [d, tp]);

  // Filtrage des marchés affichés sur la carte
  const markets = useMemo(() => {
    if (!d) return [];
    
    // Si des produits sont sélectionnés, récupérer l'ensemble des marchés ayant au moins un de ces produits
    let withProductsSet: Set<string> | null = null;
    if (selectedProducts.length > 0) {
      withProductsSet = new Set(
        (latest.data ?? [])
          .filter((l) => selectedProducts.includes(l.product_id))
          .map((l) => l.market_id)
      );
    }

    return d.markets.filter((m) => {
      // Filtre province (si aucune province sélectionnée, toutes sont acceptées)
      const matchesProvince = selectedProvinces.length === 0 || selectedProvinces.includes(m.province_id);
      // Filtre produit (si aucun produit sélectionné, tous sont acceptés)
      const matchesProduct = !withProductsSet || withProductsSet.has(m.id);
      return matchesProvince && matchesProduct;
    });
  }, [d, selectedProvinces, selectedProducts, latest.data]);

  // Filtrage des relevés de prix affichés dans les popups
  const rows = useMemo(() => {
    const raw = latest.data ?? [];
    if (selectedProducts.length === 0) return raw;
    return raw.filter((l) => selectedProducts.includes(l.product_id));
  }, [latest.data, selectedProducts]);

  return (
    <Page>
      <PageTitle title={t("mapPageTitle")} sub={t("mapPageSub")}>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {/* MultiSelect Provinces */}
          <div className="w-full sm:w-64">
            <MultiSelect
              options={provinceOptions}
              selected={selectedProvinces}
              onChange={setSelectedProvinces}
              placeholder={t("allProvinces")}
              allLabel={t("allProvinces")}
              maxBadges={2}
            />
          </div>

          {/* MultiSelect Produits */}
          <div className="w-full sm:w-64">
            <MultiSelect
              options={productOptions}
              selected={selectedProducts}
              onChange={setSelectedProducts}
              placeholder={t("allProducts")}
              allLabel={t("allProducts")}
              maxBadges={2}
            />
          </div>
        </div>
      </PageTitle>

      {d ? (
        <LazyMap
          markets={markets}
          provinces={d.provinces}
          products={d.products}
          latest={rows}
          height={620}
        />
      ) : (
        <div className="h-[620px] animate-pulse rounded-lg border bg-muted" />
      )}
    </Page>
  );
}
