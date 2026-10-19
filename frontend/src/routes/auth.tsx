import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, ShieldCheck, Wheat, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { setOptedForPublicWeb } from "@/lib/mobile";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error(error.message.includes("banned") ? "Compte suspendu. Contactez l'administrateur." : "E-mail ou mot de passe incorrect");
        await supabase.rpc("ensure_profile", {});
        const { data: u } = await supabase.auth.getUser();
        const { data: staff } = await supabase.rpc("is_staff", { _user_id: u.user!.id });
        toast.success("Connexion réussie");
        nav({ to: staff ? "/admin" : "/agent" });
      } else {
        if (password.length < 8) throw new Error("Le mot de passe doit contenir au moins 8 caractères");
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin, data: { full_name: name } } });
        if (error) throw new Error(error.message);
        toast.success("Compte créé. Vérifiez votre boîte e-mail pour confirmer l'adresse.");
        setMode("in");
      }
    } catch (err) {
      toast.error((err as Error).message);
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
        <h1 className="mt-6 text-4xl font-bold tracking-tight">Espace de collecte et d'administration</h1>
        <p className="mt-3 text-muted-foreground">Réservé aux agents de terrain, superviseurs et administrateurs. Les comptes agents sont créés par l'administration.</p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3"><ClipboardList className="h-5 w-5 text-primary shrink-0" />Formulaire de collecte guidé, avec GPS et photo, utilisable sans réseau.</li>
          <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary shrink-0" />Chaque prix est vérifié par un superviseur avant publication.</li>
        </ul>
      </section>

      <div className="flex flex-col gap-4">
        <form onSubmit={submit} className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-4 flex items-center gap-2 md:hidden">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground"><Wheat className="h-4 w-4" /></span>
            <span className="font-display font-bold text-foreground">Burundi Food Price</span>
          </div>
          <h2 className="text-2xl font-bold">{mode === "in" ? "Connexion" : "Créer un compte"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "in" ? "Entrez vos identifiants pour accéder à l'espace de collecte ou d'administration." : "Le premier compte créé devient super administrateur."}
          </p>

          <div className="mt-6 space-y-4">
            {mode === "up" && (
              <label htmlFor="auth-fullname-input" className="block text-sm font-medium">Nom complet
                <input
                  id="auth-fullname-input"
                  name="full_name"
                  className={input + " mt-1"}
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={100}
                />
              </label>
            )}
            <label htmlFor="auth-email-input" className="block text-sm font-medium">E-mail
              <input
                id="auth-email-input"
                name="email"
                className={input + " mt-1"}
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label htmlFor="auth-password-input" className="block text-sm font-medium">Mot de passe
              <input
                id="auth-password-input"
                name="password"
                className={input + " mt-1"}
                type="password"
                required
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button
              id="auth-submit-button"
              name="auth_submit"
              disabled={busy}
              className="h-11 w-full rounded-md bg-primary font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {busy ? "Veuillez patienter…" : mode === "in" ? "Se connecter" : "Créer le compte"}
            </button>
          </div>

          <button
            id="auth-toggle-mode-button"
            type="button"
            onClick={() => setMode(mode === "in" ? "up" : "in")}
            className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {mode === "in" ? "Premier lancement ? Créer le compte administrateur" : "J'ai déjà un compte"}
          </button>
        </form>

        {/* Bouton clair pour basculer sur l'observatoire public des prix */}
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            Vous souhaitez simplement consulter les prix du marché ?
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
