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
//   2. Si quelqu'un l'utilise pour spammer ton salon, va dans Discord :
//      Paramètres du salon → Intégrations → Webhooks → "Candidatures"
//      → bouton "..." → "Réinitialiser le token" → copier l'URL → la coller ici.
//
// Si plus tard tu mets un backend (Cloudflare Worker, Vercel function…), tu pourras
// faire passer la requête par lui et garder le webhook côté serveur uniquement.

// 🔐 Les valeurs sensibles sont maintenant dans .env
// ⚠️ Copie .env.example → .env et remplis les vraies valeurs
// 📝 Les valeurs ci-dessous sont les valeurs PAR DÉFAUT (utilise .env pour les secrets)

window.MORPH_CANDIDATURE_CONFIG = {
  // ─────────────────────────────────────────────────────────────
  //  URL du webhook Discord — charge depuis .env
  //  Voir : .env → DISCORD_WEBHOOK
  // ─────────────────────────────────────────────────────────────
  DISCORD_WEBHOOK: (() => {
    // 1. Cherche dans window.__ENV__ (injecté par le serveur)
    if (typeof window.__ENV__ !== 'undefined' && window.__ENV__.DISCORD_WEBHOOK) {
      return window.__ENV__.DISCORD_WEBHOOK;
    }
    // 2. Valeur de secours (attention: visible en clair dans le code source)
    return 'https://discord.com/api/webhooks/YOUR_WEBHOOK_URL_HERE';
  })(),

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
  DISCORD_CLIENT_ID: (() => {
    if (typeof window.__ENV__ !== 'undefined' && window.__ENV__.DISCORD_CLIENT_ID) {
      return window.__ENV__.DISCORD_CLIENT_ID;
    }
    return '1206912988335046667'; // Valeur par défaut
  })(),

  DISCORD_SERVER_ID: (() => {
    if (typeof window.__ENV__ !== 'undefined' && window.__ENV__.DISCORD_SERVER_ID) {
      return window.__ENV__.DISCORD_SERVER_ID;
    }
    return '1425189368552751114'; // Valeur par défaut
  })(),

  DISCORD_INVITE_URL: (() => {
    if (typeof window.__ENV__ !== 'undefined' && window.__ENV__.DISCORD_INVITE_URL) {
      return window.__ENV__.DISCORD_INVITE_URL;
    }
    return 'https://discord.gg/J8MNwvgKSA'; // Valeur par défaut
  })(),

  // Adresse mail utilisée par le bouton « Ouvrir mon client mail » en cas
  // de panne du webhook (le candidat est redirigé vers son appli mail).
  TARGET_EMAIL: (() => {
    if (typeof window.__ENV__ !== 'undefined' && window.__ENV__.TARGET_EMAIL) {
      return window.__ENV__.TARGET_EMAIL;
    }
    return 'ervinlame3456@gmail.com'; // Valeur par défaut
  })(),
};
