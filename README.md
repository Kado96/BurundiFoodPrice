# 🌾 Burundi Food Price (BurunduFoodPrice)

Plateforme web et application mobile de surveillance, collecte et analyse des prix des denrées alimentaires sur les marchés du Burundi (Bujumbura et provinces).

---

## 🏗️ Architecture du Projet

Le projet est structuré en deux dossiers distincts et indépendants :

```text
BurunduFoodPrice/
├── frontend/             # Application Web React 19 (Vite) + Application Mobile (Capacitor Android)
│   ├── src/              # Code source UI (routes, composants, i18n, anomalies)
│   ├── resources/        # Assets haute définition (icon.png, splash.png)
│   ├── android/          # Projet natif Android Studio (Gradle, APK debug)
│   ├── .env              # Configuration publique Supabase (URL + anon key)
│   └── package.json      # Scripts de démarrage et dépendances
│
├── backend/              # Infrastructure BaaS Supabase & Données
│   ├── supabase/         # Schémas et migrations SQL
│   └── .env              # Clés secrètes privées (service_role, hors frontend)
│
└── README.md             # Guide de démarrage local et déploiement
```

---

## ⚡ Prérequis

- [Bun](https://bun.sh/) (recommandé) ou [Node.js](https://nodejs.org/) (v18+)
- [Git](https://git-scm.com/)
- [Java JDK 17](https://adoptium.net/) (uniquement nécessaire pour compiler l'application Android)
- [Android Studio](https://developer.android.com/studio) (optionnel, pour tester sur émulateur ou appareil Android)

---

## 🚀 Démarrage Rapide en Local (Web)

### 1. Cloner ou ouvrir le projet

Ouvrez un terminal dans le dossier `frontend` :

```bash
cd E:\Application\jarvis-starter-kit\deliverables\application\BurunduFoodPrice\frontend
```

### 2. Vérifier les variables d'environnement

Assurez-vous que le fichier `frontend/.env` contient vos identifiants Supabase publics :

```env
VITE_SUPABASE_PROJECT_ID="jvjxrknwbnsvgnobbfwa"
VITE_SUPABASE_URL="https://jvjxrknwbnsvgnobbfwa.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="votre_cle_anon_jwt_ici"
```

### 3. Installer les dépendances (si premier lancement)

```bash
bun install
# ou avec npm :
# npm install
```

### 4. Lancer le serveur de développement

```bash
bun run dev
# ou avec npm :
# npm run dev
```

L'application démarre immédiatement sur :
👉 **http://localhost:3000** (ou le port affiché dans votre terminal)

---

## 🌐 Déploiement en Production (1-Clic)

Le projet dispose de toutes les configurations prêtes pour la production :

### Option 1 : Déploiement Vercel (Frontend Web)
1. Fichier de routage SPA inclus : [`frontend/vercel.json`](file:///E:/Application/jarvis-starter-kit/deliverables/application/BurunduFoodPrice/frontend/vercel.json).
2. Connectez le dépôt GitHub sur **[vercel.com](https://vercel.com/)**.
3. Choisissez le dossier racine **`frontend`** et renseignez les 3 variables d'environnement Supabase.

### Option 2 : Déploiement Render (Blueprint 1-Clic Backend + Frontend)
1. Fichier Blueprint inclus : [`render.yaml`](file:///E:/Application/jarvis-starter-kit/deliverables/application/BurunduFoodPrice/render.yaml).
2. Sur **[dashboard.render.com](https://dashboard.render.com/)**, cliquez sur **"New +"** ➔ **"Blueprint"**.
3. Sélectionnez le dépôt `Kado96/BurundiFoodPrice`. Render déploiera automatiquement l'API backend et le site web !

---

## 🖥️ Démarrage du Backend API (Express + Node.js)

Le backend est une API Express légère qui gère les opérations d'administration sécurisées (création d'agents, gestion des rôles) qui nécessitent la clé secrète Supabase `service_role` (jamais exposée au frontend).

> **Note :** Le frontend React (affichage des prix, carte, statistiques) communique directement avec Supabase via la clé publique `anon`. Le backend n'est nécessaire que pour les actions d'administration avancées.

### 1. Aller dans le dossier backend

```bash
cd E:\Application\jarvis-starter-kit\deliverables\application\BurunduFoodPrice\backend
```

### 2. Vérifier les variables d'environnement

Le fichier `backend/.env` doit contenir :

```env
SUPABASE_URL=https://jvjxrknwbnsvgnobbfwa.supabase.co
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
PORT=4000
```

### 3. Installer les dépendances (si premier lancement)

```bash
npm install
```

### 4. Démarrer le serveur backend

```bash
# Démarrage simple (production locale)
node src/index.js

# Démarrage avec rechargement automatique (développement)
node --watch src/index.js
```

Le backend démarre sur :
👉 **http://localhost:4000**

### 5. Vérifier que le backend fonctionne

Ouvre un navigateur ou un terminal et teste :

```bash
# Vérification santé de l'API
curl http://localhost:4000/health

# Réponse attendue :
# {"ok":true,"time":"2026-10-28T..."}
```

### Routes disponibles du backend

| Méthode | Route | Description |
|---------|-------|-------------|
| `GET` | `/` | Informations sur l'API |
| `GET` | `/health` | Vérification que le service est actif |
| `GET` | `/api/admin/users` | Liste des agents et utilisateurs |
| `POST` | `/api/admin/users` | Créer un nouvel agent ou administrateur |
| `PATCH` | `/api/admin/users/:id` | Modifier un utilisateur |
| `DELETE` | `/api/admin/users/:id` | Supprimer un utilisateur |

> Toutes les routes `/api/admin/*` nécessitent un token JWT administrateur valide.

---

## 🔄 Synchronisation de la Base de Données (`/sync`)

Le projet est désormais connecté au module universel `jarvis-universal-db-sync` configuré avec les tables officielles (`provinces`, `categories`, `markets`, `products`, `observations`, `profiles`, `user_roles`).

### Pour synchroniser en 1 clic :

1. **Via la commande Jarvis :**
   Tapez simplement dans le chat :
   ```text
   /sync
   ```

2. **Via le terminal (dossier frontend ou backend) :**
   ```bash
   # Depuis backend/
   npm run sync

   # Depuis frontend/
   bun run sync:db
   ```

3. **Pour simuler avant d'appliquer (Dry Run) :**
   ```bash
   npm run sync:dry
   ```

---

## 🚀 Démarrage Complet (Frontend + Backend simultanément)

Ouvre **2 terminaux** :

**Terminal 1 — Frontend (Web/Mobile) :**
```bash
cd E:\Application\jarvis-starter-kit\deliverables\application\BurunduFoodPrice\frontend
bun run dev
# → http://localhost:3000
```

**Terminal 2 — Backend API :**
```bash
cd E:\Application\jarvis-starter-kit\deliverables\application\BurunduFoodPrice\backend
node src/index.js
# → http://localhost:4000
```

---

## 📱 Démarrage & Build de l'Application Mobile (Android)

Toutes les icônes et splash screens sont déjà générés et intégrés depuis `frontend/resources/`.

### 1. Synchroniser le Web avec le projet Android

Après toute modification du code React, compilez et synchronisez :

```bash
cd frontend
bun run sync:android
```

### 2. Ouvrir dans Android Studio

Pour exécuter sur un émulateur ou brancher un smartphone Android :

```bash
cd frontend
npx cap open android
```

### 3. Compiler l'APK directement en ligne de commande

```bash
cd frontend\android
gradlew.bat assembleDebug --no-daemon
```

L'APK généré se trouvera dans :
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔐 Accès et Comptes Utilisateurs

- **Identifiant :** Tapez simplement `burundifood` (converti automatiquement en `burundifood@bfp.bi`).
- **Mot de passe :** Votre mot de passe défini dans Supabase Auth.
- **Redirection automatique :**
  - Administrateurs et superviseurs → `/admin`
  - Agents de terrain → `/agent`

---

## 🛠️ Fonctionnalités Clés Incluses

- 📊 **Tableau de bord public** : Tendances de prix, comparaisons entre marchés, filtres par provinces.
- 🗺️ **Carte interactive** : Géolocalisation des marchés du Burundi avec statut et prix récents.
- 👥 **Suivi des agents (Admin)** : Taux de validation des relevés, indicateurs d'activité en temps réel.
- 🚨 **Détection d'anomalies de prix** : Alerte automatique en cas d'écart relatif supérieur à 35% et contrôle GPS des relevés.
- 🌐 **Multilingue (i18n)** : Français (FR), Kirundi (RN) et Anglais (EN).
- 📖 **Documentation API** : Page interactive `/api-docs` accessible directement dans la barre de navigation.


---

## 📱 Démarrage & Build de l'Application Mobile (Android)

Toutes les icônes et splash screens sont déjà générés et intégrés depuis `frontend/resources/`.

### 1. Synchroniser le Web avec le projet Android

Après toute modification du code React, compilez et synchronisez :

```bash
cd frontend
bun run sync:android
```

### 2. Ouvrir dans Android Studio

Pour exécuter sur un émulateur ou brancher un smartphone Android :

```bash
cd frontend
npx cap open android
```

### 3. Compiler l'APK directement en ligne de commande

Si vous souhaitez générer un nouveau fichier d'installation `.apk` sans ouvrir Android Studio :

```bash
cd frontend\android
gradlew.bat assembleDebug --no-daemon
```

L'APK généré se trouvera dans :
`frontend/android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔐 Accès et Comptes Utilisateurs

L'authentification gère automatiquement les identifiants locaux :

- **Identifiant :** Tapez simplement `burundifood` (l'application le convertit automatiquement en `burundifood@bfp.bi`).
- **Mot de passe :** Votre mot de passe défini dans Supabase Auth (ex: `admin@` ou `admin@2026`).
- **Redirection automatique :**
  - Les administrateurs et superviseurs sont automatiquement redirigés vers l'espace **/admin**.
  - Les agents de terrain sont redirigés vers l'espace de saisie **/agent**.

---

## 🛠️ Fonctionnalités Clés Incluses

- 📊 **Tableau de bord public** : Tendances de prix, comparaisons entre marchés, filtres par provinces.
- 🗺️ **Carte interactive** : Géolocalisation des marchés du Burundi avec statut et prix récents.
- 👥 **Suivi des agents (Admin)** : Taux de validation des relevés, indicateurs d'activité en temps réel.
- 🚨 **Détection d'anomalies de prix** : Alerte automatique en cas d'écart relatif supérieur à 35% et contrôle GPS des relevés.
- 🌐 **Multilingue (i18n)** : Français (FR), Kirundi (RN) et Anglais (EN).
- 📖 **Documentation API** : Page interactive `/api-docs` accessible directement dans la barre de navigation.
