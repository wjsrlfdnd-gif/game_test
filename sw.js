// Random Character Defense — Auto-Sync Offline Service Worker (v5)
const CACHE_NAME = 'rcd-offline-v5';
const CORE_ASSETS = [
  './',
  './index.html',
  './random_character_defense.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: 'no-store' }).then((res) => (res && res.ok ? cache.put(url, res) : null))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  // HTML 문서는 항상 Network-First (cache: 'no-store')로 최신 배포본 즉시 동기화, 오프라인 시 캐시 폴백
  if (isNav) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((m) => m || caches.match('./random_character_defense.html') || caches.match('./index.html')))
    );
    return;
  }

  // 정적 리소스는 Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const netFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || netFetch;
    })
  );
});