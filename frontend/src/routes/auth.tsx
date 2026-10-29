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
  const [emailOptional, setEmailOptional] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  function formatLoginIdentifier(u: string, optEmail: string): string {
    const rawUser = u.trim().toLowerCase();
    const rawEmail = optEmail.trim().toLowerCase();

    // 1. Si un email explicite valide est saisi, on l'utilise
    if (rawEmail && rawEmail.includes("@")) {
      return rawEmail;
    }
    // 2. Si le champ username contient un '@', on le prend tel quel
    if (rawUser.includes("@")) {
      return rawUser;
    }
    // 3. Sinon, on génère l'identifiant technique Supabase unique à partir du nom d'utilisateur
    const cleanUser = rawUser.replace(/\s+/g, ".");
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
      const authEmail = formatLoginIdentifier(username, emailOptional);
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

  const input = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-8 px-4 py-8 md:grid-cols-2 md:py-12">
      <section className="hidden md:block">
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground shadow-xs"><Wheat className="h-6 w-6" /></span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight">{t("authTitle")}</h1>
        <p className="mt-3 text-muted-foreground">{t("authSub")}</p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3"><ClipboardList className="h-5 w-5 text-primary shrink-0" />{t("authOfflineBullet")}</li>
          <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary shrink-0" />{t("authVerifyBullet")}</li>
        </ul>
      </section>

      <div className="flex flex-col gap-4">
        {/* Sélecteur de langue direct en haut de la boîte d'auth */}
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{lang === "rn" ? "Ururimi :" : lang === "en" ? "Language :" : "Langue :"}</span>
          <div className="flex rounded-md border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setLang("fr")}
              className={cn("px-2.5 py-1 text-xs font-semibold rounded transition-colors", lang === "fr" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
            >
              FR
            </button>
            <button
              type="button"
              onClick={() => setLang("rn")}
              className={cn("px-2.5 py-1 text-xs font-semibold rounded transition-colors", lang === "rn" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
            >
              RN
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={cn("px-2.5 py-1 text-xs font-semibold rounded transition-colors", lang === "en" ? "bg-primary text-primary-foreground" : "hover:bg-secondary")}
            >
              EN
            </button>
          </div>
        </div>

        <form onSubmit={submit} className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-4 flex items-center gap-2 md:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><Wheat className="h-4 w-4" /></span>
            <span className="font-display font-bold text-foreground">Burundi Food Price</span>
          </div>
          <h2 className="text-2xl font-bold">{mode === "in" ? t("signInTitle") : t("createAccountTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "in" ? t("signInDesc") : t("firstAdminDesc")}
          </p>

          <div className="mt-6 space-y-4">
            {mode === "up" && (
              <label htmlFor="auth-fullname-input" className="block text-sm font-medium">Nom complet
                <input
                  id="auth-fullname-input"
                  name="full_name"
                  className={input + " mt-1"}
                  placeholder="Ex: Donald Kandeke"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </label>
            )}
            
            {/* Champ 1 : Nom d'utilisateur (OBLIGATOIRE) */}
            <div className="space-y-1.5">
              <label htmlFor="auth-username-input" className="flex items-center justify-between text-sm font-semibold">
                <span>{t("usernameLabel")}</span>
                <span className="text-xs font-normal text-destructive bg-destructive/10 px-2 py-0.5 rounded">Obligatoire</span>
              </label>
              <input
                id="auth-username-input"
                name="username"
                className={input}
                type="text"
                required
                autoComplete="username"
                placeholder={t("usernamePlaceholder")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Votre identifiant principal (ex: burundifood ou agent1)</p>
            </div>

            {/* Champ 2 : Adresse E-mail (SÉPARÉ ET OPTIONNEL) */}
            <div className="space-y-1.5 rounded-lg border border-dashed p-3 bg-muted/20">
              <label htmlFor="auth-email-optional-input" className="flex items-center justify-between text-sm font-medium text-foreground">
                <span>{t("emailOptionalLabel")}</span>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Facultatif</span>
              </label>
              <input
                id="auth-email-optional-input"
                name="email_optional"
                className={input}
                type="email"
                autoComplete="email"
                placeholder={t("emailOptionalPlaceholder")}
                value={emailOptional}
                onChange={(e) => setEmailOptional(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Laissez vide si vous n'avez pas d'e-mail. Vous pourrez l'ajouter plus tard dans votre profil.</p>
            </div>

            {/* Champ 3 : Mot de passe / Code PIN */}
            <div className="space-y-1.5">
              <label htmlFor="auth-password-input" className="flex items-center justify-between text-sm font-semibold">
                <span>{t("passwordPinLabel")}</span>
                <span className="text-xs font-normal text-destructive bg-destructive/10 px-2 py-0.5 rounded">Obligatoire</span>
              </label>
              <input
                id="auth-password-input"
                name="password"
                className={input + " mt-1"}
                type="password"
                required
                minLength={3}
                placeholder="Ex: 123 ou votre mot de passe"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              id="auth-submit-button"
              name="auth_submit"
              disabled={busy}
              className="h-11 w-full rounded-md bg-primary font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? t("pleaseWait") : mode === "in" ? t("signInBtn") : t("createAccountBtn")}
            </button>
          </div>

          <button
            id="auth-toggle-mode-button"
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "in" ? t("toggleToSignUp") : t("toggleToSignIn")}
          </button>
        </form>

        {/* Bouton clair pour basculer sur l'observatoire public des prix */}
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            {t("publicWebPrompt")}
          </p>
          <button
            id="auth-goto-public-button"
            type="button"
            onClick={handleGoToPublic}
            className="inline-flex items-center justify-center gap-2 w-full rounded-md border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-xs hover:bg-secondary transition-colors"
          >
            <span>{t("goToPublicWeb")}</span>
            <ArrowRight className="h-4 w-4 text-primary" />
          </button>
        </div>
      </div>
    </main>
  );
}
