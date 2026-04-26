
const CACHE_NAME = 'salgados-pro-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/?pwa=true',
  '/index.html',
  '/index.tsx',
  '/manifest.json',
  '/sw.js',
  'https://cdn.tailwindcss.com',
  'https://cdn-icons-png.flaticon.com/512/3081/3081967.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'
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

// Estratégia de Fetch: Stale-While-Revalidate para ativos estáticos e shell
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não interceptar chamadas da API do Supabase para escrita
  if (url.hostname.includes('supabase.co') && (request.method !== 'GET')) {
    return;
  }

  // Ignorar extensões de browser e chamadas de hot reload do Vite
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.includes('@vite') || url.pathname.includes('chrome-extension')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request).then((networkResponse) => {
        // Cache dinâmico para scripts, estilos e fontes de terceiros e locais
        const isCacheable = (
          networkResponse.status === 200 &&
          (
            request.destination === 'script' || 
            request.destination === 'style' || 
            request.destination === 'font' ||
            request.destination === 'image' ||
            url.hostname.includes('esm.sh') ||
            url.hostname.includes('fonts.gstatic.com') ||
            url.hostname.includes('cdn.tailwindcss.com') ||
            url.origin === self.location.origin
          )
        );

        if (isCacheable) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Falha na rede (offline)
        if (cachedResponse) return cachedResponse;
        
        // Fallback para navegação (index.html)
        if (request.mode === 'navigate') {
          return caches.match('/');
        }
        
        throw err;
      });

      // Retorna o cache se existir, senão espera a rede
      return cachedResponse || fetchPromise;
    })
  );
});
