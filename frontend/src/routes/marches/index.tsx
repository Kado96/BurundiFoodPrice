import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapPin, CalendarDays, Search, Store } from "lucide-react";
import { useLatest, useRef, fmtDate, PROVINCE_COLORS } from "@/lib/data";
import { Page } from "@/components/bits";
import { MultiSelect } from "@/components/MultiSelect";
import { useI18n } from "@/lib/i18n";
import { getMarketPhoto } from "@/lib/images";
import { pullGalleryToLocal, subscribePhotoUpdates } from "@/lib/photoGallery";

export const Route = createFileRoute("/marches/")({
  head: () => ({ meta: [
    { title: "Marchés suivis — Burundi Food Price" },
    { name: "description", content: "Liste des marchés du Burundi suivis : province, commune, jours de marché et derniers relevés de prix." },
    { property: "og:title", content: "Marchés suivis — Burundi Food Price" },
    { property: "og:description", content: "Tous les marchés suivis, par province, avec leurs derniers prix." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MarchesPage,
});

function MarchesPage() {
  const { t, tm, td } = useI18n();
  const ref = useRef();
  const latest = useLatest();
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [galleryTick, setGalleryTick] = useState(0);
  const d = ref.data;

  useEffect(() => {
    void pullGalleryToLocal().then(() => setGalleryTick((n) => n + 1));
    return subscribePhotoUpdates(() => setGalleryTick((n) => n + 1));
  }, []);
  const provName = useMemo(() => Object.fromEntries((d?.provinces ?? []).map((p) => [p.id, p.name])), [d]);

  // Options pour MultiSelect Provinces
  const provinceOptions = useMemo(() => {
    return (d?.provinces ?? []).map((p) => ({
      value: p.id,
      label: p.name,
      color: PROVINCE_COLORS[p.name],
    }));
  }, [d]);

  // Options pour MultiSelect Communes (filtrées dynamiquement selon les provinces sélectionnées)
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

  const stats = useMemo(() => {
    const s: Record<string, { n: number; last: string }> = {};
    (latest.data ?? []).forEach((l) => {
      const x = (s[l.market_id] ??= { n: 0, last: l.observed_at });
      x.n++; if (l.observed_at > x.last) x.last = l.observed_at;
    });
    return s;
  }, [latest.data]);

  const list = useMemo(() => {
    return (d?.markets ?? []).filter((m) => {
      if (!m.active) return false;
      const matchesProv = selectedProvinces.length === 0 || selectedProvinces.includes(m.province_id);
      const matchesCommune = selectedCommunes.length === 0 || (m.commune && selectedCommunes.includes(m.commune));
      const matchesQuery = !q.trim() || m.name.toLowerCase().includes(q.toLowerCase()) || (m.commune && m.commune.toLowerCase().includes(q.toLowerCase()));
      return matchesProv && matchesCommune && matchesQuery;
    });
  }, [d, selectedProvinces, selectedCommunes, q]);

  return (
    <>
      {/* ═══════════════════════════════════════════════
          HERO BANNER AVEC PHOTO RÉELLE DU MARCHÉ
      ═══════════════════════════════════════════════ */}
      <section className="relative overflow-visible bg-slate-900 text-white z-20">
        {/* Photo d'arrière-plan avec overlay dégradé */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35 pointer-events-none"
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=1600&q=80')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-black/50 to-black/30 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 md:py-16 overflow-visible">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/90 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-xs">
              <Store className="h-3.5 w-3.5" />
              Réseau National des Marchés
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">
              {t("marketsListTitle")}
            </h1>
            <p className="mt-3 text-base text-gray-200">
              {list.length} marchés suivis quotidiennement à travers tout le Burundi avec relevés de prix vérifiés.
            </p>
          </div>

          {/* Barre de filtres en surimpression */}
          <div className="relative z-30 mt-8 flex flex-col gap-3 md:flex-row max-w-3xl rounded-xl border border-white/20 bg-card/95 p-3 shadow-lg backdrop-blur-md overflow-visible">
            <label htmlFor="markets-search-input" className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                id="markets-search-input"
                name="market_search"
                autoComplete="off"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un marché..."
                className="h-10 w-full rounded-md border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
            <div className="w-full md:w-56 overflow-visible">
              <MultiSelect
                options={provinceOptions}
                selected={selectedProvinces}
                onChange={setSelectedProvinces}
                placeholder={t("allProvinces")}
                allLabel={t("allProvinces")}
                maxBadges={1}
              />
            </div>
            <div className="w-full md:w-56 overflow-visible">
              <MultiSelect
                options={communeOptions}
                selected={selectedCommunes}
                onChange={setSelectedCommunes}
                placeholder={t("allCommunes")}
                allLabel={t("allCommunes")}
                maxBadges={1}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          GRILLE DES MARCHÉS AVEC PHOTOS RÉELLES DERRIÈRE
      ═══════════════════════════════════════════════ */}
      <Page>
        {ref.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((m) => {
              const st = stats[m.id];
              const rawDays = Array.isArray(m.market_days) ? m.market_days.join(", ") : String(m.market_days ?? "");
              void galleryTick;
              const photo = getMarketPhoto(m.name);

              return (
                <Link
                  key={m.id}
                  to="/marches/$id"
                  params={{ id: m.id }}
                  className="group relative h-72 rounded-2xl overflow-hidden border shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                >
                  {/* Photo réelle en arrière-plan */}
                  <img
                    src={photo}
                    alt={m.name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />

                  {/* Gradient sombre pour lisibilité du texte */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/60 to-black/30" />

                  {/* Contenu par-dessus l'image */}
                  <div className="relative flex h-full flex-col justify-between p-5 text-white">
                    {/* Haut : Badges Province + Jours */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/90 px-2.5 py-1 text-xs font-semibold backdrop-blur-xs text-primary-foreground">
                        <MapPin className="h-3 w-3" />
                        {provName[m.province_id]}
                      </span>
                      {rawDays && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium backdrop-blur-xs text-white/90">
                          <CalendarDays className="h-3 w-3 text-primary-foreground" />
                          {td(rawDays)}
                        </span>
                      )}
                    </div>

                    {/* Bas : Nom du marché + Statistiques */}
                    <div>
                      <h2 className="text-xl font-bold tracking-tight text-white group-hover:text-primary-foreground drop-shadow-md">
                        {tm(m.name)}
                      </h2>
                      {m.commune && (
                        <p className="mt-0.5 text-xs text-white/70">
                          Commune de {m.commune}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-white/20 pt-2.5 text-xs text-white/80">
                        <span className="font-semibold text-emerald-300">
                          {st?.n ? `${st.n} produits suivis` : "Actif"}
                        </span>
                        <span className="text-white/60">
                          {st?.last ? `${t("lastUpdate")} ${fmtDate(st.last)}` : "Récemment"}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Page>
    </>
  );
}
