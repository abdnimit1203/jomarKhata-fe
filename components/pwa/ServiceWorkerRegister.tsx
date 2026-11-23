'use client';

import { useEffect } from 'react';

/**
 * Registers the offline app-shell service worker (public/sw.js) in production builds only.
 * Development keeps normal hot reload. Business data stays in IndexedDB; the worker never caches it.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await navigator.serviceWorker.ready;
        // Hand over everything this first page load fetched, so the app opens offline right away.
        const urls = [
          window.location.href,
          ...performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => name.startsWith(window.location.origin)),
        ];
        (registration.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'CACHE_URLS', urls });
      } catch {
        // Offline support is an enhancement; the app keeps working online without it.
      }
    };

    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', () => void register(), { once: true });
  }, []);

  return null;
}
