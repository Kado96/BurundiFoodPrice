import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, ShieldCheck, Wheat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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

  const input = "h-11 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";
  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-10 px-4 py-10 md:grid-cols-2">
      <section className="hidden md:block">
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground"><Wheat /></span>
        <h1 className="mt-6 text-4xl font-bold">Espace de collecte et d'administration</h1>
        <p className="mt-3 text-muted-foreground">Réservé aux agents de terrain, superviseurs et administrateurs. Les comptes agents sont créés par l'administration.</p>
        <ul className="mt-8 space-y-4 text-sm">
          <li className="flex gap-3"><ClipboardList className="h-5 w-5 text-primary" />Formulaire de collecte guidé, avec GPS et photo, utilisable sans réseau.</li>
          <li className="flex gap-3"><ShieldCheck className="h-5 w-5 text-primary" />Chaque prix est vérifié par un superviseur avant publication.</li>
        </ul>
      </section>
      <form onSubmit={submit} className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
        <h2 className="text-2xl font-bold">{mode === "in" ? "Connexion" : "Créer un compte"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{mode === "in" ? "Utilisez l'e-mail et le mot de passe fournis par votre superviseur." : "Le premier compte créé devient super administrateur."}</p>
        <div className="mt-6 space-y-4">
          {mode === "up" && (
            <label className="block text-sm font-medium">Nom complet
              <input className={input + " mt-1"} required value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
            </label>
          )}
          <label className="block text-sm font-medium">E-mail
            <input className={input + " mt-1"} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Mot de passe
            <input className={input + " mt-1"} type="password" required autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button disabled={busy} className="h-11 w-full rounded-md bg-primary font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "Veuillez patienter…" : mode === "in" ? "Se connecter" : "Créer le compte"}
          </button>
        </div>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
          {mode === "in" ? "Premier lancement ? Créer le compte administrateur" : "J'ai déjà un compte"}
        </button>
      </form>
    </main>
  );
}
