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
  const { t, tp, tm } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  // Multi-sélection des provinces, communes, marchés et produits
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>([]);
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

  // Options pour MultiSelect Communes (filtrées dynamiquement par province si sélectionnée)
  const communeOptions = useMemo(() => {
    const set = new Set<string>();
    (d?.markets ?? []).forEach((m) => {
      if (!m.commune) return;
      if (selectedProvinces.length === 0 || selectedProvinces.includes(m.province_id)) {
        set.add(m.commune);
      }
    });
    return Array.from(set).sort().map((c) => ({
      value: c,
      label: c,
    }));
  }, [d, selectedProvinces]);

  // Options pour MultiSelect Marchés (filtrés dynamiquement par province et commune)
  const marketOptions = useMemo(() => {
    return (d?.markets ?? [])
      .filter((m) => {
        const matchesProv = selectedProvinces.length === 0 || selectedProvinces.includes(m.province_id);
        const matchesCommune = selectedCommunes.length === 0 || (m.commune && selectedCommunes.includes(m.commune));
        return matchesProv && matchesCommune;
      })
      .map((m) => ({
        value: m.id,
        label: tm(m.name),
      }));
  }, [d, selectedProvinces, selectedCommunes, tm]);

  // Options pour MultiSelect Produits
  const productOptions = useMemo(() => {
    return (d?.products ?? []).map((p) => ({
      value: p.id,
      label: tp(p.name),
    }));
  }, [d, tp]);

  // « Tout sélectionner » dans MultiSelect = tous les IDs cochés.
  // Pour le filtre, c’est équivalent à « aucun filtre » (sinon 0 marqueur si latest_prices est vide / partiel).
  const provinceFilterOn =
    selectedProvinces.length > 0 && selectedProvinces.length < provinceOptions.length;
  const communeFilterOn =
    selectedCommunes.length > 0 && selectedCommunes.length < communeOptions.length;
  const marketFilterOn =
    selectedMarkets.length > 0 && selectedMarkets.length < marketOptions.length;
  const productFilterOn =
    selectedProducts.length > 0 && selectedProducts.length < productOptions.length;

  // Filtrage des marchés affichés sur la carte
  const markets = useMemo(() => {
    if (!d) return [];

    // Filtre produit uniquement si un SOUS-ensemble de produits est choisi
    let withProductsSet: Set<string> | null = null;
    if (productFilterOn) {
      withProductsSet = new Set(
        (latest.data ?? [])
          .filter((l) => selectedProducts.includes(l.product_id))
          .map((l) => l.market_id),
      );
    }

    return d.markets.filter((m) => {
      if (m.active === false) return false;
      const lat = Number(m.lat);
      const lng = Number(m.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
      // Hors enveloppe Burundi approximative → ignorer (évite marqueurs invisibles)
      if (lat < -5.2 || lat > -2.2 || lng < 28.8 || lng > 31.0) return false;

      const matchesProvince = !provinceFilterOn || selectedProvinces.includes(m.province_id);
      const matchesCommune =
        !communeFilterOn || (m.commune != null && selectedCommunes.includes(m.commune));
      const matchesMarket = !marketFilterOn || selectedMarkets.includes(m.id);
      const matchesProduct = !withProductsSet || withProductsSet.has(m.id);
      return matchesProvince && matchesCommune && matchesMarket && matchesProduct;
    });
  }, [
    d,
    provinceFilterOn,
    communeFilterOn,
    marketFilterOn,
    productFilterOn,
    selectedProvinces,
    selectedCommunes,
    selectedMarkets,
    selectedProducts,
    latest.data,
  ]);

  // Filtrage des relevés de prix affichés dans les popups
  const rows = useMemo(() => {
    const raw = latest.data ?? [];
    if (!productFilterOn) return raw;
    return raw.filter((l) => selectedProducts.includes(l.product_id));
  }, [latest.data, selectedProducts, productFilterOn]);

  return (
    <Page>
      <div className="relative z-30 overflow-visible">
        <PageTitle title={t("mapPageTitle")} sub={t("mapPageSub")}>
          <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto overflow-visible">
            {/* MultiSelect Provinces */}
            <div className="w-full sm:w-48 lg:w-52 overflow-visible">
              <MultiSelect
                options={provinceOptions}
                selected={selectedProvinces}
                onChange={setSelectedProvinces}
                placeholder={t("allProvinces")}
                allLabel={t("allProvinces")}
                maxBadges={1}
              />
            </div>

            {/* MultiSelect Communes */}
            <div className="w-full sm:w-48 lg:w-52 overflow-visible">
              <MultiSelect
                options={communeOptions}
                selected={selectedCommunes}
                onChange={setSelectedCommunes}
                placeholder={t("allCommunes")}
                allLabel={t("allCommunes")}
                maxBadges={1}
              />
            </div>

            {/* MultiSelect Marchés */}
            <div className="w-full sm:w-48 lg:w-52 overflow-visible">
              <MultiSelect
                options={marketOptions}
                selected={selectedMarkets}
                onChange={setSelectedMarkets}
                placeholder={t("allMarkets")}
                allLabel={t("allMarkets")}
                maxBadges={1}
              />
            </div>

            {/* MultiSelect Produits */}
            <div className="w-full sm:w-56 lg:w-60 overflow-visible">
              <MultiSelect
                options={productOptions}
                selected={selectedProducts}
                onChange={setSelectedProducts}
                placeholder={t("allProducts")}
                allLabel={t("allProducts")}
                maxBadges={1}
              />
            </div>
          </div>
        </PageTitle>
      </div>

      {d ? (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            {markets.length} marché{markets.length > 1 ? "s" : ""} sur la carte
            {productFilterOn
              ? " (filtrés par produit sélectionné)"
              : " · tous les marchés géolocalisés"}
          </p>
          <LazyMap
            markets={markets}
            provinces={d.provinces}
            products={d.products}
            latest={rows}
            height={620}
          />
        </>
      ) : (
        <div className="h-[620px] animate-pulse rounded-lg border bg-muted" />
      )}
    </Page>
  );
}
