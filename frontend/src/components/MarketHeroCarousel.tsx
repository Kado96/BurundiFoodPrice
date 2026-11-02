/**
 * MarketHeroCarousel — carrousel de TOUTES les photos de marchés (galerie admin).
 * Source : marchés actifs DB + galerie bfp_photo_market / MARKET_IMAGES.
 */
import { useEffect, useState, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { useRef } from "@/lib/data";
import {
  loadPhotoStore,
  resolveMarketPhoto,
  subscribePhotoUpdates,
  STORAGE_MARKET,
} from "@/lib/photoGallery";
import { MARKET_IMAGES } from "@/lib/images";
import { useI18n } from "@/lib/i18n";

const INTERVAL = 5000;

type Slide = {
  id: string;
  name: string;
  province: string;
  commune: string | null;
  image: string;
};

export function MarketHeroCarousel() {
  const { t } = useI18n();
  const ref = useRef();
  const [galleryTick, setGalleryTick] = useState(0);
  const [active, setActive] = useState(0);

  useEffect(() => subscribePhotoUpdates(() => setGalleryTick((n) => n + 1)), []);

  const slides: Slide[] = useMemo(() => {
    void galleryTick;
    const gallery = loadPhotoStore(STORAGE_MARKET);
    const provinces = Object.fromEntries((ref.data?.provinces ?? []).map((p) => [p.id, p.name]));
    const markets = (ref.data?.markets ?? []).filter((m) => m.active !== false);

    if (markets.length) {
      return markets.map((m) => ({
        id: m.id,
        name: m.name,
        province: provinces[m.province_id] || "",
        commune: m.commune,
        image: resolveMarketPhoto(m.name, gallery),
      }));
    }

    // Offline / avant chargement DB : galerie admin + registres images.ts
    const names = Array.from(new Set([...Object.keys(gallery), ...Object.keys(MARKET_IMAGES)]));
    return names.map((name, i) => ({
      id: `g-${i}-${name}`,
      name,
      province: "",
      commune: null,
      image: resolveMarketPhoto(name, gallery),
    }));
  }, [ref.data?.markets, ref.data?.provinces, galleryTick]);

  const count = slides.length || 1;

  const go = useCallback(
    (idx: number) => {
      setActive((idx + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => go(active + 1), INTERVAL);
    return () => window.clearInterval(id);
  }, [active, go, slides.length]);

  useEffect(() => {
    if (active >= slides.length) setActive(0);
  }, [slides.length, active]);

  if (!slides.length) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-none bg-muted md:rounded-2xl"
        style={{ height: "clamp(260px, 45vw, 520px)" }}
      >
        <p className="text-sm text-muted-foreground">Chargement des photos des marchés…</p>
      </div>
    );
  }

  const slide = slides[Math.min(active, slides.length - 1)];

  return (
    <div
      className="relative w-full overflow-hidden rounded-none shadow-xl md:rounded-2xl"
      style={{ height: "clamp(260px, 45vw, 520px)" }}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === active ? 1 : 0, zIndex: i === active ? 1 : 0 }}
        >
          <img
            src={s.image}
            alt={s.name}
            loading={i === 0 ? "eager" : "lazy"}
            className="h-full w-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.opacity = "0.3";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
      ))}

      <div className="absolute bottom-0 left-0 right-0 z-10 p-5 text-white md:p-8">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary-foreground/80">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="font-semibold text-primary">
            {[slide.province, slide.commune].filter(Boolean).join(" · ") || "Burundi"}
          </span>
        </div>
        <h2 className="text-xl font-bold leading-tight drop-shadow-md md:text-3xl">{slide.name}</h2>
        <p className="mt-1 hidden max-w-xl text-sm text-white/80 md:block">
          {slides.length} marchés · galerie photos administrateur
        </p>
      </div>

      {slides.length > 1 && (
        <>
          <button
            aria-label="Précédent"
            onClick={() => go(active - 1)}
            className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            aria-label="Suivant"
            onClick={() => go(active + 1)}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm transition-colors hover:bg-black/60"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 right-5 z-20 flex max-w-[50%] flex-wrap justify-end gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Marché ${i + 1}`}
                className="rounded-full transition-all"
                style={{
                  width: i === active ? 18 : 6,
                  height: 6,
                  background: i === active ? "white" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        </>
      )}

      <div className="absolute left-4 top-4 z-20 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold text-primary-foreground shadow-md backdrop-blur-sm">
        🌍 {t("observatory")} — {slides.length} marchés
      </div>
    </div>
  );
}
