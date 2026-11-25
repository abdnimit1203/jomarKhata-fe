/*
 * Jomarkhata service worker — offline APP SHELL only.
 *
 * - Caches the app's own pages, JS/CSS chunks, fonts and icons so the installed app opens
 *   and runs without internet.
 * - NEVER caches business data: all records live in IndexedDB (Dexie), which the service
 *   worker does not touch. Only same-origin GET requests are handled; everything else
 *   (POST, other origins, future API calls) goes straight to the network.
 * - Pages: network-first (fresh when online, cached copy when offline).
 *   Hashed static assets (/_next/static, /icons): cache-first (they never change).
 */
// Bump VERSION whenever a file under /icons or /brand is replaced: those paths are served
// cache-first, so phones keep the old copy until the cache name changes.
const VERSION = 'jk-shell-v7';
const NAV_TIMEOUT_MS = 3000;
const FEATURE_ICONS = [
  'add-plus', 'book-due', 'book-expense', 'book-purchase', 'book-sales', 'cashbox', 'due-collect',
  'expense', 'money-in', 'money-out', 'nav-home', 'nav-transactions', 'party-list', 'purchase',
  'reports', 'sale', 'settings', 'stock', 'supplier-pay',
].map((n) => `/icons/features/${n}.svg`);
const SHELL_URLS = [
  '/',
  '/app',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/brand/logo-mark.png',
  '/brand/welcome-banner.webp',
  ...FEATURE_ICONS,
];

// No automatic skipWaiting: an update waits until the owner taps "আপডেট করুন" (S12), so the
// page never switches versions in the middle of a form. A first install activates immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL_URLS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isSameOriginGet(request) {
  const url = new URL(request.url);
  // The owner's admin panel (/admin/...) is online-only: never cached, never served offline.
  return request.method === 'GET' && url.origin === self.location.origin && !url.pathname.startsWith('/admin');
}

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/brand/')
  );
}

async function putInCache(request, response) {
  if (!response || !response.ok || response.type === 'opaque') return;
  const cache = await caches.open(VERSION);
  await cache.put(request, response);
}

// The page sends the URLs it loaded before this worker took control, so the very first
// visit is enough to make the app work offline.
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type !== 'CACHE_URLS' || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      await Promise.all(
        data.urls.map(async (u) => {
          try {
            const url = new URL(u, self.location.origin);
            if (url.origin !== self.location.origin) return;
            if (await cache.match(url.href)) return;
            const res = await fetch(url.href, { credentials: 'same-origin' });
            if (res.ok) await cache.put(url.href, res);
          } catch {
            /* ignore single failures; the rest still caches */
          }
        })
      );
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isSameOriginGet(request)) return; // let the browser handle it normally
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    // Network-first, but never wait long: on a weak / no mobile connection the request can hang for
    // many seconds before failing (owner saw slow offline starts). With a cached copy we wait at most
    // NAV_TIMEOUT_MS, then open the cached app; the fresh page still updates the cache when it arrives.
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        // App routes fall back to the cached app shell, everything else to the landing page.
        const shell = url.pathname.startsWith('/app') ? '/app' : '/';
        const cached = (await cache.match(request)) || (await cache.match(shell)) || (await cache.match('/'));
        const network = fetch(request).then((fresh) => {
          event.waitUntil(putInCache(request, fresh.clone()));
          return fresh;
        });
        if (!cached) return network.catch(() => Response.error());
        if (self.navigator && self.navigator.onLine === false) {
          network.catch(() => {});
          return cached;
        }
        const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NAV_TIMEOUT_MS));
        return Promise.race([network.catch(() => cached), timeout]);
      })()
    );
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        event.waitUntil(putInCache(request, res.clone()));
        return res;
      })()
    );
    return;
  }

  // Other same-origin GETs (e.g. manifest): serve cached copy, refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          event.waitUntil(putInCache(request, res.clone()));
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || network;
    })()
  );
});
