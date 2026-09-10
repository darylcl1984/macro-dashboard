const CACHE_NAME   = 'macro-dashboard-v90';
const SHELL_ASSETS = [
  './index.html',
  './styles.css',
  './app.js',
  './charts.js',
  './metrics.js',
  './methodology.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
];

// ─── Install: cache app shell ─────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate: clear old caches ───────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('macro-dashboard-') && k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch strategy: network-first for everything ─────────────────────────────
//
// Always try network first so updates (data + app shell) are reflected immediately.
// Fall back to cache only when offline.

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const root = new URL('../', self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return;
  const response = fetch(event.request);
  event.waitUntil(response.then(async resp => {
    if (resp.ok) {
      const clone = resp.clone();
      const cache = await caches.open(CACHE_NAME);
      await cache.put(event.request, clone);
    }
  }).catch(() => {}));
  event.respondWith(
    response.catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        const shell = await cache.match(new URL('./index.html', self.registration.scope));
        if (shell) return shell;
      }
      return new Response('This resource is unavailable offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    })
  );
});
