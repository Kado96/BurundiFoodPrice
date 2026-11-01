import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, ShieldCheck, Wheat, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setOptedForPublicWeb } from "@/lib/mobile";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Connexion agents et administrateurs — Burundi Food Price" },
    { name: "description", content: "Espace sécurisé des agents de terrain, superviseurs et administrateurs de Burundi Food Price." },
    { property: "og:title", content: "Connexion — Burundi Food Price" },
    { property: "og:description", content: "Accès sécurisé à la collecte et au back-office." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  function formatLoginIdentifier(rawUser: string): string {
    const trimmed = rawUser.trim();
    if (trimmed.includes("@")) {
      return trimmed.toLowerCase();
    }
    const cleanUser = trimmed.toLowerCase().replace(/\s+/g, ".");
    return `${cleanUser}@bfp.bi`;
  }

  function formatAuthPassword(raw: string): string {
    if (raw.length >= 3 && raw.length < 6) {
      return `bfp#${raw}#2026`;
    }
    return raw;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      toast.error(t("usernameLabel") + " obligatoire");
      return;
    }
    if (password.length < 3) {
      toast.error(t("passwordPinLabel"));
      return;
    }
    setBusy(true);
    try {
      const authEmail = formatLoginIdentifier(username);
      const authPassword = formatAuthPassword(password);

      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: authEmail, 
          password: authPassword 
        });
        if (error) {
          const fallback = await supabase.auth.signInWithPassword({ 
            email: authEmail, 
            password: password 
          });
          if (fallback.error) {
            throw new Error(error.message.includes("banned") ? "Compte suspendu. Contactez l'administrateur." : "Identifiant ou mot de passe incorrect");
          }
        }
        await supabase.rpc("ensure_profile", { _full_name: name || username });
        const { data: u } = await supabase.auth.getUser();
        const { data: staff } = await supabase.rpc("is_staff", { _user_id: u.user!.id });
        toast.success(lang === "rn" ? "Mwinjiye neza" : lang === "en" ? "Sign in successful" : "Connexion réussie");
        nav({ to: staff ? "/admin" : "/agent" });
      } else {
        const { error } = await supabase.auth.signUp({ 
          email: authEmail, 
          password: authPassword, 
          options: { emailRedirectTo: window.location.origin, data: { full_name: name || username } } 
        });
        if (error) throw new Error(error.message);
        toast.success(lang === "rn" ? "Konti yaremwe neza!" : lang === "en" ? "Account created successfully!" : "Compte créé avec succès !");
        setMode("in");
      }
    } catch (err) {
      const msg = (err as Error).message || "";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ERR_NAME_NOT_RESOLVED") || !navigator.onLine) {
        toast.error("Erreur de connexion Internet : impossible de joindre le serveur. Vérifiez votre connexion.");
      } else {
        toast.error(msg);
      }
    } finally { setBusy(false); }
  }

  function handleGoToPublic() {
    setOptedForPublicWeb(true);
    nav({ to: "/" });
  }

  const inputClass = "h-11 w-full rounded-lg border border-input bg-background/50 px-3.5 text-sm font-medium transition-colors placeholder:text-muted-foreground/60 focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center px-4 py-8 md:py-12">
      <div className="grid w-full items-center gap-8 lg:grid-cols-12">
        {/* Colonne présentation (desktop) */}
        <section className="hidden lg:col-span-6 lg:block lg:pr-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border bg-card p-2 shadow-sm">
            <img src="/logo-icon.png" alt="Burundi Food Price" className="h-full w-full object-contain" />
          </div>
          <h1 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            {t("authTitle")}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            {t("authSub")}
          </p>
          <div className="mt-8 space-y-4 rounded-xl border bg-card/60 p-5 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                <ClipboardList className="h-5 w-5" />
              </div>
              <p className="text-sm text-foreground/90 leading-snug">{t("authOfflineBullet")}</p>
            </div>
            <div className="flex items-start gap-3.5">
              <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <p className="text-sm text-foreground/90 leading-snug">{t("authVerifyBullet")}</p>
            </div>
          </div>
        </section>

        {/* Colonne formulaire */}
        <div className="w-full max-w-md mx-auto lg:col-span-6 flex flex-col gap-4">
          {/* Sélecteur de langue */}
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <span className="font-medium">{lang === "rn" ? "Ururimi :" : lang === "en" ? "Language :" : "Langue :"}</span>
            <div className="flex rounded-lg border bg-card p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setLang("fr")}
                className={cn("px-2.5 py-1 text-xs font-semibold rounded-md transition-colors", lang === "fr" ? "bg-primary text-primary-foreground shadow-xs" : "hover:bg-secondary text-muted-foreground")}
              >
                FR
              </button>
              <button
                type="button"
                onClick={() => setLang("rn")}
                className={cn("px-2.5 py-1 text-xs font-semibold rounded-md transition-colors", lang === "rn" ? "bg-primary text-primary-foreground shadow-xs" : "hover:bg-secondary text-muted-foreground")}
              >
                RN
              </button>
              <button
                type="button"
                onClick={() => setLang("en")}
                className={cn("px-2.5 py-1 text-xs font-semibold rounded-md transition-colors", lang === "en" ? "bg-primary text-primary-foreground shadow-xs" : "hover:bg-secondary text-muted-foreground")}
              >
                EN
              </button>
            </div>
          </div>

          <form onSubmit={submit} className="rounded-2xl border bg-card p-6 shadow-md transition-shadow hover:shadow-lg sm:p-8">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card p-1.5 shadow-2xs">
                <img src="/logo-icon.png" alt="Burundi Food Price" className="h-full w-full object-contain" />
              </div>
              <div>
                <span className="font-display font-bold text-base text-foreground leading-none block">Burundi Food Price</span>
                <span className="text-xs text-muted-foreground">{t("agent")} &bull; {t("admin")}</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-foreground">{mode === "in" ? t("signInTitle") : t("createAccountTitle")}</h2>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
              {mode === "in" ? t("signInDesc") : t("firstAdminDesc")}
            </p>

            <div className="mt-6 space-y-4">
              {mode === "up" && (
                <div className="space-y-1.5">
                  <label htmlFor="auth-fullname-input" className="block text-sm font-semibold text-foreground">
                    Nom complet
                  </label>
                  <input
                    id="auth-fullname-input"
                    name="full_name"
                    className={inputClass}
                    placeholder="Ex: Donald Kandeke"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={100}
                  />
                </div>
              )}
              
              {/* Nom d'utilisateur (OBLIGATOIRE) */}
              <div className="space-y-1.5">
                <label htmlFor="auth-username-input" className="flex items-center justify-between text-sm font-semibold text-foreground">
                  <span>{t("usernameLabel")}</span>
                  <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Requis</span>
                </label>
                <input
                  id="auth-username-input"
                  name="username"
                  className={inputClass}
                  type="text"
                  required
                  autoComplete="username"
                  placeholder={t("usernamePlaceholder")}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">Votre identifiant de connexion (ex: agent1 ou burundifood)</p>
              </div>

              {/* Mot de passe / Code PIN */}
              <div className="space-y-1.5">
                <label htmlFor="auth-password-input" className="flex items-center justify-between text-sm font-semibold text-foreground">
                  <span>{t("passwordPinLabel")}</span>
                  <span className="text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Requis</span>
                </label>
                <input
                  id="auth-password-input"
                  name="password"
                  className={inputClass}
                  type="password"
                  required
                  minLength={3}
                  placeholder="••••••••"
                  autoComplete={mode === "in" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <button
                id="auth-submit-button"
                name="auth_submit"
                disabled={busy}
                className="mt-2 h-11 w-full rounded-lg bg-primary font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow disabled:opacity-60 cursor-pointer"
              >
                {busy ? t("pleaseWait") : mode === "in" ? t("signInBtn") : t("createAccountBtn")}
              </button>
            </div>
          </form>

          {/* Accès observatoire public */}
          <div className="rounded-xl border border-dashed bg-muted/40 p-4 text-center">
            <p className="text-xs text-muted-foreground mb-2.5">
              {t("publicWebPrompt")}
            </p>
            <button
              id="auth-goto-public-button"
              type="button"
              onClick={handleGoToPublic}
              className="inline-flex items-center justify-center gap-2 w-full rounded-lg border bg-card px-4 py-2.5 text-xs sm:text-sm font-semibold text-foreground shadow-2xs hover:bg-secondary transition-colors cursor-pointer"
            >
              <span>{t("goToPublicWeb")}</span>
              <ArrowRight className="h-4 w-4 text-primary" />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
