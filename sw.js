// Random Character Defense — Mobile Game Real-Time OTA & Offline Service Worker (v26)
const CACHE_NAME = 'rcd-offline-v26';
const CANONICAL_HTML = './random_character_defense.html';
const CORE_ASSETS = [
  CANONICAL_HTML,
  './manifest.webmanifest',
  './firebase-config.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
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
  const type = event.data && event.data.type;
  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (type === 'PURGE_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/admin.html') || url.pathname.endsWith('/coupons.json')) return;

  // Firebase 설정 파일은 Network-First (로컬 캐시 fallback)
  if (url.pathname.endsWith('/firebase-config.js')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('./firebase-config.js', copy));
          }
          return res;
        })
        .catch(() => caches.match('./firebase-config.js') || caches.match(req))
    );
    return;
  }

  // 실시간 버전 체크(version.json)는 항상 네트워크 직접 조회 (캐시 우회)
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 실시간 라이브 설정(live_config.json)은 Network-First + 오프라인 폴백
  if (url.pathname.endsWith('/live_config.json')) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./live_config.json', copy));
          }
          return res;
        })
        .catch(() => caches.match('./live_config.json'))
    );
    return;
  }

  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  // HTML 문서는 항상 Network-First로 최신 배포본 동기화, 단일 캐시 키에 저장하여 오프라인 100% 폴백
  if (isNav) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(CANONICAL_HTML, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(CANONICAL_HTML).then((m) => m || caches.match(req))
        )
    );
    return;
  }

  // 정적 리소스(아이콘, 매니페스트 등)는 Stale-While-Revalidate
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