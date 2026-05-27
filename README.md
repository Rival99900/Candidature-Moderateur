# 📋 GG Play Gaming Hub — Candidature Modérateur

Application sécurisée de candidature Discord pour le serveur **Rivalité**.

Fonctionne sur **GitHub Pages**, **Vercel**, **Netlify**, ou sur un serveur Node.js personnel.

## 🔐 Sécurité Améliorée (Nouvelle Version)

✅ **Secrets protégés** — Variables sensibles dans `.env` (non commitées)  
✅ **`.gitignore`** — Empêche les fuites de données  
✅ **Serveur Node.js** — Injecte les variables côté serveur  
✅ **Webhook sécurisé** — Régénérable en 1 clic  
✅ **OAuth2 Discord** — Vérification des membres  

## ⚙️ Fonctionnalités

- ✅ Formulaire avec **11 questions** (profil, dispos, expérience, motivation, mise en situation)
- ✅ **Vérification Discord OAuth** — le candidat doit être connecté ET membre du serveur
- ✅ Envoi instantané dans un **salon Discord** via webhook (Components V2 + embed classique)
- ✅ **PDF généré côté navigateur** (pdf-lib + Roboto Unicode) joint à chaque candidature
- ✅ Mode dégradé `no-cors` automatique si le navigateur bloque le CORS
- ✅ Bouton de secours **mailto** + **téléchargement PDF** si le webhook échoue
- ✅ Compatible mobile, interface en FR

## 🚀 Démarrage Rapide

### 1️⃣ Configuration des Secrets

```bash
# Copie le template
cp .env.example .env

# Ouvre .env et remplis les vraies valeurs
nano .env
```

### 2️⃣ Installation

```bash
npm install
```

### 3️⃣ Démarrage du Serveur

**Mode développement** (avec rechargement auto) :
```bash
npm run dev
```

**Mode production** :
```bash
npm start
```

Accède à `http://localhost:3000`

## 📁 Fichiers Importants

| Fichier | Description |
|---------|-------------|
| `.env` | 🔐 **SECRETS** — NE PAS COMMITER (webhook, keys) |
| `.env.example` | 📋 Template de configuration |
| `.gitignore` | 🚫 Fichiers à ignorer (`.env`, `node_modules/`) |
| `config.js` | ⚙️ Configuration de l'app (charge depuis `.env`) |
| `app.js` | 📱 Logique du formulaire |
| `verify.js` | 🛡️ Vérification Discord OAuth |
| `server.js` | 🚀 Serveur Node.js |

## 🔧 Configuration Discord

### Créer une Application

1. Va sur [Discord Developers](https://discord.com/developers/applications)
2. "New Application" → donne-lui un nom (`Candidatures`)
3. OAuth2 → **Copie le CLIENT ID**
4. Ajoute une URL de redirection : `http://localhost:3000` (dev) ou ton domaine (prod)

### Créer un Webhook

1. Serveur Discord → Paramètres → Intégrations → Webhooks
2. "New Webhook" → donne-lui un nom
3. **Copie l'URL complète**

### Remplir le .env

```env
DISCORD_WEBHOOK=https://discord.com/api/webhooks/YOUR_ID/YOUR_TOKEN
DISCORD_CLIENT_ID=YOUR_CLIENT_ID
DISCORD_SERVER_ID=YOUR_SERVER_ID
DISCORD_INVITE_URL=https://discord.gg/YOUR_CODE
TARGET_EMAIL=ton-email@example.com
```

## 🌐 Déploiement en Production

### Vercel (Recommandé)

```bash
npm install -g vercel
vercel
```

Les variables d'environnement seront gérées dans le dashboard.

### Railway

```bash
npm install -g railway
railway link
railway up
```

Ajoute tes variables dans les settings du projet.

### GitHub Pages (Site Statique)

⚠️ ⚠️ **Attention** : Le webhook sera visible en clair dans le code source.

1. Push sur GitHub : `git push`
2. Settings → Pages → Source : `main` branch
3. Configure l'URL de redirection OAuth avec le domaine GitHub Pages
4. Édite `config.js` avec tes vraies valeurs

## 🔐 Sécurité

**Pourquoi `.env` + `.gitignore` ?**

- ✅ Les secrets ne sont jamais commitées dans Git
- ✅ Chaque serveur peut avoir sa propre configuration
- ✅ Si le webhook est compromis, il suffit de le régénérer

**Webhook compromis ?**
1. Serveur Discord → Paramètres → Intégrations → Webhooks
2. "Candidatures" → "..." → "Réinitialiser le token"
3. Copie la nouvelle URL dans `.env` → redémarre le serveur

## 📦 Stack technique

- **HTML + CSS + JavaScript** vanilla (zéro framework)
- **Node.js + Express** — injection des secrets côté serveur
- **dotenv** — gestion des variables d'environnement
- **Discord OAuth2** — vérification des membres
- **Discord Webhooks** — envoi des candidatures
- **pdf-lib** — génération des PDF côté client

## 🧪 Tests Locaux

```bash
# Démarrage
npm run dev

# Ouvre http://localhost:3000
# Teste avec un compte Discord dans le serveur
```

## 📂 Structure

```
candidature/
├── index.html        # Page principale
├── style.css         # Tous les styles
├── app.js            # Logique du formulaire + envoi Discord + PDF
├── verify.js         # Vérification Discord OAuth
├── config.js         # CONFIG (webhook, client_id, server_id, email)
├── assets/
│   ├── server-icon.png   # Icône du serveur (avatar)
│   └── favicon.png       # Favicon
├── .nojekyll         # Désactive Jekyll sur GitHub Pages
└── README.md         # Ce fichier
```

---

Fait avec patience par et pour le staff de **GG Play Gaming Hub** 🎮
