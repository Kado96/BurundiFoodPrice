import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/data";

type Row = { agent_id: string | null; status: string; observed_at: string; distance_m: number | null; flags: string[]; photo_url: string | null; market_id: string };

export function Performance() {
  const [days, setDays] = useState(30);
  const q = useQuery({
    queryKey: ["agent-perf", days],
    queryFn: async () => {
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const rows: Row[] = [];
      for (let from = 0; from < 20000; from += 1000) {
        const { data, error } = await supabase.from("observations")
          .select("agent_id, status, observed_at, distance_m, flags, photo_url, market_id")
          .gte("observed_at", since).not("agent_id", "is", null).range(from, from + 999);
        if (error) throw error;
        rows.push(...(data as Row[]));
        if (!data || data.length < 1000) break;
      }
      const [p, r, a] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("user_roles").select("user_id, role").eq("role", "agent"),
        supabase.from("agent_markets").select("agent_id, market_id"),
      ]);
      return { rows, profiles: p.data ?? [], agents: (r.data ?? []).map((x) => x.user_id), assign: a.data ?? [] };
    },
  });

  const stats = useMemo(() => {
    if (!q.data) return [];
    const ids = new Set([...q.data.agents, ...q.data.rows.map((r) => r.agent_id!)]);
    return [...ids].map((id) => {
      const rs = q.data.rows.filter((r) => r.agent_id === id);
      const valid = rs.filter((r) => r.status === "VALIDEE").length;
      const rej = rs.filter((r) => r.status === "REJETEE").length;
      const reviewed = valid + rej;
      const far = rs.filter((r) => (r.distance_m ?? 0) > 1000).length;
      const anomalies = rs.filter((r) => r.flags?.length).length;
      const photos = rs.filter((r) => r.photo_url).length;
      const assigned = q.data.assign.filter((x) => x.agent_id === id).map((x) => x.market_id);
      const covered = new Set(rs.map((r) => r.market_id)).size;
      const last = rs.reduce<string | null>((m, r) => (!m || r.observed_at > m ? r.observed_at : m), null);
      const activeDays = new Set(rs.map((r) => r.observed_at.slice(0, 10))).size;
      const rate = reviewed ? valid / reviewed : null;
      const score = rs.length === 0 ? 0 : Math.round(
        40 * (rate ?? 0.5) + 20 * (1 - far / rs.length) + 15 * (photos / rs.length) +
        15 * Math.min(1, activeDays / (days * 0.5)) + 10 * (assigned.length ? Math.min(1, covered / assigned.length) : 1));
      const prof = q.data.profiles.find((p) => p.id === id);
      return { id, name: prof?.full_name || prof?.email || "Agent", total: rs.length, valid, rej, pending: rs.length - reviewed, rate, far, anomalies, photos, assigned: assigned.length, covered, last, activeDays, score };
    }).sort((a, b) => b.score - a.score);
  }, [q.data, days]);

  const level = (s: number) => s >= 75 ? ["Excellent", "bg-primary/15 text-primary"] : s >= 50 ? ["Correct", "bg-accent/30 text-accent-foreground"] : ["À suivre", "bg-destructive/15 text-destructive"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Score sur 100 : taux de validation (40), présence au marché GPS (20), photos (15), régularité (15), couverture des marchés affectés (10).</p>
        <select value={days} onChange={(e) => setDays(+e.target.value)} className="h-9 rounded-md border bg-card px-2 text-sm">
          <option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option>
        </select>
      </div>
      {q.isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {q.data && stats.length === 0 && <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">Aucun agent enregistré pour l'instant.</p>}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left"><tr>
            <th className="p-3">Agent</th><th className="p-3">Score</th><th className="p-3">Relevés</th><th className="p-3">Validés</th><th className="p-3">Rejetés</th><th className="p-3">En attente</th>
            <th className="p-3">Taux validation</th><th className="p-3">Hors marché (&gt;1 km)</th><th className="p-3">Anomalies</th><th className="p-3">Photos</th><th className="p-3">Marchés couverts</th><th className="p-3">Jours actifs</th><th className="p-3">Dernier relevé</th>
          </tr></thead>
          <tbody>{stats.map((s) => { const [l, c] = level(s.score); return (
            <tr key={s.id} className="border-t">
              <td className="p-3 font-medium">{s.name}</td>
              <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c}`}>{s.score} · {l}</span></td>
              <td className="p-3">{s.total}</td><td className="p-3">{s.valid}</td><td className="p-3">{s.rej}</td><td className="p-3">{s.pending}</td>
              <td className="p-3">{s.rate == null ? "—" : `${Math.round(s.rate * 100)} %`}</td>
              <td className={`p-3 ${s.far ? "text-destructive" : ""}`}>{s.far}</td><td className="p-3">{s.anomalies}</td>
              <td className="p-3">{s.total ? `${Math.round((s.photos / s.total) * 100)} %` : "—"}</td>
              <td className="p-3">{s.covered} / {s.assigned}</td><td className="p-3">{s.activeDays}</td>
              <td className="p-3 text-muted-foreground">{s.last ? fmtDate(s.last) : "jamais"}</td>
            </tr>); })}</tbody>
        </table>
      </div>
    </div>
  );
}
