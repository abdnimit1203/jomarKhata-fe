'use client';

import { useEffect } from 'react';

/**
 * Phones that installed the app before the landing page existed have start_url "/".
 * When the page runs as an installed app, go straight to the app.
 */
export function StandaloneRedirect() {
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) window.location.replace('/app');
  }, []);
  return null;
}
