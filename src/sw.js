const CACHE_NAME    = 'macro-dashboard-v1';
const SHELL_ASSETS  = ['./index.html', './styles.css', './app.js'];
const DATA_PATTERNS = ['/data/', 'prices.json', 'macro.json', 'manual.json'];

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
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch strategy ───────────────────────────────────────────────────────────
//
//  Data files (JSON): network-first — we always want fresh data when online.
//  App shell (HTML/CSS/JS): cache-first — fast load, updated on next install.

self.addEventListener('fetch', event => {
  const url = event.request.url;
  const isData = DATA_PATTERNS.some(p => url.includes(p));

  if (isData) {
    // Network-first: try network, fall back to cache
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Cache-first: serve from cache, fall back to network
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});
