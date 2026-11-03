/** Test du même relais Apps Script que les alertes collectes. */
const RELAY =
  process.env.BFP_GMAIL_RELAY_URL ||
  "https://script.google.com/macros/s/AKfycbz7pHhek_WU73YQDjHONgFEH05f9F1RWAQg8_oiTVn4JHjD-aznOKUDd79wQY8npvb0/exec";
const SECRET = process.env.BFP_GMAIL_RELAY_SECRET || "bfp-gmail-relay-2026";
const TO = process.env.BFP_REPORT_TO || "quicksales.bi@gmail.com";

const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px;background:#f1f5f9">
<div style="max-width:560px;margin:auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
<div style="background:#0f766e;color:#fff;padding:20px"><strong>Burundi Food Price</strong><br/>Test canal rapport = même relais que les alertes collectes</div>
<div style="padding:20px;color:#0f172a;line-height:1.5">
<p>Si tu reçois ce mail, le système d'alerte Gmail (Apps Script) fonctionne pour les rapports périodiques.</p>
<p style="font-size:13px;color:#64748b">Envoyé en local · gratuit · sans GitHub Actions</p>
</div></div></body></html>`;

const res = await fetch(RELAY, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    secret: SECRET,
    to: TO,
    subject: "[BFP] Test canal rapport = même relais que collectes",
    html,
  }),
  signal: AbortSignal.timeout(90000),
  redirect: "follow",
});
console.log("status", res.status, await res.text());
