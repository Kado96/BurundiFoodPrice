import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { 
  Database, 
  Trash2, 
  Edit3, 
  Filter, 
  Search, 
  AlertTriangle, 
  Check, 
  X, 
  RefreshCw,
  Calendar,
  User,
  Store,
  Package
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRef, fbu, fmtDate } from "@/lib/data";
import { Avail } from "@/components/bits";

interface ObservationRecord {
  id: string;
  agent_id: string | null;
  agent_name?: string;
  market_id: string;
  product_id: string;
  variety: string | null;
  unit: string;
  quantity: number;
  price: number;
  availability: "HIGH" | "MEDIUM" | "LOW" | "OUT_OF_STOCK";
  quality: string | null;
  origin: string | null;
  comment: string | null;
  status: "SYNCHRONISEE" | "VALIDEE" | "REJETEE" | "EN_ATTENTE";
  observed_at: string;
  photo_url?: string | null;
  flags?: string[];
}

export function DataManagement() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const ref = useRef();
  const d = ref.data;

  // Filtres
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modals & Actions
  const [editingItem, setEditingItem] = useState<ObservationRecord | null>(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState<boolean>(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 1. Liste des profils agents pour le filtre
  const agentsQuery = useQuery({
    queryKey: ["admin-agents-list"],
    queryFn: async () => {
      const { data: userRoles } = await supabase.from("user_roles").select("user_id, role");
      const agentIds = (userRoles ?? []).filter(r => r.role === "agent").map(r => r.user_id);
      if (agentIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", agentIds)
        .order("full_name");
      return profiles ?? [];
    },
  });

  // 2. Requête des observations selon les filtres
  const obsQuery = useQuery({
    queryKey: ["admin-manage-observations", agentFilter, dateFrom, dateTo, statusFilter, marketFilter, productFilter],
    queryFn: async () => {
      let q = supabase
        .from("observations")
        .select("*")
        .order("observed_at", { ascending: false })
        .limit(300);

      if (agentFilter !== "all") {
        q = q.eq("agent_id", agentFilter);
      }
      if (dateFrom) {
        q = q.gte("observed_at", dateFrom);
      }
      if (dateTo) {
        q = q.lte("observed_at", dateTo + "T23:59:59");
      }
      if (statusFilter !== "all") {
        q = q.eq("status", statusFilter);
      }
      if (marketFilter !== "all") {
        q = q.eq("market_id", marketFilter);
      }
      if (productFilter !== "all") {
        q = q.eq("product_id", productFilter);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Récupérer les noms des agents
      const agentIds = [...new Set((data ?? []).map((o) => o.agent_id).filter(Boolean))] as string[];
      let namesMap: Record<string, string> = {};
      if (agentIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", agentIds);
        namesMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name]));
      }

      return (data ?? []).map((o) => ({
        ...o,
        agent_name: o.agent_id ? namesMap[o.agent_id] ?? "Agent inconnu" : "Non assigné",
      })) as ObservationRecord[];
    },
  });

  const mkMap = useMemo(() => Object.fromEntries((d?.markets ?? []).map((m) => [m.id, m.name])), [d]);
  const prMap = useMemo(() => Object.fromEntries((d?.products ?? []).map((p) => [p.id, p.name])), [d]);

  // Filtrage local texte
  const filteredList = useMemo(() => {
    const list = obsQuery.data ?? [];
    if (!searchTerm.trim()) return list;
    const term = searchTerm.toLowerCase();
    return list.filter((item) => {
      const pName = (prMap[item.product_id] ?? "").toLowerCase();
      const mName = (mkMap[item.market_id] ?? "").toLowerCase();
      const aName = (item.agent_name ?? "").toLowerCase();
      const vName = (item.variety ?? "").toLowerCase();
      return pName.includes(term) || mName.includes(term) || aName.includes(term) || vName.includes(term);
    });
  }, [obsQuery.data, searchTerm, prMap, mkMap]);

  // Actions de suppression
  const handleDeleteSingle = async (id: string) => {
    if (!isAdmin) {
      toast.error("Action réservée aux administrateurs");
      return;
    }
    if (!window.confirm("Confirmer la suppression définitive de ce relevé de prix ?")) return;

    try {
      const { error } = await supabase.from("observations").delete().eq("id", id);
      if (error) throw error;
      toast.success("Relevé supprimé avec succès");
      qc.invalidateQueries({ queryKey: ["admin-manage-observations"] });
      qc.invalidateQueries({ queryKey: ["admin-obs"] });
      qc.invalidateQueries({ queryKey: ["latest"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression");
    }
  };

  const handleDeleteBatch = async () => {
    if (!isAdmin) {
      toast.error("Action réservée aux administrateurs");
      return;
    }
    setIsDeleting(true);
    try {
      let q = supabase.from("observations").delete();
      
      // On applique exactement les mêmes filtres sélectionnés
      if (agentFilter !== "all") q = q.eq("agent_id", agentFilter);
      if (dateFrom) q = q.gte("observed_at", dateFrom);
      if (dateTo) q = q.lte("observed_at", dateTo + "T23:59:59");
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (marketFilter !== "all") q = q.eq("market_id", marketFilter);
      if (productFilter !== "all") q = q.eq("product_id", productFilter);

      // Sécurité : au moins un filtre de date ou d'agent ou de statut doit être appliqué pour le batch
      if (agentFilter === "all" && !dateFrom && !dateTo && statusFilter === "all" && marketFilter === "all" && productFilter === "all") {
        toast.error("Veuillez sélectionner au moins un filtre ou utiliser 'Supprimer toutes les collectes'");
        setIsDeleting(false);
        setConfirmDeleteBatch(false);
        return;
      }

      const { error } = await q;
      if (error) throw error;

      toast.success("Collectes filtrées supprimées avec succès");
      setConfirmDeleteBatch(false);
      qc.invalidateQueries({ queryKey: ["admin-manage-observations"] });
      qc.invalidateQueries({ queryKey: ["admin-obs"] });
      qc.invalidateQueries({ queryKey: ["latest"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la suppression groupée");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!isAdmin) {
      toast.error("Action réservée aux administrateurs");
      return;
    }
    setIsDeleting(true);
    try {
      // Suppression de tous les enregistrements
      const { error } = await supabase.from("observations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;

      toast.success("Toutes les collectes ont été supprimées");
      setConfirmDeleteAll(false);
      qc.invalidateQueries({ queryKey: ["admin-manage-observations"] });
      qc.invalidateQueries({ queryKey: ["admin-obs"] });
      qc.invalidateQueries({ queryKey: ["latest"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la réinitialisation");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("observations")
        .update({
          price: Number(editingItem.price),
          quantity: Number(editingItem.quantity),
          variety: editingItem.variety || null,
          availability: editingItem.availability,
          quality: editingItem.quality || null,
          origin: editingItem.origin || null,
          comment: editingItem.comment || null,
          status: editingItem.status,
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast.success("Relevé mis à jour");
      setEditingItem(null);
      qc.invalidateQueries({ queryKey: ["admin-manage-observations"] });
      qc.invalidateQueries({ queryKey: ["admin-obs"] });
      qc.invalidateQueries({ queryKey: ["latest"] });
    } catch (err: any) {
      toast.error(err.message || "Erreur de mise à jour");
    } finally {
      setIsSaving(false);
    }
  };

  const hasActiveFilters = agentFilter !== "all" || dateFrom || dateTo || statusFilter !== "all" || marketFilter !== "all" || productFilter !== "all";

  return (
    <div className="space-y-6">
      {/* Barre de filtres principale */}
      <div className="rounded-lg border bg-card p-4 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Filtres de recherche & d'action</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasActiveFilters && (
              <button
                type="button"
                id="btn-reset-filters"
                name="reset_filters"
                onClick={() => {
                  setAgentFilter("all");
                  setDateFrom("");
                  setDateTo("");
                  setStatusFilter("all");
                  setMarketFilter("all");
                  setProductFilter("all");
                  setSearchTerm("");
                }}
                className="h-9 rounded-md border px-3 text-xs font-medium hover:bg-secondary"
              >
                Réinitialiser les filtres
              </button>
            )}
            {isAdmin && (
              <>
                <button
                  type="button"
                  id="btn-delete-batch"
                  name="delete_batch"
                  disabled={!hasActiveFilters || filteredList.length === 0}
                  onClick={() => setConfirmDeleteBatch(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive/15 px-3 text-xs font-medium text-destructive hover:bg-destructive/25 disabled:opacity-50"
                  title="Supprimer uniquement les collectes correspondant aux filtres appliqués"
                >
                  <Trash2 className="h-4 w-4" />
                  Supprimer les résultats filtrés ({filteredList.length})
                </button>
                <button
                  type="button"
                  id="btn-delete-all"
                  name="delete_all"
                  onClick={() => setConfirmDeleteAll(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-destructive bg-transparent px-3 text-xs font-medium text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  title="Supprimer l'intégralité de la base des collectes"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Tout supprimer
                </button>
              </>
            )}
          </div>
        </div>

        {/* Champs de filtrage */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Filtre Agent */}
          <div>
            <label htmlFor="filter-agent-select" className="mb-1 block text-xs font-medium text-muted-foreground">
              Agent de terrain
            </label>
            <select
              id="filter-agent-select"
              name="filter_agent"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">Tous les agents</option>
              {(agentsQuery.data ?? []).map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.full_name} ({ag.email})
                </option>
              ))}
            </select>
          </div>

          {/* Date de début */}
          <div>
            <label htmlFor="filter-date-from" className="mb-1 block text-xs font-medium text-muted-foreground">
              Date de début
            </label>
            <input
              type="date"
              id="filter-date-from"
              name="filter_date_from"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            />
          </div>

          {/* Date de fin */}
          <div>
            <label htmlFor="filter-date-to" className="mb-1 block text-xs font-medium text-muted-foreground">
              Date de fin
            </label>
            <input
              type="date"
              id="filter-date-to"
              name="filter_date_to"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            />
          </div>

          {/* Statut */}
          <div>
            <label htmlFor="filter-status-select" className="mb-1 block text-xs font-medium text-muted-foreground">
              Statut du relevé
            </label>
            <select
              id="filter-status-select"
              name="filter_status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">Tous les statuts</option>
              <option value="SYNCHRONISEE">En attente / Synchronisée</option>
              <option value="VALIDEE">Validée (Publique)</option>
              <option value="REJETEE">Rejetée</option>
            </select>
          </div>

          {/* Marché */}
          <div>
            <label htmlFor="filter-market-select" className="mb-1 block text-xs font-medium text-muted-foreground">
              Marché
            </label>
            <select
              id="filter-market-select"
              name="filter_market"
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">Tous les marchés</option>
              {(d?.markets ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Produit */}
          <div>
            <label htmlFor="filter-product-select" className="mb-1 block text-xs font-medium text-muted-foreground">
              Produit
            </label>
            <select
              id="filter-product-select"
              name="filter_product"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
            >
              <option value="all">Tous les produits</option>
              {(d?.products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recherche textuelle libre */}
          <div className="sm:col-span-2">
            <label htmlFor="filter-search-input" className="mb-1 block text-xs font-medium text-muted-foreground">
              Recherche libre (produit, variété, agent, marché)
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                id="filter-search-input"
                name="filter_search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ex: Riz blanc, Bujumbura, Agent Test..."
                className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Résumé des résultats */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Affichage de <b>{filteredList.length}</b> relevé(s) trouvé(s)
        </span>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: ["admin-manage-observations"] })}
          className="inline-flex items-center gap-1 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </button>
      </div>

      {/* Tableau des collectes */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-3">Date</th>
              <th className="p-3">Agent</th>
              <th className="p-3">Marché</th>
              <th className="p-3">Produit</th>
              <th className="p-3">Quantité & Prix</th>
              <th className="p-3">Disponibilité</th>
              <th className="p-3">Statut</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {obsQuery.isLoading ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Chargement des données de collecte…
                </td>
              </tr>
            ) : filteredList.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Aucun relevé ne correspond aux filtres sélectionnés.
                </td>
              </tr>
            ) : (
              filteredList.map((item) => {
                const unitP = Number(item.price) / Number(item.quantity || 1);
                return (
                  <tr key={item.id} className="border-t hover:bg-secondary/40">
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(item.observed_at)}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">{item.agent_name}</div>
                    </td>
                    <td className="p-3 font-medium">
                      {mkMap[item.market_id] ?? item.market_id}
                    </td>
                    <td className="p-3">
                      <div className="font-medium text-foreground">
                        {prMap[item.product_id] ?? item.product_id}
                      </div>
                      {item.variety && (
                        <div className="text-xs text-muted-foreground">Var: {item.variety}</div>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{fbu(Number(item.price))}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.quantity} {item.unit} ({fbu(Math.round(unitP))}/{item.unit})
                      </div>
                    </td>
                    <td className="p-3">
                      <Avail v={item.availability} />
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          item.status === "VALIDEE"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : item.status === "REJETEE"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {item.status === "VALIDEE"
                          ? "Validée"
                          : item.status === "REJETEE"
                          ? "Rejetée"
                          : "En attente"}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          id={`btn-edit-obs-${item.id}`}
                          name="edit_observation"
                          onClick={() => setEditingItem({ ...item })}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="Modifier ce relevé"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            id={`btn-delete-obs-${item.id}`}
                            name="delete_observation"
                            onClick={() => handleDeleteSingle(item.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                            title="Supprimer ce relevé"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal d'édition d'un relevé */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold">Modifier le relevé</h3>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-md p-1 hover:bg-secondary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-obs-price" className="mb-1 block text-xs font-medium">
                    Prix total (FBu) *
                  </label>
                  <input
                    type="number"
                    id="edit-obs-price"
                    name="price"
                    required
                    min="1"
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-obs-qty" className="mb-1 block text-xs font-medium">
                    Quantité ({editingItem.unit}) *
                  </label>
                  <input
                    type="number"
                    id="edit-obs-qty"
                    name="quantity"
                    required
                    min="0.1"
                    step="any"
                    value={editingItem.quantity}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: Number(e.target.value) })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-obs-variety" className="mb-1 block text-xs font-medium">
                    Variété
                  </label>
                  <input
                    type="text"
                    id="edit-obs-variety"
                    name="variety"
                    value={editingItem.variety || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, variety: e.target.value })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-obs-avail" className="mb-1 block text-xs font-medium">
                    Disponibilité
                  </label>
                  <select
                    id="edit-obs-avail"
                    name="availability"
                    value={editingItem.availability}
                    onChange={(e) => setEditingItem({ ...editingItem, availability: e.target.value as any })}
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="HIGH">Abondant</option>
                    <option value="MEDIUM">Moyen</option>
                    <option value="LOW">Rare</option>
                    <option value="OUT_OF_STOCK">Rupture</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-obs-quality" className="mb-1 block text-xs font-medium">
                    Qualité
                  </label>
                  <input
                    type="text"
                    id="edit-obs-quality"
                    name="quality"
                    value={editingItem.quality || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, quality: e.target.value })}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="edit-obs-status" className="mb-1 block text-xs font-medium">
                    Statut de validation
                  </label>
                  <select
                    id="edit-obs-status"
                    name="status"
                    value={editingItem.status}
                    onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })}
                    className="h-10 w-full rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="SYNCHRONISEE">En attente (Synchronisée)</option>
                    <option value="VALIDEE">Validée (Publiée)</option>
                    <option value="REJETEE">Rejetée</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="edit-obs-comment" className="mb-1 block text-xs font-medium">
                  Remarque / Commentaire
                </label>
                <textarea
                  id="edit-obs-comment"
                  name="comment"
                  rows={2}
                  value={editingItem.comment || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, comment: e.target.value })}
                  className="w-full rounded-md border bg-background p-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="h-9 rounded-md border px-4 text-sm font-medium hover:bg-secondary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {isSaving ? "Enregistrement…" : "Enregistrer les modifications"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation de suppression groupée par filtres */}
      {confirmDeleteBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border border-destructive bg-card p-6 shadow-xl animate-in fade-in">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-6 w-6 shrink-0" />
              <h3 className="text-lg font-bold">Confirmation de suppression ciblée</h3>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer définitivement les <b>{filteredList.length}</b> relevés correspondant à vos critères actuels ?
            </p>
            <div className="mt-3 rounded-md bg-secondary p-3 text-xs space-y-1">
              <div>Agent : <b>{agentFilter === "all" ? "Tous les agents" : (agentsQuery.data?.find(a => a.id === agentFilter)?.full_name || agentFilter)}</b></div>
              <div>Période : <b>{dateFrom || "Début"} au {dateTo || "Aujourd'hui"}</b></div>
              <div>Statut : <b>{statusFilter}</b></div>
            </div>
            <p className="mt-3 text-xs font-semibold text-destructive">
              Cette action est irréversible et supprimera ces relevés de la base de données.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteBatch(false)}
                className="h-9 rounded-md border px-4 text-sm font-medium hover:bg-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteBatch}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground disabled:opacity-50"
              >
                {isDeleting ? "Suppression en cours…" : "Confirmer la suppression"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation de suppression totale (TOUTES LES COLLECTES) */}
      {confirmDeleteAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-lg border-2 border-destructive bg-card p-6 shadow-2xl animate-in fade-in">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-7 w-7 shrink-0" />
              <h3 className="text-lg font-bold">Suppression totale de toutes les données</h3>
            </div>
            <p className="mt-3 text-sm text-foreground">
              ⚠️ <b>ATTENTION :</b> Vous vous apprêtez à supprimer <b>TOUTES LES COLLECTES DE PRIX</b> enregistrées dans l'application.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Toutes les observations de tous les agents, à toutes les dates et sur tous les marchés seront effacées de façon définitive.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setConfirmDeleteAll(false)}
                className="h-9 rounded-md border px-4 text-sm font-medium hover:bg-secondary"
              >
                Annuler immédiatement
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAll}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? "Suppression totale…" : "Oui, tout supprimer définitivement"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
