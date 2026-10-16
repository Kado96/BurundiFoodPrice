import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ImageIcon, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRef, fbu, fmtDate } from "@/lib/data";
import { Avail } from "@/components/bits";

const REASONS = ["Prix incohérent", "Mauvais produit", "Mauvaise unité", "Photo illisible ou absente", "Position GPS hors du marché", "Doublon", "Autre"];
const FLAG_LABEL: Record<string, string> = { DISTANCE: "Loin du marché", SANS_GPS: "Sans GPS", PRIX_INHABITUEL: "Prix inhabituel" };

export function Validation() {
  const ref = useRef();
  const d = ref.data;
  const [status, setStatus] = useState("SYNCHRONISEE");
  const obs = useQuery({
    queryKey: ["admin-obs", status],
    queryFn: async () => {
      const { data, error } = await supabase.from("observations").select("*").eq("status", status).order("observed_at", { ascending: false }).limit(100);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((o) => o.agent_id).filter(Boolean))] as string[];
      const { data: pf } = ids.length ? await supabase.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
      const names = Object.fromEntries((pf ?? []).map((p) => [p.id, p.full_name]));
      return (data ?? []).map((o) => ({ ...o, agent_name: o.agent_id ? names[o.agent_id] ?? "—" : "—" }));
    },
  });
  const mk = Object.fromEntries((d?.markets ?? []).map((m) => [m.id, m.name]));
  const pr = Object.fromEntries((d?.products ?? []).map((p) => [p.id, p.name]));

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {[["SYNCHRONISEE", "En attente"], ["REJETEE", "Rejetés"], ["VALIDEE", "Validés récents"]].map(([k, l]) => (
          <button key={k} onClick={() => setStatus(k!)} className={`rounded-full border px-4 py-1.5 text-sm ${status === k ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>{l}</button>
        ))}
      </div>
      {obs.isLoading ? <p className="text-muted-foreground">Chargement…</p> : !obs.data?.length ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">Aucun relevé dans cette liste.</div>
      ) : (
        <div className="space-y-3">{obs.data.map((o) => <Row key={o.id} o={o} market={mk[o.market_id]} product={pr[o.product_id]} editable={status === "SYNCHRONISEE"} />)}</div>
      )}
    </div>
  );
}

function Row({ o, market, product, editable }: { o: any; market?: string | undefined; product?: string | undefined; editable: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function showPhoto() {
    const { data } = await supabase.storage.from("photos").createSignedUrl(o.photo_url, 600);
    if (data?.signedUrl) setPhoto(data.signedUrl); else toast.error("Photo introuvable");
  }
  async function review(next: "VALIDEE" | "REJETEE") {
    if (next === "REJETEE" && !reason) { toast.error("Choisissez un motif de rejet"); return; }
    setBusy(true);
    const { error } = await supabase.from("observations").update({
      status: next, reject_reason: next === "REJETEE" ? reason : null, review_comment: comment || null,
      reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString(),
    }).eq("id", o.id);
    setBusy(false);
    if (error) { toast.error("Échec de l'enregistrement"); return; }
    toast.success(next === "VALIDEE" ? "Relevé validé et publié" : "Relevé renvoyé à l'agent");
    qc.invalidateQueries({ queryKey: ["admin-obs"] });
    qc.invalidateQueries({ queryKey: ["admin-counts"] });
    qc.invalidateQueries({ queryKey: ["latest"] });
  }
  const unitPrice = Number(o.price) / Number(o.quantity);

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold">{product}</span>
            {o.variety && <span className="text-sm text-muted-foreground">({o.variety})</span>}
            <Avail v={o.availability} />
            {(o.flags ?? []).map((f: string) => <span key={f} className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">{FLAG_LABEL[f] ?? f}</span>)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{market} · par {o.agent_name} · {fmtDate(o.observed_at)}</div>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
            <div>Prix : <b>{fbu(Number(o.price))}</b></div>
            <div>Quantité : {o.quantity} {o.unit}</div>
            <div>Prix unitaire : <b>{fbu(unitPrice)}</b>/{o.unit}</div>
            <div>Qualité : {o.quality ?? "—"}</div>
            <div>Provenance : {o.origin ?? "—"}</div>
            <div>Source : {o.source ?? "—"}</div>
            <div>Distance : {o.distance_m != null ? `${Math.round(o.distance_m)} m` : "—"}</div>
          </div>
          {o.comment && <p className="mt-2 text-sm italic">« {o.comment} »</p>}
          {o.reject_reason && <p className="mt-2 text-sm text-destructive">Motif : {o.reject_reason}{o.review_comment ? ` — ${o.review_comment}` : ""}</p>}
        </div>
        {o.photo_url && (photo
          ? <a href={photo} target="_blank" rel="noreferrer"><img src={photo} alt="Photo du relevé" className="h-28 w-28 rounded-md object-cover" /></a>
          : <button onClick={showPhoto} className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-md border text-xs text-muted-foreground"><ImageIcon className="h-6 w-6" />Voir la photo</button>)}
      </div>
      {editable && (
        <div className="mt-4 border-t pt-3">
          {rejecting ? (
            <div className="flex flex-wrap items-center gap-2">
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">
                <option value="">Motif du rejet…</option>{REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Commentaire pour l'agent" className="h-9 flex-1 rounded-md border bg-background px-2 text-sm" />
              <button disabled={busy} onClick={() => review("REJETEE")} className="h-9 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground">Confirmer le rejet</button>
              <button onClick={() => setRejecting(false)} className="h-9 px-3 text-sm">Annuler</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button disabled={busy} onClick={() => review("VALIDEE")} className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"><Check className="h-4 w-4" />Valider</button>
              <button onClick={() => setRejecting(true)} className="inline-flex h-9 items-center gap-1 rounded-md border border-destructive px-4 text-sm font-medium text-destructive"><X className="h-4 w-4" />Rejeter</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
