import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Wheat, X } from "lucide-react";
import { useI18n, type Lang, type TKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV: { to: string; k: TKey }[] = [
  { to: "/", k: "home" },
  { to: "/carte", k: "map" },
  { to: "/marches", k: "markets" },
  { to: "/produits", k: "products" },
  { to: "/comparaison", k: "compare" },
  { to: "/statistiques", k: "stats" },
  { to: "/api-docs", k: "apiDocs" },
];

export function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const { user, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const linkCls = "rounded-md px-3 py-2 text-sm font-medium text-foreground/75 hover:bg-secondary hover:text-foreground";
  const links = (
    <>
      {NAV.map((n) => (
        <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className={linkCls}
          activeOptions={{ exact: n.to === "/" }} activeProps={{ className: "bg-secondary text-foreground" }}>
          {t(n.k)}
        </Link>
      ))}
    </>
  );
  return (
    <header className="sticky top-0 z-[1000] border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground"><Wheat className="h-5 w-5" /></span>
          <span className="font-display text-lg font-bold leading-tight">Burundi<br className="sm:hidden" /> <span className="text-accent-foreground/80">Food Price</span></span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 lg:flex">{links}</nav>
        <div className="ml-auto flex items-center gap-2">
          <select aria-label="Langue" value={lang} onChange={(e) => setLang(e.target.value as Lang)}
            className="h-9 rounded-md border bg-card px-2 text-sm">
            <option value="fr">FR</option><option value="rn">RN</option><option value="en">EN</option>
          </select>
          {user ? (
            <>
              <Link to="/agent" className={cn(linkCls, "hidden sm:inline-flex")}>{t("agent")}</Link>
              {isStaff && <Link to="/admin" className={cn(linkCls, "hidden sm:inline-flex")}>{t("admin")}</Link>}
              <button className={cn(linkCls, "hidden sm:inline-flex")} onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }}>{t("logout")}</button>
            </>
          ) : (
            <Link to="/auth" className="hidden h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground sm:inline-flex">{t("login")}</Link>
          )}
          <button className="lg:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t px-4 py-3 lg:hidden">
          {links}
          {user ? (
            <>
              <Link to="/agent" onClick={() => setOpen(false)} className={linkCls}>{t("agent")}</Link>
              {isStaff && <Link to="/admin" onClick={() => setOpen(false)} className={linkCls}>{t("admin")}</Link>}
            </>
          ) : <Link to="/auth" onClick={() => setOpen(false)} className={linkCls}>{t("login")}</Link>}
        </nav>
      )}
    </header>
  );
}
