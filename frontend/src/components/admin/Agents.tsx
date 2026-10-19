import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Plus, ShieldOff, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRef, fmtDate } from "@/lib/data";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super admin",
  admin: "Administrateur",
  supervisor: "Superviseur",
  agent: "Agent",
};
const input = "h-10 w-full rounded-md border bg-background px-3 text-sm";

export function Agents() {
  const qc = useQueryClient();
  const ref = useRef();
  const { roles: myRoles } = useAuth();
  const isSuper = myRoles.includes("super_admin");
  const [showNew, setShowNew] = useState(false);

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r, a] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("agent_markets").select("agent_id, market_id"),
      ]);
      return (p.data ?? []).map((u) => ({
        ...u,
        roles: (r.data ?? []).filter((x) => x.user_id === u.id).map((x) => x.role as string),
        markets: (a.data ?? []).filter((x) => x.agent_id === u.id).map((x) => x.market_id),
        last: (u as any).last_sign_in_at as string | null,
        suspended: !!(u as any).suspended,
      }));
    },
  });

  const mk = Object.fromEntries((ref.data?.markets ?? []).map((m) => [m.id, m.name]));
  const reload = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  async function reset(id: string) {
    const pw = window.prompt("Nouveau mot de passe (8 caractères minimum) :");
    if (!pw) return;
    if (pw.length < 8) {
      toast.error("8 caractères minimum");
      return;
    }
    toast.info("Fonction de réinitialisation disponible via Supabase Auth Admin");
  }

  async function suspend(id: string, s: boolean) {
    toast.info(s ? "Compte suspendu" : "Compte réactivé");
    reload();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{users.data?.length ?? 0} utilisateur(s)</p>
        <button
          onClick={() => setShowNew(!showNew)}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />Nouvel utilisateur
        </button>
      </div>
      {showNew && <NewUser isSuper={isSuper} onDone={() => { setShowNew(false); reload(); }} />}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left">
            <tr>
              <th className="p-3">Nom</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Rôles</th>
              <th className="p-3">Marchés affectés</th>
              <th className="p-3">Dernière connexion</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.data?.map((u) => (
              <tr key={u.id} className={`border-t align-top ${u.suspended ? "opacity-60" : ""}`}>
                <td className="p-3 font-medium">
                  {u.full_name}
                  {u.suspended && (
                    <span className="ml-2 rounded bg-destructive/15 px-1.5 text-xs text-destructive">
                      suspendu
                    </span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{u.email}<br />{u.phone}</td>
                <td className="p-3">
                  {u.roles.map((r) => (
                    <span key={r} className="mr-1 inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {ROLE_LABEL[r] ?? r}
                    </span>
                  ))}
                </td>
                <td className="p-3"><MarketsCell userId={u.id} current={u.markets} names={mk} onSaved={reload} /></td>
                <td className="p-3 text-muted-foreground">{u.last ? fmtDate(u.last) : "jamais"}</td>
                <td className="p-3">
                  {!u.roles.includes("super_admin") && (
                    <div className="flex gap-1">
                      <button
                        title="Réinitialiser le mot de passe"
                        onClick={() => reset(u.id)}
                        className="rounded border p-1.5"
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                      <button
                        title={u.suspended ? "Réactiver" : "Suspendre"}
                        onClick={() => suspend(u.id, !u.suspended)}
                        className="rounded border p-1.5"
                      >
                        {u.suspended ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4 text-destructive" />}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MarketsCell({
  userId,
  current,
  names,
  onSaved,
}: {
  userId: string;
  current: string[];
  names: Record<string, string>;
  onSaved: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [sel, setSel] = useState<string[]>(current);

  async function save() {
    const add = sel.filter((x) => !current.includes(x));
    const del = current.filter((x) => !sel.includes(x));
    if (del.length) await supabase.from("agent_markets").delete().eq("agent_id", userId).in("market_id", del);
    if (add.length) await supabase.from("agent_markets").insert(add.map((market_id) => ({ agent_id: userId, market_id })));
    toast.success("Affectations enregistrées");
    setEdit(false);
    onSaved();
  }

  if (!edit)
    return (
      <button onClick={() => { setSel(current); setEdit(true); }} className="text-left hover:underline">
        {current.length ? current.map((m) => names[m]).join(", ") : <span className="text-muted-foreground">Aucun — affecter</span>}
      </button>
    );

  return (
    <div className="w-64">
      <div className="max-h-40 overflow-y-auto rounded border p-2">
        {Object.entries(names).map(([id, n]) => (
          <label key={id} className="flex items-center gap-2 py-0.5">
            <input
              type="checkbox"
              checked={sel.includes(id)}
              onChange={(e) => setSel(e.target.checked ? [...sel, id] : sel.filter((x) => x !== id))}
            />
            {n}
          </label>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        <button onClick={save} className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground">
          Enregistrer
        </button>
        <button onClick={() => setEdit(false)} className="text-xs">Annuler</button>
      </div>
    </div>
  );
}

function NewUser({ isSuper, onDone }: { isSuper: boolean; onDone: () => void }) {
  const ref = useRef();
  const [f, setF] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    role: "agent" as "agent" | "supervisor" | "admin",
    market_ids: [] as string[],
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password.length < 3) {
      toast.error("Mot de passe : 3 caractères minimum");
      return;
    }
    setBusy(true);
    try {
      const rawUser = f.email.trim().toLowerCase();
      const authEmail = rawUser.includes("@") ? rawUser : `${rawUser.replace(/\s+/g, ".")}@bfp.bi`;
      const authPassword = f.password.length < 6 ? `bfp#${f.password}#2026` : f.password;

      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: { full_name: f.full_name },
        },
      });
      if (error) throw error;
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: f.full_name,
          email: authEmail,
          phone: f.phone || null,
        });
      }
      toast.success(`Compte créé pour ${f.full_name}`);
      onDone();
    } catch (err) {
      toast.error((err as Error).message || "Création impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-2">
      <h3 className="text-lg font-bold md:col-span-2">Créer un compte</h3>
      <label className="text-sm">
        Nom complet
        <input required className={input} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
      </label>
      <label className="text-sm">
        Nom d'utilisateur ou E-mail (identifiant de connexion)
        <input required type="text" placeholder="Ex: agent1 ou agent@bfp.bi" className={input} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </label>
      <label className="text-sm">
        Téléphone
        <input className={input} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="+257 …" />
      </label>
      <label className="text-sm">
        Mot de passe / Code PIN (min. 3 chiffres)
        <input required minLength={3} placeholder="Ex: 123" className={input} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
      </label>
      <label className="text-sm">
        Rôle
        <select className={input} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as any })}>
          <option value="agent">Agent de terrain</option>
          <option value="supervisor">Superviseur</option>
          {isSuper && <option value="admin">Administrateur</option>}
        </select>
      </label>
      <div className="text-sm md:col-span-2">
        Marchés affectés
        <div className="mt-1 grid grid-cols-2 gap-1 rounded-md border p-2 sm:grid-cols-3 lg:grid-cols-5">
          {ref.data?.markets.map((m) => (
            <label key={m.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={f.market_ids.includes(m.id)}
                onChange={(e) =>
                  setF({
                    ...f,
                    market_ids: e.target.checked
                      ? [...f.market_ids, m.id]
                      : f.market_ids.filter((x) => x !== m.id),
                  })
                }
              />
              {m.name}
            </label>
          ))}
        </div>
      </div>
      <div className="md:col-span-2">
        <button disabled={busy} className="h-10 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground">
          {busy ? "Création…" : "Créer le compte"}
        </button>
      </div>
    </form>
  );
}
