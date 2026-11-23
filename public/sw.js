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
const VERSION = 'jk-shell-v1';
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
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
  return request.method === 'GET' && new URL(request.url).origin === self.location.origin;
}

function isImmutableAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/');
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
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          event.waitUntil(putInCache(request, fresh.clone()));
          return fresh;
        } catch {
          const cache = await caches.open(VERSION);
          return (await cache.match(request)) || (await cache.match('/')) || Response.error();
        }
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
