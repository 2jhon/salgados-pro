
const CACHE_NAME = 'salgados-pro-v5';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Instalação do Service Worker e Caching de Ativos Estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching shell assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Ativação e Limpeza de caches antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estratégia Definitiva de Fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar extensões de browser e chamadas de hot reload do Vite
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.includes('@vite') || url.pathname.includes('chrome-extension')) return;

  // Supabase e chamadas de API nunca devem ser cacheadas
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML / Navegação -> Network First, com Fallback para Cache offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          return networkResponse;
        })
        .catch(() => {
          console.warn('[SW] Offline. Buscando shell no cache.');
          return caches.match('/', { ignoreSearch: true }).then((cached) => {
            return cached || caches.match('/index.html', { ignoreSearch: true });
          });
        })
    );
    return;
  }

  // Ativos Estáticos -> Stale-While-Revalidate Forte
  const isStaticAsset = 
    request.destination === 'script' || 
    request.destination === 'style' || 
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.hostname.includes('esm.sh') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('cdn-icons-png') ||
    url.origin === self.location.origin;

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          // Permite caches opacos para suportar certos recursos cross-origin não-CORS
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
          }
          return networkResponse;
        }).catch((err) => {
          console.warn('[SW] Falha estática offline. Ignorando silenciosamente.', url.href);
          throw err;
        });

        // Retorna Imediatamente se houver cache, sem esperar a rede
        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // Fallback genérico Cache-First
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      return cachedResponse || fetch(request);
    })
  );
});
