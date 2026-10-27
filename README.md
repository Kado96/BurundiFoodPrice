# Burundi Food Price

Même split que tes autres apps (ex. Kaspersky / Kora) :

| Couche | Hébergeur | Dossier |
|--------|-----------|---------|
| Frontend | **Vercel** | `frontend/` |
| API / serveur | **Render** | `backend/` |
| DB / Auth / Storage | **Supabase** | projet `jvjxrknwbnsvgnobbfwa` |

Repo : https://github.com/Kado96/BurundiFoodPrice

---

## 1) Render (API)

Settings du Web Service :

| Champ | Valeur |
|--------|--------|
| Root Directory | `backend` |
| Build Command | `npm install` |
| Start Command | `npm start` |

Environment Variables :

```env
NODE_ENV=production
SUPABASE_URL=https://jvjxrknwbnsvgnobbfwa.supabase.co
SUPABASE_ANON_KEY=<anon jwt>
SUPABASE_SERVICE_ROLE_KEY=<sb_secret_...>
FRONTEND_URL=https://TON-APP.vercel.app
CORS_ORIGIN=http://localhost:3001,http://localhost:3000
```

Health check : `https://TON-SERVICE.onrender.com/health`

---

## 2) Vercel (Frontend)

1. Import le repo GitHub `Kado96/BurundiFoodPrice`
2. Vercel lit `vercel.json` (build `frontend`, output `frontend/dist`)
3. Environment Variables Vercel :

```env
VITE_SUPABASE_PROJECT_ID=jvjxrknwbnsvgnobbfwa
VITE_SUPABASE_URL=https://jvjxrknwbnsvgnobbfwa.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon jwt>
VITE_API_URL=https://TON-SERVICE.onrender.com
```

4. Après le premier deploy Vercel, mets l’URL Vercel dans `FRONTEND_URL` / `CORS_ORIGIN` sur Render, puis Redeploy Render.

---

## Local

```bash
# API
cd backend && npm install && npm run dev   # :4000

# Front (autre terminal)
cd frontend && npm install && npm run dev  # :3000/3001
# VITE_API_URL vide → proxy /api → :4000
```
