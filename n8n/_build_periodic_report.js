/**
 * Génère le HTML de rapport périodique BFP (quotidien / mensuel / trimestriel / annuel).
 * Exécuté dans n8n Code node — ce fichier est la source, injecté dans le workflow JSON.
 */

const TZ = 'Africa/Bujumbura';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2anhya253Ym5zdmdub2JiZndhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNjgxMzksImV4cCI6MjEwNzc0NDEzOX0.6BU65OVL_jcuc29NnWcQ7WiT53txB5aES8aFY4Z8ong';
const SUPABASE = 'https://jvjxrknwbnsvgnobbfwa.supabase.co';
const RELAY =
  'https://script.google.com/macros/s/AKfycbz7pHhek_WU73YQDjHONgFEH05f9F1RWAQg8_oiTVn4JHjD-aznOKUDd79wQY8npvb0/exec';
const RELAY_SECRET = 'bfp-gmail-relay-2026';
const TO = 'quicksales.bi@gmail.com';

function looksLikeUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}
function pickLabel(...cands) {
  for (const c of cands) {
    if (c == null) continue;
    const s = String(c).trim();
    if (!s || looksLikeUuid(s)) continue;
    return s;
  }
  return null;
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { timeZone: TZ });
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}
function fmtDay(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    timeZone: TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
function dayKey(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}
function startOfDayBujumbura(date = new Date()) {
  const key = dayKey(date);
  // Africa/Bujumbura = UTC+2 (no DST)
  return new Date(`${key}T00:00:00+02:00`);
}
function endOfDayBujumbura(date = new Date()) {
  const key = dayKey(date);
  return new Date(`${key}T23:59:59.999+02:00`);
}
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function periodBounds(period, now = new Date()) {
  const end = endOfDayBujumbura(now);
  if (period === 'daily') {
    return { start: startOfDayBujumbura(now), end, label: `Journée du ${fmtDay(now)}`, title: 'Rapport quotidien' };
  }
  if (period === 'monthly') {
    // Mois civil en cours (si fin de mois) ou mois précédent selon flag
    const key = dayKey(now);
    const [y, m] = key.split('-').map(Number);
    const start = new Date(`${y}-${String(m).padStart(2, '0')}-01T00:00:00+02:00`);
    return {
      start,
      end,
      label: start.toLocaleDateString('fr-FR', { timeZone: TZ, month: 'long', year: 'numeric' }),
      title: 'Rapport mensuel',
    };
  }
  if (period === 'quarterly') {
    const key = dayKey(now);
    const [y, m] = key.split('-').map(Number);
    const q = Math.floor((m - 1) / 3);
    const startMonth = q * 3 + 1;
    const start = new Date(`${y}-${String(startMonth).padStart(2, '0')}-01T00:00:00+02:00`);
    return { start, end, label: `T${q + 1} ${y}`, title: 'Rapport trimestriel' };
  }
  // annual
  const y = Number(dayKey(now).slice(0, 4));
  const start = new Date(`${y}-01-01T00:00:00+02:00`);
  return { start, end, label: `Année ${y}`, title: 'Rapport annuel' };
}

function buildReportHtml({ period, bounds, observations, agentsMap, traffic, digests }) {
  const collectCount = observations.length;
  const agentsSet = new Set(
    observations.map((o) => pickLabel(o._agentName, agentsMap[o.agent_id], o.agent_id) || 'Agent').filter(Boolean),
  );
  const marketsSet = new Set(
    observations.map((o) => pickLabel(o._marketName, o.markets?.name) || 'Marché').filter(Boolean),
  );

  let tableRows = '';
  if (collectCount === 0) {
    tableRows = `
      <tr><td colspan="7" style="padding:28px;text-align:center;background:#fef2f2;border:1px solid #fecaca;">
        <div style="font-size:28px;margin-bottom:8px;">📭</div>
        <div style="font-size:16px;font-weight:800;color:#991b1b;margin-bottom:6px;">Aucune collecte sur cette période</div>
        <div style="font-size:13px;color:#7f1d1d;line-height:1.5;">
          Aucun agent de terrain n'a transmis d'observation entre<br/>
          <strong>${escapeHtml(fmtDateTime(bounds.start))}</strong> et <strong>${escapeHtml(fmtDateTime(bounds.end))}</strong> (heure de Bujumbura).
        </div>
      </td></tr>`;
  } else {
    tableRows = observations
      .map((o, idx) => {
        const agent = escapeHtml(pickLabel(o._agentName, agentsMap[o.agent_id]) || 'Agent non identifié');
        const market = escapeHtml(pickLabel(o._marketName, o.markets?.name) || 'Marché non spécifié');
        const commune = escapeHtml(pickLabel(o._commune, o.markets?.commune) || '—');
        const product = escapeHtml(pickLabel(o._productName, o.products?.name) || 'Produit');
        const variety = o.variety ? escapeHtml(` (${o.variety})`) : '';
        const price = Number(o.price || 0).toLocaleString('fr-FR');
        const unit = escapeHtml(o.unit || 'kg');
        const qty = o.quantity ?? 1;
        const when = escapeHtml(fmtDateTime(o.observed_at || o.created_at || o.timestamp));
        const status = escapeHtml(o.status || 'SYNCHRONISEE');
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `<tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 12px;font-size:12px;color:#0f172a;white-space:nowrap;">${when}</td>
          <td style="padding:10px 12px;font-size:13px;font-weight:700;color:#0f172a;">${agent}</td>
          <td style="padding:10px 12px;font-size:13px;color:#0f172a;">${market}<div style="font-size:11px;color:#64748b;">${commune}</div></td>
          <td style="padding:10px 12px;font-size:13px;color:#0f172a;">${product}<span style="color:#64748b;font-size:11px;">${variety}</span></td>
          <td style="padding:10px 12px;font-size:13px;font-weight:800;color:#047857;text-align:right;">${price} FBu<div style="font-size:11px;font-weight:600;color:#64748b;">${qty} ${unit}</div></td>
          <td style="padding:10px 12px;font-size:11px;text-align:center;"><span style="background:#e0f2fe;color:#0369a1;padding:3px 8px;border-radius:4px;font-weight:700;">${status}</span></td>
        </tr>`;
      })
      .join('');
  }

  // Agents actifs (résumé)
  const byAgent = {};
  for (const o of observations) {
    const name = pickLabel(o._agentName, agentsMap[o.agent_id]) || 'Agent non identifié';
    byAgent[name] = (byAgent[name] || 0) + 1;
  }
  const agentSummary =
    Object.keys(byAgent).length === 0
      ? `<p style="margin:0;color:#64748b;font-size:13px;">Aucun agent n'a collecté durant cette période.</p>`
      : `<ul style="margin:0;padding-left:18px;color:#0f172a;font-size:13px;line-height:1.7;">${Object.entries(byAgent)
          .sort((a, b) => b[1] - a[1])
          .map(([n, c]) => `<li><strong>${escapeHtml(n)}</strong> — ${c} collecte(s)</li>`)
          .join('')}</ul>`;

  const digestRows = (digests || [])
    .map((d, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
      return `<tr style="background:${bg};border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 12px;font-size:12px;">${escapeHtml(d.date)}</td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;font-weight:700;">${d.unique_visitors || 0}</td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;">${d.page_views || 0}</td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;">${d.logins || 0}</td>
        <td style="padding:8px 12px;font-size:12px;text-align:right;">${d.collects || 0}</td>
      </tr>`;
    })
    .join('');

  const showDigestTable = period !== 'daily' && digests && digests.length > 0;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(bounds.title)} — Burundi Food Price</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 6px -1px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#0f766e 0%,#115e59 100%);padding:28px 24px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:rgba(255,255,255,.85);">Burundi Food Price · Observatoire</div>
    <h1 style="margin:8px 0 4px;color:#fff;font-size:24px;font-weight:800;">${escapeHtml(bounds.title)}</h1>
    <div style="color:#ccfbf1;font-size:14px;">${escapeHtml(bounds.label)} · heure de Bujumbura</div>
  </td></tr>

  <tr><td style="padding:20px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="25%" style="padding:8px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#0f766e;">${collectCount}</div><div style="font-size:11px;color:#64748b;text-transform:uppercase;">Collectes</div></td>
      <td width="25%" style="padding:8px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#0f172a;">${agentsSet.size}</div><div style="font-size:11px;color:#64748b;text-transform:uppercase;">Agents</div></td>
      <td width="25%" style="padding:8px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#0f172a;">${marketsSet.size}</div><div style="font-size:11px;color:#64748b;text-transform:uppercase;">Marchés</div></td>
      <td width="25%" style="padding:8px;text-align:center;"><div style="font-size:22px;font-weight:800;color:#0369a1;">${traffic.unique_visitors}</div><div style="font-size:11px;color:#64748b;text-transform:uppercase;">Visiteurs site</div></td>
    </tr></table>
    <div style="margin-top:8px;font-size:12px;color:#64748b;text-align:center;">
      Pages vues : <strong>${traffic.page_views}</strong> · Connexions : <strong>${traffic.logins}</strong>
    </div>
  </td></tr>

  <tr><td style="padding:24px;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">👥 Agents ayant collecté</h2>
    ${agentSummary}
  </td></tr>

  <tr><td style="padding:0 24px 24px;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">📋 Détail des collectes</h2>
    <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead><tr style="background:#0f172a;color:#fff;text-align:left;">
          <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;">Date / heure</th>
          <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;">Agent</th>
          <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;">Marché / commune</th>
          <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;">Produit</th>
          <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;text-align:right;">Prix</th>
          <th style="padding:10px 12px;font-size:11px;text-transform:uppercase;text-align:center;">Statut</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  </td></tr>

  ${
    showDigestTable
      ? `<tr><td style="padding:0 24px 24px;">
    <h2 style="margin:0 0 12px;font-size:16px;color:#0f172a;">📈 Activité web jour par jour</h2>
    <div style="overflow-x:auto;border:1px solid #e2e8f0;border-radius:8px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead><tr style="background:#134e4a;color:#fff;">
          <th style="padding:8px 12px;font-size:11px;text-align:left;">Jour</th>
          <th style="padding:8px 12px;font-size:11px;text-align:right;">Visiteurs</th>
          <th style="padding:8px 12px;font-size:11px;text-align:right;">Pages</th>
          <th style="padding:8px 12px;font-size:11px;text-align:right;">Logins</th>
          <th style="padding:8px 12px;font-size:11px;text-align:right;">Collectes</th>
        </tr></thead>
        <tbody>${digestRows}</tbody>
      </table>
    </div>
  </td></tr>`
      : ''
  }

  <tr><td align="center" style="padding:0 24px 28px;">
    <a href="https://burundi-food-price.vercel.app/admin" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:8px;">Ouvrir le back-office BFP →</a>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:12px;">
    Rapport automatique Burundi Food Price · timezone Africa/Bujumbura · n8n
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ——— n8n entry (async) ———
const staticData = $getWorkflowStaticData('global');
const trafficLogs = staticData.trafficLogs || [];
const collectLogs = staticData.collectLogs || [];
const dailyDigests = staticData.dailyDigests || {};

const now = new Date();
const key = dayKey(now);
const [y, m, d] = key.split('-').map(Number);
const lastDayOfMonth = new Date(y, m, 0).getDate();
const isMonthEnd = d === lastDayOfMonth;
const isQuarterEnd = isMonthEnd && [3, 6, 9, 12].includes(m);
const isYearEnd = isMonthEnd && m === 12;

const periods = ['daily'];
if (isMonthEnd) periods.push('monthly');
if (isQuarterEnd) periods.push('quarterly');
if (isYearEnd) periods.push('annual');

// Profiles map (best effort)
let agentsMap = {};
try {
  const pr = await this.helpers.httpRequest({
    method: 'GET',
    url: `${SUPABASE}/rest/v1/profiles?select=id,full_name,email`,
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    json: true,
  });
  for (const p of Array.isArray(pr) ? pr : []) {
    agentsMap[p.id] = pickLabel(p.full_name, p.email) || null;
  }
} catch (e) {
  // ignore — noms viendront des collectLogs
}

const emails = [];

for (const period of periods) {
  const bounds = periodBounds(period, now);
  const startIso = bounds.start.toISOString();
  const endIso = bounds.end.toISOString();

  let observations = [];
  try {
    const select =
      'id,price,quantity,unit,variety,quality,availability,created_at,observed_at,status,agent_id,markets(name,commune),products(name)';
    const url =
      `${SUPABASE}/rest/v1/observations?select=${encodeURIComponent(select)}` +
      `&observed_at=gte.${encodeURIComponent(startIso)}` +
      `&observed_at=lte.${encodeURIComponent(endIso)}` +
      `&order=observed_at.asc&limit=2000`;
    const rows = await this.helpers.httpRequest({
      method: 'GET',
      url,
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: 'count=exact' },
      json: true,
    });
    observations = Array.isArray(rows) ? rows : [];
  } catch (e) {
    observations = [];
  }

  // Enrichir avec collectLogs (noms) + filtrer borne haute
  const endMs = bounds.end.getTime();
  const startMs = bounds.start.getTime();
  observations = observations.filter((o) => {
    const t = new Date(o.observed_at || o.created_at).getTime();
    return t >= startMs && t <= endMs;
  });

  // Si Supabase vide, fallback collectLogs
  if (observations.length === 0) {
    observations = collectLogs
      .filter((c) => {
        const t = new Date(c.observed_at || c.timestamp).getTime();
        return t >= startMs && t <= endMs;
      })
      .map((c) => ({
        ...c,
        markets: { name: c.market_name, commune: c.commune },
        products: { name: c.product_name },
        _agentName: c.agent_name,
        _marketName: c.market_name,
        _productName: c.product_name,
        _commune: c.commune,
      }));
  } else {
    // Merge noms depuis collectLogs / profiles
    observations = observations.map((o) => {
      const fromLog = collectLogs.find(
        (c) =>
          (c.agent_id && c.agent_id === o.agent_id && Math.abs(new Date(c.timestamp).getTime() - new Date(o.observed_at || o.created_at).getTime()) < 120000) ||
          false,
      );
      return {
        ...o,
        _agentName: pickLabel(fromLog?.agent_name, agentsMap[o.agent_id]),
        _marketName: pickLabel(o.markets?.name, fromLog?.market_name),
        _productName: pickLabel(o.products?.name, fromLog?.product_name),
        _commune: pickLabel(o.markets?.commune, fromLog?.commune),
      };
    });
  }

  const periodTraffic = trafficLogs.filter((e) => {
    const t = new Date(e.timestamp).getTime();
    return t >= startMs && t <= endMs;
  });
  const uniq = new Set(
    periodTraffic.map((e) => (e.user_email !== 'anonymous' ? e.user_email : e.user_agent || 'unknown')),
  );
  const traffic = {
    unique_visitors: uniq.size,
    page_views: periodTraffic.filter((e) => e.action === 'page_view').length,
    logins: periodTraffic.filter((e) => e.action === 'login').length,
  };

  let digests = Object.values(dailyDigests)
    .filter((dg) => {
      const t = new Date(`${dg.date}T12:00:00+02:00`).getTime();
      return t >= startMs && t <= endMs;
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Si daily digest manquant, synthétiser
  if (period === 'daily' && digests.length === 0) {
    digests = [
      {
        date: key,
        unique_visitors: traffic.unique_visitors,
        page_views: traffic.page_views,
        logins: traffic.logins,
        collects: observations.length,
      },
    ];
  }

  const html = buildReportHtml({ period, bounds, observations, agentsMap, traffic, digests });
  const subject = `📊 [BFP] ${bounds.title} — ${bounds.label} · ${observations.length} collecte(s) · ${traffic.unique_visitors} visiteur(s)`;

  emails.push({
    json: {
      subject,
      html,
      toEmail: TO,
      period,
      collectCount: observations.length,
      uniqueVisitors: traffic.unique_visitors,
    },
  });
}

return emails;
