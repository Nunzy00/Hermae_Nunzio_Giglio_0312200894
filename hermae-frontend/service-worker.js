/**
 * HERMAE — Service Worker PWA (Progressive Web App)
 * Versione: 1.0.0 — Cache Name: hermae-pwa-v1
 * 
 * Strategia di Caching Ibrida:
 * - HTML Documents / Navigazione: Network First con fallback su Cache e pagina offline.html
 * - Risorse Statiche (CSS, JS, Fonts, Immagini): Stale-While-Revalidate / Cache First
 * - API REST (/api/*): Network Only per preservare consistenza transazionale e conformità GDPR
 */

const CACHE_NAME = 'hermae-pwa-v1';

// Risorse essenziali dell'App Shell pre-caricate durante l'evento install
const PRECACHE_RESOURCES = [
  '/',
  '/login.html',
  '/registrazione.html',
  '/dashboard.html',
  '/libreria.html',
  '/ricerca.html',
  '/attivita.html',
  '/chat.html',
  '/impostazioni.html',
  '/offline.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/assets/js/api.js',
  '/assets/js/auth.js',
  '/assets/js/pwa.js',
  '/assets/js/cmp.js',
  '/assets/js/components/global-components.js',
  '/assets/img/logo.svg',
  '/assets/img/icon.svg',
  '/assets/img/icon-192x192.png',
  '/assets/img/icon-512x512.png',
  '/assets/img/apple-touch-icon.png'
];

/**
 * Evento Install: Pre-caching delle risorse core dell'applicazione
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Usa allSettled o aggiungi singolarmente per tollerare eventuali risorse opzionali
        return Promise.allSettled(
          PRECACHE_RESOURCES.map((url) => {
            return cache.add(url).catch((err) => {
              console.warn(`[ServiceWorker] Precache fallito per ${url}:`, err.message);
            });
          })
        );
      })
      .then(() => {
        // Attivazione immediata del nuovo Service Worker senza attendere il riavvio
        return self.skipWaiting();
      })
  );
});

/**
 * Evento Activate: Pulizia delle vecchie versioni della cache e takeover client
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log(`[ServiceWorker] Eliminazione vecchia cache: ${name}`);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => {
        // Prende immediatamente il controllo di tutti i client aperti
        return self.clients.claim();
      })
  );
});

/**
 * Evento Fetch: Intercettazione e routing delle richieste HTTP
 */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Ignora richieste non-GET (POST, PUT, DELETE, PATCH devono sempre raggiungere la rete)
  if (request.method !== 'GET') {
    return;
  }

  // 2. Bypass per rotte API (/api/*) e upload dinamici: Network Only
  // I dati dinamici (prestiti, chat, notifiche, analytics, CMP) non devono mai essere memorizzati in cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // In caso di offline su chiamata API, restituisce una risposta JSON appropriata
        return new Response(
          JSON.stringify({
            success: false,
            offline: true,
            message: 'Connessione a Internet assente. Impossibile sincronizzare i dati dinamici.'
          }),
          {
            status: 503,
            statusText: 'Service Unavailable (Offline)',
            headers: { 'Content-Type': 'application/json; charset=utf-8' }
          }
        );
      })
    );
    return;
  }

  // 3. Documenti HTML di navigazione: Strategia NETWORK FIRST con Fallback su Cache e offline.html
  const isHtmlNavigation = request.mode === 'navigate' || 
    (request.headers.get('accept') && request.headers.get('accept').includes('text/html'));

  if (isHtmlNavigation) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Se la richiesta va a buon fine, aggiorna la copia in cache
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Se la rete fallisce, cerca prima la pagina specifica memorizzata in cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se non presente in cache, restituisce la pagina offline di cortesia
          const offlinePage = await caches.match('/offline.html');
          if (offlinePage) {
            return offlinePage;
          }
          return new Response(
            '<h1>Hermae Offline</h1><p>Nessuna connessione di rete disponibile.</p>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 4. Asset Statici (CSS, JS, Immagini, Font, CDN): Strategia STALE-WHILE-REVALIDATE / CACHE FIRST
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Se presente in cache, restituiscilo immediatamente
      if (cachedResponse) {
        // Aggiorna asincronamente la cache in background (Stale-While-Revalidate)
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Ignora errori di background fetch se offline
          });
        return cachedResponse;
      }

      // Se non presente in cache, effettua la richiesta di rete e memorizza
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // Fallback generico per immagini SVG/PNG
          if (request.destination === 'image') {
            return caches.match('/assets/img/icon.svg');
          }
          return new Response('', { status: 408, statusText: 'Request Timeout (Offline)' });
        });
    })
  );
});

/**
 * Gestione dei messaggi dai client
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
