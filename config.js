// candidature/config.js
//
// ⚠️  IMPORTANT — Ce fichier est lu par le navigateur du candidat.
//
// Un site 100% côté client comme celui-ci ne peut PAS cacher de vrai secret.
// Le contenu de ce fichier est visible par tous (DevTools → onglet Sources).
// Ce qui te protège vraiment :
//
//   1. Le webhook ne peut faire QU'UNE SEULE chose : envoyer un message dans le
//      salon où tu l'as créé. Il ne peut pas lire, ni modifier le serveur.
//   2. Si quelqu'on l'utilise pour spammer ton salon, va dans Discord :
//      Paramètres du salon → Intégrations → Webhooks → "Candidatures"
//      → bouton "..." → "Réinitialiser le token" → copier l'URL → la coller ici.
//
// Si plus tard tu mets un backend (Cloudflare Worker, Vercel function…), tu pourras
// faire passer la requête par lui et garder le webhook côté serveur uniquement.

// 🔐 Les valeurs sensibles sont maintenant dans .env ou .env.json
// ⚠️ PRIORITÉ DE CHARGEMENT:
//   1. window.__ENV__ (injecté par server.js)
//   2. .env.json (fichier statique pour le dev local)
//   3. Valeurs par défaut ci-dessous

(function () {
  'use strict';

  // Cache global pour les variables d'environnement
  window.__ENV_CACHE__ = null;
  window.__ENV_LOADED__ = false;

  // Précharge .env.json au démarrage (IIFE)
  (async () => {
    try {
      const res = await fetch('.env.json');
      if (res.ok) {
        window.__ENV_CACHE__ = await res.json();
        console.log('✅ .env.json chargé avec succès');
      }
    } catch (e) {
      console.warn('⚠️ .env.json non trouvé (normal pour les déploiements)');
    }
    window.__ENV_LOADED__ = true;
  })();

  // Fonction helper pour obtenir une valeur d'env
  window.getEnvVar = function (key, fallback) {
    // 1. Cherche dans window.__ENV__ (injecté par le serveur Node.js)
    if (typeof window.__ENV__ !== 'undefined' && window.__ENV__[key]) {
      return window.__ENV__[key];
    }
    // 2. Cherche dans .env.json (développement local)
    if (window.__ENV_CACHE__ && window.__ENV_CACHE__[key]) {
      return window.__ENV_CACHE__[key];
    }
    // 3. Valeur par défaut
    return fallback || '';
  };

  // Configuration globale
  window.MORPH_CANDIDATURE_CONFIG = {
    // ─────────────────────────────────────────────────────────────
    //  URL du webhook Discord (essayé EN PREMIER)
    // ─────────────────────────────────────────────────────────────
    DISCORD_WEBHOOK: window.getEnvVar('DISCORD_WEBHOOK', 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID_HERE'),

    // ─────────────────────────────────────────────────────────────
    //  VÉRIFICATION DISCORD (anti-abus)
    //
    //  Pour empêcher les soumissions de gens qui ne sont pas dans le serveur,
    //  on demande au candidat de se connecter avec son compte Discord et on
    //  vérifie qu'il est membre du serveur ci-dessous.
    //
    //  ⚠️  TU DOIS CRÉER UNE APPLICATION DISCORD pour obtenir le CLIENT_ID :
    //
    //     1. Va sur https://discord.com/developers/applications
    //     2. Bouton « New Application » → donne-lui un nom (« Candidatures »)
    //     3. Dans le menu de gauche → « OAuth2 »
    //     4. Copie le « CLIENT ID » et colle-le ci-dessous (DISCORD_CLIENT_ID)
    //     5. Toujours dans « OAuth2 » → section « Redirects » → bouton « Add Redirect »
    //        Colle l'URL exacte de ta page (ex. https://moncandidature.vercel.app/index.html)
    //        Puis clique « Save Changes » en bas
    //     6. (optionnel) Mets aussi l'URL du serveur Discord et un lien d'invitation
    //        pour le bouton « Rejoindre le serveur » qui s'affiche aux non-membres.
    // ─────────────────────────────────────────────────────────────
    DISCORD_CLIENT_ID: window.getEnvVar('DISCORD_CLIENT_ID', '1206912988335046667'),
    DISCORD_SERVER_ID: window.getEnvVar('DISCORD_SERVER_ID', '1425189368552751114'),
    DISCORD_INVITE_URL: window.getEnvVar('DISCORD_INVITE_URL', 'https://discord.gg/J8MNwvgKSA'),

    // Adresse mail utilisée par le bouton « Ouvrir mon client mail » en cas
    // de panne du webhook (le candidat est redirigé vers son appli mail).
    TARGET_EMAIL: window.getEnvVar('TARGET_EMAIL', 'ervinlame3456@gmail.com'),
  };

  // 🐛 DEBUG: affiche la config chargée dans la console
  console.log('📋 Configuration chargée:', {
    DISCORD_WEBHOOK: window.MORPH_CANDIDATURE_CONFIG.DISCORD_WEBHOOK ? '✓ défini' : '✗ MANQUANT!',
    DISCORD_CLIENT_ID: window.MORPH_CANDIDATURE_CONFIG.DISCORD_CLIENT_ID ? '✓ défini' : '✗ MANQUANT!',
    DISCORD_SERVER_ID: window.MORPH_CANDIDATURE_CONFIG.DISCORD_SERVER_ID ? '✓ défini' : '✗ MANQUANT!',
    TARGET_EMAIL: window.MORPH_CANDIDATURE_CONFIG.TARGET_EMAIL ? '✓ défini' : '✗ MANQUANT!',
  });
})();
