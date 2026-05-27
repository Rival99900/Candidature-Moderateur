#!/usr/bin/env node
// 🚀 Serveur simple pour servir l'application avec variables d'environnement

require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔐 Endpoint pour injecter les variables d'environnement dans le client
app.get('/.env.json', (req, res) => {
  res.json({
    DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_SERVER_ID: process.env.DISCORD_SERVER_ID,
    DISCORD_INVITE_URL: process.env.DISCORD_INVITE_URL,
    TARGET_EMAIL: process.env.TARGET_EMAIL,
  });
});

// 📁 Servir les fichiers statiques
app.use(express.static(path.join(__dirname)));

// 📄 Route par défaut
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 🛡️ Injecter window.__ENV__ dans le HTML
app.get('/index.html', (req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  let html = require('fs').readFileSync(filePath, 'utf8');

  const envScript = `
    <script>
      // 🔐 Variables d'environnement injectées depuis le serveur
      window.__ENV__ = {
        DISCORD_WEBHOOK: '${process.env.DISCORD_WEBHOOK || ''}',
        DISCORD_CLIENT_ID: '${process.env.DISCORD_CLIENT_ID || ''}',
        DISCORD_SERVER_ID: '${process.env.DISCORD_SERVER_ID || ''}',
        DISCORD_INVITE_URL: '${process.env.DISCORD_INVITE_URL || ''}',
        TARGET_EMAIL: '${process.env.TARGET_EMAIL || ''}',
      };
    </script>
  `;

  // Injecte dans le <head>
  html = html.replace('</head>', envScript + '</head>');
  res.send(html);
});

// ✅ Démarre le serveur
app.listen(PORT, () => {
  console.log(`
  ✅ Serveur de candidatures lancé sur http://localhost:${PORT}
  
  📝 Configuration chargée depuis .env:
     • DISCORD_WEBHOOK: ${process.env.DISCORD_WEBHOOK ? '✓ défini' : '✗ vide'}
     • DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID ? '✓ défini' : '✗ vide'}
     • DISCORD_SERVER_ID: ${process.env.DISCORD_SERVER_ID ? '✓ défini' : '✗ vide'}
     • DISCORD_INVITE_URL: ${process.env.DISCORD_INVITE_URL ? '✓ défini' : '✗ vide'}
     • TARGET_EMAIL: ${process.env.TARGET_EMAIL ? '✓ défini' : '✗ vide'}
  `);
});
