import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Camera, Check, ChevronLeft, ChevronRight, ClipboardList, CloudUpload, LocateFixed, MapPin, RefreshCw, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRef as useRefData, fbu, fmtDate, distanceM } from "@/lib/data";
import { compressImage, enqueue, getQueue, syncQueue, type LocalObs } from "@/lib/offline";
import { Page, PageTitle, Stat } from "@/components/bits";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/agent")({
  head: () => ({ meta: [
    { title: "Espace agent de terrain — Burundi Food Price" },
    { name: "description", content: "Collecte des prix sur les marchés : formulaire guidé, GPS, photo et synchronisation." },
    { property: "og:title", content: "Espace agent — Burundi Food Price" },
    { property: "og:description", content: "Collecte des prix alimentaires sur le terrain." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AgentPage,
});

const STATUS: Record<string, { l: string; c: string }> = {
  EN_ATTENTE: { l: "En attente d'envoi", c: "bg-warning/20 text-accent-foreground" },
  ERREUR: { l: "Erreur d'envoi", c: "bg-destructive/15 text-destructive" },
  SYNCHRONISEE: { l: "Envoyée, à valider", c: "bg-secondary text-foreground" },
  VALIDEE: { l: "Validée", c: "bg-success/15 text-success" },
  REJETEE: { l: "Rejetée", c: "bg-destructive/15 text-destructive" },
};
export const StatusBadge = ({ s }: { s: string }) => (
  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS[s]?.c)}>{STATUS[s]?.l ?? s}</span>
);

function useQueueState() {
  const [q, setQ] = useState<LocalObs[]>([]);
  useEffect(() => {
    const f = () => setQ(getQueue());
    f(); window.addEventListener("bfp-queue", f);
    return () => window.removeEventListener("bfp-queue", f);
  }, []);
  return q;
}

function AgentPage() {
  const { user, isStaff } = useAuth();
  const ref = useRefData();
  const qc = useQueryClient();
  const queue = useQueueState();
  const [tab, setTab] = useState<"home" | "form" | "list">("home");
  const [online, setOnline] = useState(true);
  const [sync, setSync] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    const f = () => setOnline(navigator.onLine);
    f(); window.addEventListener("online", f); window.addEventListener("offline", f);
    return () => { window.removeEventListener("online", f); window.removeEventListener("offline", f); };
  }, []);

  const assigned = useQuery({
    queryKey: ["my-markets", user?.id, isStaff],
    enabled: !!user,
    queryFn: async () => {
      if (isStaff) return null;
      const { data } = await supabase.from("agent_markets").select("market_id").eq("agent_id", user!.id);
      return (data ?? []).map((x) => x.market_id);
    },
  });
  const mine = useQuery({
    queryKey: ["my-obs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("observations").select("*").eq("agent_id", user!.id).order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  const markets = useMemo(() => {
    const all = (ref.data?.markets ?? []).filter((m) => m.active);
    return assigned.data ? all.filter((m) => assigned.data!.includes(m.id)) : all;
  }, [ref.data, assigned.data]);

  async function runSync() {
    if (!navigator.onLine) { toast.error("Pas de connexion internet"); return; }
    setSync({ done: 0, total: getQueue().length });
    try {
      const r = await syncQueue((done, total) => setSync({ done, total }));
      if (r.total) toast[r.ok === r.total ? "success" : "warning"](`${r.ok}/${r.total} observation(s) envoyée(s)`);
      qc.invalidateQueries({ queryKey: ["my-obs"] });
    } catch (e) { toast.error((e as Error).message); }
    setSync(null);
  }
  useEffect(() => { if (online && queue.some((q) => q.status === "EN_ATTENTE") && !sync) runSync(); /* auto-sync */ }, [online, queue.length]); // eslint-disable-line

  const today = new Date().toDateString();
  const obs = mine.data ?? [];
  const todayCount = obs.filter((o) => new Date(o.created_at).toDateString() === today).length + queue.length;
  const rejected = obs.filter((o) => o.status === "REJETEE");
  const pName = (id: string) => ref.data?.products.find((p) => p.id === id)?.name ?? "—";
  const mName = (id: string) => ref.data?.markets.find((m) => m.id === id)?.name ?? "—";

  return (
    <Page>
      <PageTitle title="Espace agent" sub={`Bonjour ${user?.user_metadata?.['full_name'] ?? user?.email ?? ""}`}>
        <div className="flex items-center gap-2">
          {!online && <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-3 py-1 text-xs font-medium"><WifiOff className="h-3.5 w-3.5" />Hors ligne</span>}
          <button onClick={runSync} disabled={!!sync || !queue.length} className="inline-flex h-10 items-center gap-2 rounded-md border bg-card px-3 text-sm disabled:opacity-50">
            <RefreshCw className={cn("h-4 w-4", sync && "animate-spin")} />Synchroniser ({queue.length})
          </button>
        </div>
      </PageTitle>
      {sync && (
        <div className="mb-4 rounded-md border bg-card p-3 text-sm">
          Envoi {sync.done}/{sync.total}
          <div className="mt-2 h-2 rounded bg-secondary"><div className="h-2 rounded bg-primary transition-all" style={{ width: `${sync.total ? (sync.done / sync.total) * 100 : 0}%` }} /></div>
        </div>
      )}

      <div className="mb-6 flex gap-1 rounded-lg border bg-card p-1">
        {([["home", "Tableau de bord"], ["form", "Nouvelle collecte"], ["list", "Mes observations"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn("flex-1 rounded-md px-3 py-2 text-sm font-medium", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{l}</button>
        ))}
      </div>

      {tab === "home" && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Stat label="Collectes aujourd'hui" value={todayCount} />
            <Stat label="En attente d'envoi" value={queue.length} />
            <Stat label="Validées" value={obs.filter((o) => o.status === "VALIDEE").length} />
            <Stat label="À corriger" value={rejected.length} />
          </div>
          <section>
            <h2 className="mb-3 text-lg font-semibold">Mes marchés</h2>
            {!markets.length ? <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">Aucun marché ne vous est encore affecté. Contactez votre superviseur.</p> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {markets.map((m) => {
                  const n = obs.filter((o) => o.market_id === m.id && new Date(o.created_at).toDateString() === today).length;
                  return (
                    <div key={m.id} className="rounded-lg border bg-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div><div className="font-semibold">{m.name}</div><div className="text-xs text-muted-foreground">{m.commune} · {m.market_days ?? "Tous les jours"}</div></div>
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{n} produit(s) relevé(s) aujourd'hui</span>
                        <button onClick={() => setTab("form")} className="font-medium text-primary">Collecter →</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          {!!rejected.length && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Observations à corriger</h2>
              <div className="space-y-2">{rejected.map((o) => <FixRow key={o.id} o={o} label={`${pName(o.product_id)} — ${mName(o.market_id)}`} />)}</div>
            </section>
          )}
        </div>
      )}

      {tab === "form" && <CollectForm markets={markets} onDone={() => { setTab("home"); if (navigator.onLine) runSync(); }} />}

      {tab === "list" && (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Date</th><th className="p-3">Marché</th><th className="p-3">Produit</th><th className="p-3 text-right">Prix</th><th className="p-3">Statut</th></tr></thead>
            <tbody>
              {queue.map((o) => <tr key={o.client_id} className="border-t"><td className="p-3">{fmtDate(o.observed_at)}</td><td className="p-3">{mName(o.market_id)}</td><td className="p-3">{pName(o.product_id)}</td><td className="p-3 text-right tabular-nums">{fbu(o.price)} / {o.quantity} {o.unit}</td><td className="p-3"><StatusBadge s={o.status} />{o.error && <div className="text-xs text-destructive">{o.error}</div>}</td></tr>)}
              {obs.map((o) => <tr key={o.id} className="border-t"><td className="p-3">{fmtDate(o.observed_at)}</td><td className="p-3">{mName(o.market_id)}</td><td className="p-3">{pName(o.product_id)}</td><td className="p-3 text-right tabular-nums">{fbu(o.price)} / {o.quantity} {o.unit}</td><td className="p-3"><StatusBadge s={o.status} />{o.reject_reason && <div className="text-xs text-destructive">{o.reject_reason}</div>}</td></tr>)}
              {!queue.length && !obs.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucune observation pour l'instant.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

function FixRow({ o, label }: { o: any; label: string }) {
  const qc = useQueryClient();
  const [price, setPrice] = useState(String(o.price));
  const [comment, setComment] = useState(o.comment ?? "");
  async function save() {
    const p = Number(price);
    if (!(p > 0)) { toast.error("Prix invalide"); return; }
    const { error } = await supabase.from("observations").update({ price: p, comment, status: "SYNCHRONISEE", reject_reason: null }).eq("id", o.id);
    if (error) { toast.error("Échec de l'envoi"); return; }
    toast.success("Correction envoyée");
    qc.invalidateQueries({ queryKey: ["my-obs"] });
  }
  return (
    <div className="rounded-lg border border-destructive/30 bg-card p-4">
      <div className="font-medium">{label}</div>
      <div className="mt-1 text-sm text-destructive">Motif : {o.reject_reason}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" className="h-10 w-36 rounded-md border px-2 text-sm" />
        <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire" className="h-10 flex-1 rounded-md border px-2 text-sm" />
        <button onClick={save} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Renvoyer</button>
      </div>
    </div>
  );
}

/* ---------- Formulaire guidé façon KoboCollect ---------- */
const UNITS = ["kg", "litre", "régime", "pièce", "tas", "sac 25 kg", "sac 50 kg", "bassine", "botte"];
const empty = { market_id: "", product_id: "", variety: "", quality: "moyenne", origin: "", source: "commerçant", unit: "kg", quantity: "1", price: "", availability: "disponible", comment: "" };
const STEPS = ["Localisation", "Produit", "Prix", "Photo", "Vérification"];

function Field({ label, req, hint, children }: { label: string; req?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}{req && <span className="text-destructive"> *</span>}</span>
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function Choice({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {options.map(([v, l]) => (
        <button type="button" key={v} onClick={() => onChange(v)} className={cn("flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-sm", value === v ? "border-primary bg-primary/10 font-medium" : "bg-card")}>
          <span className={cn("grid h-4 w-4 place-items-center rounded-full border", value === v && "border-primary bg-primary")}>{value === v && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}</span>{l}
        </button>
      ))}
    </div>
  );
}

function CollectForm({ markets, onDone }: { markets: { id: string; name: string; lat: number; lng: number }[]; onDone: () => void }) {
  const ref = useRefData();
  const [step, setStep] = useState(0);
  const [f, setF] = useState(empty);
  const [gps, setGps] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [median, setMedian] = useState<number | null>(null);
  const set = (k: keyof typeof empty) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const input = "h-11 w-full rounded-md border bg-card px-3 text-sm";

  const market = markets.find((m) => m.id === f.market_id);
  const product = ref.data?.products.find((p) => p.id === f.product_id);
  const dist = gps && market ? distanceM(gps, market) : null;
  const unitPrice = Number(f.price) / Math.max(Number(f.quantity) || 1, 0.001);
  const deviation = median && unitPrice ? ((unitPrice - median) / median) * 100 : null;

  useEffect(() => { if (product) setF((s) => ({ ...s, unit: product.default_unit })); }, [product?.id]); // eslint-disable-line
  useEffect(() => {
    setMedian(null);
    if (f.market_id && f.product_id && navigator.onLine)
      supabase.rpc("median_price", { _market: f.market_id, _product: f.product_id }).then(({ data }) => setMedian(data ? Number(data) : null));
  }, [f.market_id, f.product_id]);

  function captureGps() {
    if (!navigator.geolocation) { toast.error("GPS indisponible sur cet appareil"); return; }
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }); setGpsBusy(false); },
      () => { toast.error("Position introuvable. Activez la localisation."); setGpsBusy(false); },
      { enableHighAccuracy: true, timeout: 20000 },
    );
  }

  const errors: string[] = [];
  if (step === 0 && !f.market_id) errors.push("Choisissez le marché");
  if (step === 1 && !f.product_id) errors.push("Choisissez le produit");
  if (step === 2) {
    if (!(Number(f.price) > 0)) errors.push("Le prix doit être supérieur à 0");
    if (!(Number(f.quantity) > 0)) errors.push("La quantité doit être supérieure à 0");
  }
  const next = () => { if (errors.length) { toast.error(errors[0]); return; } setStep((s) => Math.min(s + 1, 4)); };

  function save() {
    const flags: string[] = [];
    if (dist != null && dist > 1000) flags.push("DISTANCE");
    if (!gps) flags.push("SANS_GPS");
    if (deviation != null && Math.abs(deviation) > 30) flags.push("PRIX_INHABITUEL");
    enqueue({
      client_id: crypto.randomUUID(), market_id: f.market_id, product_id: f.product_id, variety: f.variety, quality: f.quality,
      origin: f.origin, source: f.source, unit: f.unit, quantity: Number(f.quantity), price: Number(f.price), availability: f.availability,
      comment: f.comment, lat: gps?.lat ?? null, lng: gps?.lng ?? null, gps_accuracy: gps?.acc ?? null, distance_m: dist,
      flags, photo, observed_at: new Date().toISOString(), status: "EN_ATTENTE",
    });
    toast.success("Observation enregistrée sur le téléphone");
    const keep = f.market_id;
    setF({ ...empty, market_id: keep }); setPhoto(null); setStep(1);
    if (!confirm("Enregistrer un autre produit dans ce même marché ?")) onDone();
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-2 flex justify-between text-xs text-muted-foreground"><span>Étape {step + 1} sur 5 — {STEPS[step]}</span><span>{Math.round(((step + 1) / 5) * 100)} %</span></div>
      <div className="mb-6 h-2 rounded bg-secondary"><div className="h-2 rounded bg-primary transition-all" style={{ width: `${((step + 1) / 5) * 100}%` }} /></div>

      <div className="space-y-5 rounded-xl border bg-card p-5 md:p-6">
        {step === 0 && <>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardList className="h-5 w-5 text-primary" />Où faites-vous le relevé ?</h2>
          <Field label="Marché" req><select className={input} value={f.market_id} onChange={(e) => set("market_id")(e.target.value)}><option value="">— Sélectionner —</option>{markets.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
          <Field label="Position GPS" hint="Recommandé : placez-vous dans le marché avant de capturer.">
            <button type="button" onClick={captureGps} className="inline-flex h-11 items-center gap-2 rounded-md border bg-secondary px-4 text-sm font-medium"><LocateFixed className={cn("h-4 w-4", gpsBusy && "animate-pulse")} />{gpsBusy ? "Recherche…" : gps ? "Recapturer la position" : "Capturer ma position"}</button>
            {gps && <div className="mt-2 text-sm">{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} · précision ±{Math.round(gps.acc)} m{dist != null && <> · à <b>{dist < 1000 ? `${Math.round(dist)} m` : `${(dist / 1000).toFixed(1)} km`}</b> du marché</>}</div>}
            {dist != null && dist > 1000 && <Warn>Vous semblez loin du marché sélectionné. L'observation sera signalée au superviseur.</Warn>}
          </Field>
        </>}

        {step === 1 && <>
          <h2 className="text-lg font-semibold">Quel produit ?</h2>
          <Field label="Produit" req>
            <select className={input} value={f.product_id} onChange={(e) => set("product_id")(e.target.value)}>
              <option value="">— Sélectionner —</option>
              {ref.data?.categories.map((c) => <optgroup key={c.id} label={c.name}>{ref.data!.products.filter((p) => p.category_id === c.id && p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>)}
            </select>
          </Field>
          <Field label="Variété" hint="Facultatif, ex. : riz Kigori, haricot Kirundo"><input className={input} value={f.variety} onChange={(e) => set("variety")(e.target.value)} maxLength={80} /></Field>
          <Field label="Qualité"><Choice value={f.quality} onChange={set("quality")} options={[["bonne", "Bonne"], ["moyenne", "Moyenne"], ["faible", "Faible"]]} /></Field>
          <Field label="Provenance" hint="Facultatif"><input className={input} value={f.origin} onChange={(e) => set("origin")(e.target.value)} maxLength={80} placeholder="Ex. : Imbo, Tanzanie" /></Field>
        </>}

        {step === 2 && <>
          <h2 className="text-lg font-semibold">Prix observé</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Unité de vente" req><select className={input} value={f.unit} onChange={(e) => set("unit")(e.target.value)}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></Field>
            <Field label="Quantité" req><input className={input} type="number" inputMode="decimal" min="0" step="0.1" value={f.quantity} onChange={(e) => set("quantity")(e.target.value)} /></Field>
          </div>
          <Field label="Prix payé (FBu)" req hint="Prix total pour la quantité indiquée"><input className={cn(input, "text-lg font-semibold")} type="number" inputMode="numeric" min="0" value={f.price} onChange={(e) => set("price")(e.target.value)} /></Field>
          {Number(f.price) > 0 && <div className="rounded-md bg-secondary/60 p-3 text-sm">Prix unitaire : <b>{fbu(unitPrice)} / {f.unit}</b>{median && <> · médiane récente : {fbu(median)}</>}</div>}
          {deviation != null && Math.abs(deviation) > 30 && <Warn>Ce prix est {deviation > 0 ? "supérieur" : "inférieur"} de {Math.abs(deviation).toFixed(0)} % à la médiane récente. Vérifiez avant de continuer.</Warn>}
          <Field label="Disponibilité" req><Choice value={f.availability} onChange={set("availability")} options={[["disponible", "Disponible"], ["faible", "Faible"], ["indisponible", "Non disponible"]]} /></Field>
          <Field label="Source du prix"><Choice value={f.source} onChange={set("source")} options={[["commerçant", "Commerçant"], ["achat", "Achat réel"], ["observation", "Affichage"]]} /></Field>
        </>}

        {step === 3 && <>
          <h2 className="text-lg font-semibold">Photo et commentaire</h2>
          <Field label="Photo du produit" hint="Facultatif mais recommandé pour la validation">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-sm text-muted-foreground">
              {photo ? <img src={photo} alt="Aperçu du produit" className="max-h-56 rounded" /> : <><Camera className="h-8 w-8" />Prendre ou choisir une photo</>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setPhoto(await compressImage(file)); }} />
            </label>
            {photo && <button type="button" onClick={() => setPhoto(null)} className="mt-2 text-sm text-destructive">Retirer la photo</button>}
          </Field>
          <Field label="Commentaire"><textarea className="min-h-24 w-full rounded-md border bg-card p-3 text-sm" value={f.comment} onChange={(e) => set("comment")(e.target.value)} maxLength={500} /></Field>
        </>}

        {step === 4 && <>
          <h2 className="text-lg font-semibold">Vérifiez avant d'enregistrer</h2>
          <dl className="divide-y rounded-md border text-sm">
            {[["Marché", market?.name], ["Position GPS", gps ? `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "Non capturée"], ["Produit", product?.name], ["Variété", f.variety || "—"], ["Qualité", f.quality], ["Prix", `${fbu(Number(f.price))} pour ${f.quantity} ${f.unit}`], ["Prix unitaire", `${fbu(unitPrice)} / ${f.unit}`], ["Disponibilité", f.availability], ["Source", f.source], ["Photo", photo ? "Oui" : "Non"], ["Commentaire", f.comment || "—"]].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 p-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
            ))}
          </dl>
        </>}
      </div>

      <div className="mt-4 flex justify-between gap-2">
        <button disabled={step === 0} onClick={() => setStep(step - 1)} className="inline-flex h-11 items-center gap-1 rounded-md border bg-card px-4 text-sm disabled:opacity-40"><ChevronLeft className="h-4 w-4" />Précédent</button>
        {step < 4
          ? <button onClick={next} className="inline-flex h-11 items-center gap-1 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground">Suivant<ChevronRight className="h-4 w-4" /></button>
          : <button onClick={save} className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"><Check className="h-4 w-4" />Enregistrer</button>}
      </div>
      <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><CloudUpload className="h-3.5 w-3.5" />Les observations sont gardées sur le téléphone et envoyées dès qu'il y a du réseau.</p>
    </div>
  );
}

const Warn = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-2 flex gap-2 rounded-md bg-warning/20 p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0" />{children}</div>
);
