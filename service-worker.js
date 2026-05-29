/* 🛡️ Service Worker — Support offline + caching */
const CACHE_VERSION = 'candidature-v1';
const CACHE_URLS = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './app.js',
  './verify.js',
  './manifest.json',
  './.env.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
  'https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js',
];

// Installation — cache les ressources
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => {
        console.log('[SW] 📦 Caching assets…');
        return cache.addAll(CACHE_URLS).catch((err) => {
          console.warn('[SW] ⚠️ Cache error:', err.message);
        });
      })
      .then(() => self.skipWaiting()) // Force activation
  );
});

// Activation — nettoie les anciens caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => {
            console.log('[SW] 🗑️ Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
    .then(() => self.clients.claim())
  );
});

// Fetch — network first, fallback to cache for offline
self.addEventListener('fetch', (e) => {
  const { request } = e;
  
  // Ignore les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }

  // Ignore les requêtes Cross-origin (Discord webhooks, etc.)
  if (!request.url.startsWith(self.location.origin)) {
    return;
  }

  // Network first pour les APIs en temps réel
  if (request.url.includes('/api/') || request.url.includes('discord.com')) {
    e.respondWith(
      fetch(request)
        .catch(() => {
          // Si la requête échoue, tenter le cache
          return caches.match(request)
            .then((cached) => cached || new Response('Offline', { status: 503 }));
        })
    );
    return;
  }

  // Cache first pour les assets statiques
  e.respondWith(
    caches.match(request)
      .then((cached) => {
        return cached || fetch(request)
          .then((res) => {
            // Clone la réponse pour la cacher
            const cloned = res.clone();
            caches.open(CACHE_VERSION)
              .then((cache) => cache.put(request, cloned))
              .catch(() => {}); // Silently fail if cache fails
            return res;
          })
          .catch(() => {
            // Fallback pour les erreurs réseau
            return new Response('Offline', { status: 503 });
          });
      })
  );
});

// Push notifications support
self.addEventListener('push', (e) => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'GG Play Gaming Hub';
  const options = {
    body: data.body || 'Notification from candidature form',
    icon: 'assets/favicon.png',
    badge: 'assets/favicon.png',
    tag: 'candidature-notification',
    requireInteraction: true,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Sync support (pour les envois en arrière-plan)
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-candidature') {
    e.waitUntil(
      // Placeholder pour le sync
      Promise.resolve()
    );
  }
});