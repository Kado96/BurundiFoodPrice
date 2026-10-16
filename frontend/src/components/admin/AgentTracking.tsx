import { useQuery } from "@tanstack/react-query";
import { Activity, CheckCircle, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate } from "@/lib/data";

interface AgentActivity {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "actif" | "inactif";
  lastSubmission: string | null;
  totalSubmissions: number;
  validatedSubmissions: number;
  rejectedSubmissions: number;
  pendingSubmissions: number;
  validationRate: number;
}

export function AgentTracking() {
  const activityQuery = useQuery({
    queryKey: ["admin-agents-tracking"],
    queryFn: async () => {
      // 1. Récupérer les rôles d'agents
      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "agent");

      const agentIds = (userRoles ?? []).map((r) => r.user_id);
      if (agentIds.length === 0) return [];

      // 2. Profils des agents
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", agentIds)
        .order("full_name");

      // 3. Relevés des agents
      const { data: observations } = await supabase
        .from("observations")
        .select("id, agent_id, status, observed_at")
        .in("agent_id", agentIds)
        .order("observed_at", { ascending: false });

      const obsByAgent: Record<string, any[]> = {};
      (observations ?? []).forEach((obs) => {
        if (!obs.agent_id) return;
        if (!obsByAgent[obs.agent_id]) obsByAgent[obs.agent_id] = [];
        obsByAgent[obs.agent_id].push(obs);
      });

      const now = new Date().getTime();
      const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

      const result: AgentActivity[] = (profiles ?? []).map((p) => {
        const userObs = obsByAgent[p.id] ?? [];
        const total = userObs.length;
        const validated = userObs.filter((o) => o.status === "VALIDEE").length;
        const rejected = userObs.filter((o) => o.status === "REJETEE").length;
        const pending = userObs.filter((o) => o.status === "SYNCHRONISEE" || o.status === "EN_ATTENTE").length;
        const last = userObs.length > 0 ? userObs[0].observed_at : null;

        const isRecent = last && new Date(last).getTime() >= fourteenDaysAgo;
        const status = isRecent ? "actif" : "inactif";
        const rate = total > 0 ? Math.round((validated / (validated + rejected || 1)) * 100) : 100;

        return {
          id: p.id,
          name: p.full_name,
          email: p.email,
          phone: p.phone,
          status,
          lastSubmission: last,
          totalSubmissions: total,
          validatedSubmissions: validated,
          rejectedSubmissions: rejected,
          pendingSubmissions: pending,
          validationRate: rate,
        };
      });

      return result;
    },
  });

  const agents = activityQuery.data ?? [];
  const activeCount = agents.filter((a) => a.status === "actif").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <Activity className="h-8 w-8 text-primary" />
          <div>
            <div className="text-2xl font-bold">{agents.length}</div>
            <div className="text-xs text-muted-foreground">Agents de terrain répertoriés</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
          <div>
            <div className="text-2xl font-bold">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Agents actifs (14 derniers jours)</div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-card p-4">
          <Clock className="h-8 w-8 text-amber-500" />
          <div>
            <div className="text-2xl font-bold">
              {agents.reduce((acc, a) => acc + a.pendingSubmissions, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Relevés en attente de validation</div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Agent</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Dernier relevé</th>
              <th className="p-3 text-right">Relevés soumis</th>
              <th className="p-3 text-right">Validés</th>
              <th className="p-3 text-right">Rejetés</th>
              <th className="p-3 text-right">Taux de validation</th>
            </tr>
          </thead>
          <tbody>
            {activityQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Chargement de l'activité des agents…
                </td>
              </tr>
            ) : agents.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Aucun agent de terrain assigné pour l'instant.
                </td>
              </tr>
            ) : (
              agents.map((agent) => (
                <tr key={agent.id} className="border-t hover:bg-secondary/40">
                  <td className="p-3">
                    <div className="font-medium text-foreground">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">{agent.email}</div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        agent.status === "actif"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          agent.status === "actif" ? "bg-emerald-500" : "bg-muted-foreground"
                        }`}
                      />
                      {agent.status === "actif" ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {agent.lastSubmission ? fmtDate(agent.lastSubmission) : "Aucun relevé"}
                  </td>
                  <td className="p-3 text-right font-medium">{agent.totalSubmissions}</td>
                  <td className="p-3 text-right text-emerald-600 font-medium">
                    {agent.validatedSubmissions}
                  </td>
                  <td className="p-3 text-right text-destructive font-medium">
                    {agent.rejectedSubmissions}
                  </td>
                  <td className="p-3 text-right font-semibold">
                    <span
                      className={
                        agent.validationRate >= 80
                          ? "text-emerald-600"
                          : agent.validationRate >= 60
                          ? "text-amber-600"
                          : "text-destructive"
                      }
                    >
                      {agent.totalSubmissions > 0 ? `${agent.validationRate}%` : "—"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
