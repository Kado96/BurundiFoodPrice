# n8n — Burundi Food Price

## Communication app → n8n (déjà en place)

| Source | Événement | Destination |
|--------|-----------|-------------|
| Frontend / APK (`telemetry.ts`) | collectes, page views, logins | `POST https://n8n-ajs5.onrender.com/webhook/bfp-events` |
| Workflow | alerte email + rapport 4h | Gmail via Apps Script relay |

Variable optionnelle frontend : `VITE_N8N_WEBHOOK_URL`.

## Déploiement auto en prod (à chaque `git push` sur `main`)

Le workflow GitHub Actions [`.github/workflows/deploy-n8n.yml`](../.github/workflows/deploy-n8n.yml) :

1. Réveille n8n Render
2. Upsert + active tous les JSON de `n8n/workflows/`
3. Smoke-test le webhook `bfp-events`

### Secret GitHub obligatoire

Repo **Kado96/BurundiFoodPrice** → Settings → Secrets and variables → Actions :

- `N8N_API_KEY` = même valeur que `n8n=...` dans le `.env` Jarvis

Optionnel :

- `BFP_GMAIL_RELAY_SECRET`
- Variable `BFP_GMAIL_RELAY_URL`

### Déploiement manuel local

```bash
npm run n8n:deploy
```
