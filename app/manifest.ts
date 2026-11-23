import type { MetadataRoute } from 'next';

/**
 * Web app manifest (PWA install). Served by Next at /manifest.webmanifest.
 * Icons are generated from the owner's logo (see CHANGELOG, brand step).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'জমারখাতা — দোকানের সব হিসাব',
    short_name: 'জমারখাতা',
    description: 'দোকানের সব হিসাব, এক খাতায়। ইন্টারনেট ছাড়াই চলে।',
    lang: 'bn',
    dir: 'ltr',
    // The app lives at /app; the landing page is at /. `id` stays '/' so existing installs update in place.
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#F5F7FE',
    theme_color: '#4664E0',
    categories: ['business', 'finance', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
