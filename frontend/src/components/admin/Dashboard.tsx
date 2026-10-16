import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLatest, useRef, fbu, pct, fmtDate } from "@/lib/data";
import { Delta, Stat } from "@/components/bits";

export function Dashboard({ onGoValidate }: { onGoValidate: () => void }) {
  const ref = useRef();
  const latest = useLatest();
  const counts = useQuery({
    queryKey: ["admin-counts"],
    queryFn: async () => {
      const week = new Date(Date.now() - 7 * 86400_000).toISOString();
      const [pending, rejected, recent, agents] = await Promise.all([
        supabase.from("observations").select("id", { count: "exact", head: true }).eq("status", "SYNCHRONISEE"),
        supabase.from("observations").select("id", { count: "exact", head: true }).eq("status", "REJETEE"),
        supabase.from("observations").select("id", { count: "exact", head: true }).gte("observed_at", week),
        supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "agent"),
      ]);
      return { pending: pending.count ?? 0, rejected: rejected.count ?? 0, recent: recent.count ?? 0, agents: agents.count ?? 0 };
    },
  });
  const d = ref.data;
  const x = useMemo(() => {
    if (!d || !latest.data) return null;
    const lastBy: Record<string, string> = {};
    latest.data.forEach((l) => { if (!lastBy[l.market_id] || l.observed_at > lastBy[l.market_id]!) lastBy[l.market_id] = l.observed_at; });
    const limit = new Date(Date.now() - 14 * 86400_000).toISOString();
    const stale = d.markets.filter((m) => m.active && (!lastBy[m.id] || lastBy[m.id]! < limit));
    const mk = Object.fromEntries(d.markets.map((m) => [m.id, m.name]));
    const pr = Object.fromEntries(d.products.map((p) => [p.id, p.name]));
    const moves = latest.data.map((l) => ({ ...l, ch: pct(l.unit_price, l.prev_price) }))
      .filter((l) => l.ch != null && Math.abs(l.ch) > 20).sort((a, b) => Math.abs(b.ch!) - Math.abs(a.ch!)).slice(0, 8);
    return { stale, lastBy, mk, pr, moves };
  }, [d, latest.data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Marchés actifs" value={d?.markets.filter((m) => m.active).length ?? "…"} />
        <Stat label="Agents" value={counts.data?.agents ?? "…"} />
        <Stat label="Relevés (7 jours)" value={counts.data?.recent ?? "…"} />
        <button onClick={onGoValidate} className="text-left"><Stat label="En attente de validation" value={<span className="text-accent-foreground">{counts.data?.pending ?? "…"}</span>} hint="Cliquer pour valider" /></button>
        <Stat label="Rejetés (à corriger)" value={counts.data?.rejected ?? "…"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><AlertTriangle className="h-5 w-5 text-warning" />Marchés sans collecte depuis 14 jours</h2>
          {x?.stale.length ? (
            <ul className="divide-y text-sm">{x.stale.map((m) => (
              <li key={m.id} className="flex justify-between py-2"><span>{m.name}</span><span className="text-muted-foreground">{x.lastBy[m.id] ? fmtDate(x.lastBy[m.id]!) : "jamais"}</span></li>
            ))}</ul>
          ) : <p className="text-sm text-muted-foreground">Tous les marchés ont été collectés récemment.</p>}
        </section>
        <section className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><AlertTriangle className="h-5 w-5 text-destructive" />Variations anormales (&gt; 20 % sur 30 j)</h2>
          {x?.moves.length ? (
            <ul className="divide-y text-sm">{x.moves.map((l) => (
              <li key={l.market_id + l.product_id} className="flex items-center justify-between py-2">
                <span><b>{x.pr[l.product_id]}</b> · {x.mk[l.market_id]}</span>
                <span className="flex gap-3"><span className="tabular-nums">{fbu(l.unit_price)}</span><Delta v={l.ch} /></span>
              </li>
            ))}</ul>
          ) : <p className="text-sm text-muted-foreground">Aucune variation anormale.</p>}
        </section>
      </div>
    </div>
  );
}
