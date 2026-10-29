/**
 * MarketHeroCarousel — Carrousel défilant de photos des marchés du Burundi
 * Défilement automatique toutes les 6s · Flèches · Indicateurs dots
 */
import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { MARKET_SLIDES } from "@/lib/images";
import { useI18n } from "@/lib/i18n";

const INTERVAL = 6000;

export function MarketHeroCarousel() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const [loaded, setLoaded] = useState<boolean[]>(Array(MARKET_SLIDES.length).fill(false));

  const go = useCallback((idx: number) => {
    setActive((idx + MARKET_SLIDES.length) % MARKET_SLIDES.length);
  }, []);

  // Auto-défilement
  useEffect(() => {
    const id = window.setInterval(() => go(active + 1), INTERVAL);
    return () => window.clearInterval(id);
  }, [active, go]);

  const slide = MARKET_SLIDES[active];

  return (
    <div className="relative w-full overflow-hidden rounded-none md:rounded-2xl shadow-xl"
         style={{ height: "clamp(260px, 45vw, 520px)" }}>

      {/* Images en stack — transition opacity */}
      {MARKET_SLIDES.map((s, i) => (
        <div
          key={s.name}
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: i === active ? 1 : 0, zIndex: i === active ? 1 : 0 }}
        >
          <img
            src={s.image}
            alt={s.name}
            loading={i === 0 ? "eager" : "lazy"}
            onLoad={() => setLoaded(prev => { const n = [...prev]; n[i] = true; return n; })}
            className="h-full w-full object-cover"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>
      ))}

      {/* Texte en bas */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-5 md:p-8 text-white">
        <div className="flex items-center gap-1.5 text-xs font-medium text-primary-foreground/80 mb-1">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span className="text-primary font-semibold">{slide.province}</span>
        </div>
        <h2 className="text-xl md:text-3xl font-bold leading-tight drop-shadow-md">
          {slide.name}
        </h2>
        <p className="mt-1 text-sm md:text-base text-white/80 max-w-xl hidden md:block">
          {slide.caption}
        </p>
      </div>

      {/* Flèche gauche */}
      <button
        aria-label="Précédent"
        onClick={() => go(active - 1)}
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      {/* Flèche droite */}
      <button
        aria-label="Suivant"
        onClick={() => go(active + 1)}
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 right-5 z-20 flex gap-1.5">
        {MARKET_SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
            aria-label={`Slide ${i + 1}`}
            className="rounded-full transition-all"
            style={{
              width: i === active ? 20 : 7,
              height: 7,
              background: i === active ? "white" : "rgba(255,255,255,0.4)",
            }}
          />
        ))}
      </div>

      {/* Badge */}
      <div className="absolute top-4 left-4 z-20 rounded-full bg-primary/90 px-3 py-1 text-xs font-bold text-primary-foreground shadow-md backdrop-blur-sm">
        🌍 {t("observatory")} — Marchés du Burundi
      </div>
    </div>
  );
}
