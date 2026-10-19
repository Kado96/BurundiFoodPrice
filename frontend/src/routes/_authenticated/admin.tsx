import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, CheckSquare, Database, Download, Package, Store, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Page, PageTitle } from "@/components/bits";
import { cn } from "@/lib/utils";
import { Dashboard } from "@/components/admin/Dashboard";
import { Validation } from "@/components/admin/Validation";
import { Agents } from "@/components/admin/Agents";
import { AgentTracking } from "@/components/admin/AgentTracking";
import { Markets, Products } from "@/components/admin/Catalog";
import { ExportPanel } from "@/components/admin/ExportPanel";
import { DataManagement } from "@/components/admin/DataManagement";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [
    { title: "Administration — Burundi Food Price" },
    { name: "description", content: "Back-office : validation des prix, agents, marchés, produits et exports." },
    { property: "og:title", content: "Administration — Burundi Food Price" },
    { property: "og:description", content: "Back-office de la plateforme de suivi des prix." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: AdminPage,
});

const TABS = [
  { k: "dash", l: "Tableau de bord", i: BarChart3 },
  { k: "valid", l: "Validation", i: CheckSquare },
  { k: "data", l: "Collectes & Données", i: Database },
  { k: "tracking", l: "Suivi des agents", i: Users },
  { k: "agents", l: "Utilisateurs", i: Users },
  { k: "markets", l: "Marchés", i: Store },
  { k: "products", l: "Produits", i: Package },
  { k: "export", l: "Export", i: Download },
] as const;

function AdminPage() {
  const { isStaff, isAdmin, roles, ready } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("dash");
  if (!ready) return <Page><p className="text-muted-foreground">Chargement…</p></Page>;
  if (!isStaff) return (
    <Page><div className="rounded-lg border bg-card p-8 text-center">
      <h1 className="text-2xl font-bold">Accès réservé</h1>
      <p className="mt-2 text-muted-foreground">Cette page est réservée aux superviseurs et administrateurs.</p>
      <Link to="/agent" className="mt-4 inline-block text-primary underline">Aller à l'espace agent</Link>
    </div></Page>
  );
  const visible = TABS.filter((t) => isAdmin || !["agents", "markets", "products"].includes(t.k));
  return (
    <Page>
      <PageTitle title="Administration" sub={`Connecté en tant que ${roles.includes("super_admin") ? "super administrateur" : isAdmin ? "administrateur" : "superviseur"}`} />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {visible.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn("flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium", tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>
            <t.i className="h-4 w-4" />{t.l}
          </button>
        ))}
      </div>
      {tab === "dash" && <Dashboard onGoValidate={() => setTab("valid")} />}
      {tab === "valid" && <Validation />}
      {tab === "data" && <DataManagement />}
      {tab === "tracking" && <AgentTracking />}
      {tab === "agents" && isAdmin && <Agents />}
      {tab === "markets" && isAdmin && <Markets />}
      {tab === "products" && isAdmin && <Products />}
      {tab === "export" && <ExportPanel />}
    </Page>
  );
}
