import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Wheat, X, Globe, User, Shield, LogOut } from "lucide-react";
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
  const linkCls = "rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors";

  return (
    <header className="sticky top-0 z-[1000] border-b bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-3 sm:px-6">
        {/* Logo de la plateforme */}
        <Link to="/" onClick={() => setOpen(false)} className="flex items-center gap-2 shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Wheat className="h-5 w-5" />
          </span>
          <span className="font-display text-base sm:text-lg font-bold leading-tight tracking-tight">
            Burundi <span className="text-primary">Food Price</span>
          </span>
        </Link>

        {/* Navigation Desktop */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={linkCls}
              activeOptions={{ exact: n.to === "/" }}
              activeProps={{ className: "bg-secondary text-primary font-semibold" }}
            >
              {t(n.k)}
            </Link>
          ))}
        </nav>

        {/* Actions Droite (Langue + Connexion + Bouton Mobile) */}
        <div className="flex items-center gap-2">
          {/* Sélecteur de langue compact et tactile */}
          <div className="relative flex items-center">
            <label htmlFor="site-language-selector" className="sr-only">Langue</label>
            <Globe className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
            <select
              id="site-language-selector"
              name="site_language"
              aria-label="Langue"
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              className="h-9 rounded-md border bg-card pl-7 pr-3 text-xs sm:text-sm font-medium shadow-xs focus:ring-1 focus:ring-primary outline-none"
            >
              <option value="fr">FR</option>
              <option value="rn">Kirundi</option>
              <option value="en">EN</option>
            </select>
          </div>

          {/* Boutons d'authentification Desktop */}
          {user ? (
            <div className="hidden sm:flex items-center gap-1.5">
              <Link to="/agent" className={linkCls}>
                {t("agent")}
              </Link>
              {isStaff && (
                <Link to="/admin" className={linkCls}>
                  {t("admin")}
                </Link>
              )}
              <button
                className={cn(linkCls, "text-destructive hover:bg-destructive/10")}
                onClick={async () => {
                  await supabase.auth.signOut();
                  nav({ to: "/" });
                }}
              >
                {t("logout")}
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="hidden h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors sm:inline-flex"
            >
              {t("login")}
            </Link>
          )}

          {/* Bouton Hamburger Mobile (Android / iOS) avec zone de touche 44px min */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-md border bg-card text-foreground lg:hidden"
            aria-label="Menu de navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menu Déroulant Mobile Pleine Largeur pour Android & Smartphones */}
      {open && (
        <div className="border-t bg-card/95 backdrop-blur-md px-4 py-4 lg:hidden shadow-lg animate-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-1.5">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex items-center rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-secondary transition-colors"
                activeOptions={{ exact: n.to === "/" }}
                activeProps={{ className: "bg-secondary text-primary font-semibold" }}
              >
                {t(n.k)}
              </Link>
            ))}

            <div className="my-2 border-t pt-2">
              {user ? (
                <>
                  <Link
                    to="/agent"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-secondary"
                  >
                    <User className="h-4 w-4" /> {t("agent")}
                  </Link>
                  {isStaff && (
                    <Link
                      to="/admin"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground hover:bg-secondary"
                    >
                      <Shield className="h-4 w-4" /> {t("admin")}
                    </Link>
                  )}
                  <button
                    onClick={async () => {
                      setOpen(false);
                      await supabase.auth.signOut();
                      nav({ to: "/" });
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-base font-medium text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4" /> {t("logout")}
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center rounded-lg bg-primary py-2.5 text-center text-base font-semibold text-primary-foreground shadow-xs"
                >
                  {t("login")}
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
