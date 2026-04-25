
const CACHE_NAME = 'salgados-pro-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
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

// Estratégia de Fetch: Network First (com fallback para cache)
// Para ativos que mudam pouco (fontes, scripts CDN), podemos usar Cache First
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Não cachear chamadas da API do Supabase em modo persistente (queremos dados reais)
  // Mas vamos cachear scripts do esm.sh e googleapis para funcionamento offline
  const isApiCall = url.hostname.includes('supabase.co') && !request.url.includes('.js');
  
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache dinâmico para scripts, estilos e fontes de terceiros (esm.sh, font-cdn, etc)
        const isCacheable = (
          request.destination === 'script' || 
          request.destination === 'style' || 
          request.destination === 'font' ||
          url.hostname.includes('esm.sh') ||
          url.hostname.includes('fonts.gstatic.com')
        );

        if (response.status === 200 && isCacheable && !isApiCall) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Se falhar (offline), tenta o cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          
          // Se for uma navegação, retorna o index.html (SPA fallback)
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
