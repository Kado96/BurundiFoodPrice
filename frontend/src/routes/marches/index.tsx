import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, CalendarDays, Search } from "lucide-react";
import { useLatest, useRef, fmtDate } from "@/lib/data";
import { Page, PageTitle } from "@/components/bits";
import { useI18n } from "@/lib/i18n";

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
  const [prov, setProv] = useState("");
  const [q, setQ] = useState("");
  const d = ref.data;
  const provName = useMemo(() => Object.fromEntries((d?.provinces ?? []).map((p) => [p.id, p.name])), [d]);
  const stats = useMemo(() => {
    const s: Record<string, { n: number; last: string }> = {};
    (latest.data ?? []).forEach((l) => {
      const x = (s[l.market_id] ??= { n: 0, last: l.observed_at });
      x.n++; if (l.observed_at > x.last) x.last = l.observed_at;
    });
    return s;
  }, [latest.data]);
  const list = (d?.markets ?? []).filter((m) => m.active && (!prov || m.province_id === prov) && m.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Page>
      <PageTitle title={t("marketsListTitle")} sub={`${list.length} — ${t("marketsListSub")}`}>
        <div className="flex flex-wrap gap-2">
          <label className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="h-10 rounded-md border bg-card pl-8 pr-2 text-sm" />
          </label>
          <select value={prov} onChange={(e) => setProv(e.target.value)} className="h-10 rounded-md border bg-card px-2 text-sm">
            <option value="">{t("allProvinces")}</option>
            {d?.provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </PageTitle>
      {ref.isLoading ? <p className="text-muted-foreground">{t("loading")}</p> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m) => {
            const st = stats[m.id];
            const rawDays = Array.isArray(m.market_days) ? m.market_days.join(", ") : String(m.market_days ?? "");
            return (
              <Link key={m.id} to="/marches/$id" params={{ id: m.id }}
                className="group rounded-lg border bg-card p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold group-hover:text-primary">{tm(m.name)}</h2>
                    <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />{provName[m.province_id]} {m.commune ? `· ${m.commune}` : ""}
                    </p>
                  </div>
                </div>
                {rawDays ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {td(rawDays)}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
                  <span>{st?.n ? `${st.n} ${t("products").toLowerCase()}` : t("noResults")}</span>
                  <span>{st?.last ? `${t("lastUpdate")} ${fmtDate(st.last)}` : "—"}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Page>
  );
}
