'use client';

/**
 * Automatic cloud backup: ~20 seconds after the khata changes (and on start), if signed in, online,
 * in the real khata and auto backup is on → upload a fresh copy. Silent; failures retry on the next
 * change, when the internet comes back, or when the app is opened again.
 */
import { useEffect, useRef } from 'react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { cloudAutoEnabled, uploadCloudBackup } from '@/lib/cloudBackup';

const DELAY_MS = 20_000;

export function CloudBackupRunner() {
  const { data, mode, auth, actions } = useJomarkhata();
  const dirty = useRef(true); // first run after opening the app
  const busy = useRef(false);
  const signedIn = auth.status === 'authenticated';
  const shopName = data?.businessProfile.shopName ?? '';

  useEffect(() => {
    dirty.current = true;
  }, [data]);

  useEffect(() => {
    if (!signedIn || mode !== 'real') return;
    const run = async () => {
      if (!dirty.current || busy.current || !navigator.onLine || !cloudAutoEnabled()) return;
      busy.current = true;
      dirty.current = false;
      try {
        await uploadCloudBackup(await actions.buildCloudBackupJson(), shopName);
      } catch {
        dirty.current = true; // try again later
      } finally {
        busy.current = false;
      }
    };
    const timer = window.setTimeout(run, DELAY_MS);
    window.addEventListener('online', run);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', run);
    };
  }, [signedIn, mode, actions, shopName, data]);

  return null;
}
