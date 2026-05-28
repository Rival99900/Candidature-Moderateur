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

// 🔐 PRIORITÉ DE CHARGEMENT:
//   1. window.__ENV__ (injecté par index.html depuis .env.json)
//   2. Variables codées en dur (fallback sécurisé)

(function () {
  'use strict';

  // Récupère les variables d'environnement (chargées synchronement par index.html)
  const ENV = (typeof window.__ENV__ !== 'undefined') ? window.__ENV__ : {};

  // Configuration globale
  window.MORPH_CANDIDATURE_CONFIG = {
    // ─────────────────────────────────────────────────────────────
    //  URL du webhook Discord (essayé EN PREMIER)
    // ─────────────────────────────────────────────────────────────
    DISCORD_WEBHOOK: ENV.DISCORD_WEBHOOK || 'https://discord.com/api/webhooks/1508428423654015037/1D-xkmpW9PwQwvvVYllzvkDSvt_dwpmuyjbGGSD_wiY0GbVdsC4A4ycghsinYMU81mk8',

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
    DISCORD_CLIENT_ID: ENV.DISCORD_CLIENT_ID || '1206912988335046667',
    DISCORD_SERVER_ID: ENV.DISCORD_SERVER_ID || '1425189368552751114',
    DISCORD_INVITE_URL: ENV.DISCORD_INVITE_URL || '',

    // Adresse mail utilisée par le bouton « Ouvrir mon client mail » en cas
    // de panne du webhook (le candidat est redirigé vers son appli mail).
    TARGET_EMAIL: ENV.TARGET_EMAIL || '',
  };

  // 🐛 DEBUG: affiche la config chargée dans la console
  const cfg = window.MORPH_CANDIDATURE_CONFIG;
  console.log('📋 Configuration chargée:', {
    DISCORD_WEBHOOK: cfg.DISCORD_WEBHOOK.includes('YOUR') ? '✗ TEMPLATE (vide)' : '✓ chargé de .env.json',
    DISCORD_CLIENT_ID: cfg.DISCORD_CLIENT_ID ? '✓ chargé' : '✗ MANQUANT',
    DISCORD_SERVER_ID: cfg.DISCORD_SERVER_ID ? '✓ chargé' : '✗ MANQUANT',
    TARGET_EMAIL: cfg.TARGET_EMAIL ? '✓ chargé' : '✗ MANQUANT',
  });
})();
