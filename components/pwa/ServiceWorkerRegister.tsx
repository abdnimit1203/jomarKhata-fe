'use client';

import { useEffect } from 'react';
import { captureInstallPrompt, setWaitingWorker, shouldReloadOnControllerChange } from '@/lib/pwa';

/**
 * Registers the offline app-shell service worker (public/sw.js) in production builds only.
 * Development keeps normal hot reload. Business data stays in IndexedDB; the worker never caches it.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // The install prompt is captured in every build so the install card can use it.
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) {
      return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
    }

    // S12 update prompt: a new version waits until the owner taps "আপডেট করুন" (never mid-form).
    const onControllerChange = () => {
      if (shouldReloadOnControllerChange()) window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const watch = (w: ServiceWorker | null) => {
          if (!w) return;
          const check = () => {
            // Only an UPDATE waits (a page is already controlled). The first install activates at once.
            if (w.state === 'installed' && navigator.serviceWorker.controller) setWaitingWorker(w);
          };
          check();
          w.addEventListener('statechange', check);
        };
        if (registration.waiting && navigator.serviceWorker.controller) setWaitingWorker(registration.waiting);
        registration.addEventListener('updatefound', () => watch(registration.installing));
        await navigator.serviceWorker.ready;
        // Hand over everything this first page load fetched, so the app opens offline right away.
        const urls = [
          window.location.href,
          ...performance
            .getEntriesByType('resource')
            .map((entry) => entry.name)
            .filter((name) => name.startsWith(window.location.origin)),
        ];
        // If the first visit is the landing page, also fetch the app's own scripts so /app opens offline.
        try {
          const html = await (await fetch('/app', { credentials: 'same-origin' })).text();
          urls.push('/app', ...(html.match(/\/_next\/static\/[^"'\s)]+/g) ?? []));
        } catch {
          /* offline right now; the app caches itself on its first online visit */
        }
        (registration.active ?? navigator.serviceWorker.controller)?.postMessage({ type: 'CACHE_URLS', urls });
      } catch {
        // Offline support is an enhancement; the app keeps working online without it.
      }
    };

    if (document.readyState === 'complete') void register();
    else window.addEventListener('load', () => void register(), { once: true });
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
