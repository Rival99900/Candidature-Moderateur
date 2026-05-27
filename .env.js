// 📦 Chargeur de variables d'environnement (.env)
// ============================================
//
// POUR DÉVELOPPEMENT LOCAL (avec Node.js):
//   npm install dotenv
//   Puis importe : const env = require('dotenv').config();
//
// POUR PRODUCTION CÔTÉ CLIENT (navigateur):
//   Cette fonction charge les variables depuis le fichier .env.json
//   (généré par ton build script ou ton serveur)
//
// La configuration sensible est chargée à runtime pour plus de sécurité.

(function () {
  'use strict';

  // Cherche les variables d'environnement
  // Peut venir de:
  // 1. window.__ENV__ (injecté par le serveur/build)
  // 2. Un fichier .env.json
  // 3. Les valeurs par défaut de config.js

  const ENV = window.__ENV__ || {};

  // Fonction pour charger .env.json (fallback)
  async function loadEnvFile() {
    try {
      const response = await fetch('.env.json');
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn('⚠️ .env.json non trouvé — utilise config.js par défaut');
    }
    return {};
  }

  // Exporte l'interface
  window.MorphEnv = {
    get: (key, defaultValue) => ENV[key] || defaultValue,
    getAll: () => ({ ...ENV }),
    load: loadEnvFile,
  };
})();
