import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BarChart3, CheckSquare, Database, Download, Package, Store, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
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

const TABS: { k: string; lKey: TKey; i: typeof BarChart3 }[] = [
  { k: "dash", lKey: "dashboardTab", i: BarChart3 },
  { k: "valid", lKey: "validationTab", i: CheckSquare },
  { k: "data", lKey: "dataTab", i: Database },
  { k: "tracking", lKey: "trackingTab", i: Users },
  { k: "agents", lKey: "usersTab", i: Users },
  { k: "markets", lKey: "marketsTab", i: Store },
  { k: "products", lKey: "productsTab", i: Package },
  { k: "export", lKey: "exportTab", i: Download },
];

function AdminPage() {
  const { isStaff, isAdmin, roles, ready } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<string>("dash");
  if (!ready) return <Page><p className="text-muted-foreground">{t("loading")}</p></Page>;
  if (!isStaff) return (
    <Page><div className="rounded-lg border bg-card p-8 text-center">
      <h1 className="text-2xl font-bold">{t("reservedAccess")}</h1>
      <p className="mt-2 text-muted-foreground">{t("reservedAccessSub")}</p>
      <Link to="/agent" className="mt-4 inline-block text-primary underline">{t("goToAgentSpace")}</Link>
    </div></Page>
  );
  const visible = TABS.filter((t) => isAdmin || !["agents", "markets", "products"].includes(t.k));
  const roleText = roles.includes("super_admin") ? t("superAdminRole") : isAdmin ? t("adminRole") : t("supervisorRole");

  return (
    <Page>
      <PageTitle title={t("admin")} sub={`${t("connectedAs")} ${roleText}`} />
      <div className="mb-6 flex gap-1 overflow-x-auto rounded-lg border bg-card p-1">
        {visible.map((tabItem) => (
          <button key={tabItem.k} onClick={() => setTab(tabItem.k)}
            className={cn("flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium", tab === tabItem.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}>
            <tabItem.i className="h-4 w-4" />{t(tabItem.lKey)}
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
