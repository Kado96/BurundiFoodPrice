# n8n — Burundi Food Price

## Emails = même système que les nouvelles collectes (gratuit)

Tout part de **n8n → Google Apps Script → Gmail**. Pas GitHub, pas SMTP payant.

| Source | Événement | Canal email |
|--------|-----------|-------------|
| Frontend / APK (`telemetry.ts`) | collectes, pages, logins | webhook `bfp-events` |
| Alerte nouvelle collecte | immédiat | Apps Script Gmail → `quicksales.bi@gmail.com` |
| Rapport 4h | schedule n8n | **même** Apps Script |
| Rapport quotidien 18:00 Bujumbura (+ mensuel / trim / annuel fin de période) | schedule n8n | **même** Apps Script |

Relais prod :
`https://script.google.com/macros/s/AKfycbz7pHhek_WU73YQDjHONgFEH05f9F1RWAQg8_oiTVn4JHjD-aznOKUDd79wQY8npvb0/exec`

Les rapports utilisent les **noms** (agent / marché / commune / produit), jamais les UUID. Jour vide → email avec notice « aucune collecte ».

Variable optionnelle frontend : `VITE_N8N_WEBHOOK_URL`.

## Déploiement workflow (gratuit, local)

GitHub Actions est **désactivé** (facturation). Après une modif des JSON n8n :

```bash
cd deliverables/application/BurunduFoodPrice
npm run n8n:deploy
```

Ça réveille Render, upsert + active `n8n/workflows/*.json`.

## Garder n8n éveillé (optionnel, gratuit)

Render free endort le service après ~15 min sans trafic. **Ne pas** pinger toutes les 10 min (ça use le quota gratuit).

Sur [cron-job.org](https://cron-job.org) (compte gratuit) :

1. **Job A — 1× par heure** (réveil léger, économe)
   - URL : `https://n8n-ajs5.onrender.com/healthz`
   - Intervalle : **Every hour** / cron `0 * * * *`
   - Method : GET · Timeout : 30–60 s (cold start Render)

2. **Job B — avant le rapport 18h** (important)
   - URL : même `healthz`
   - Schedule : **17:50** Africa/Bujumbura (`50 17 * * *` en TZ Bujumbura, ou `50 15 * * *` en UTC)
   - Pour que n8n soit réveillé quand le schedule 18:00 envoie le mail

Sans le job B, le rapport 18h peut rater si n8n dort entre deux pings horaires.
