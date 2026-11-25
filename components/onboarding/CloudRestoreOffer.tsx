'use client';

/**
 * New phone / reinstalled app, signed in: if this account has a cloud copy, offer it before setting
 * up an empty shop ("আপনার খাতা ক্লাউডে আছে"). Uses the normal RestoreFlow preview + confirmation.
 */
import React, { useEffect, useState } from 'react';
import { CloudDownload } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { RestoreFlow } from '@/components/settings/RestoreFlow';
import { getCloudMeta, type CloudMeta } from '@/lib/cloudBackup';
import { formatBanglaDateTime } from '@/lib/format';

export function CloudRestoreOffer() {
  const { auth } = useJomarkhata();
  const signedIn = auth.status === 'authenticated';
  const [meta, setMeta] = useState<CloudMeta | null>(null);

  useEffect(() => {
    if (!signedIn || !navigator.onLine) return;
    let alive = true;
    getCloudMeta()
      .then((m) => alive && setMeta(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [signedIn]);

  if (!meta?.exists) return null;
  return (
    <section className="mt-5 space-y-3 rounded-3xl bg-tile-green-bg p-4 shadow-card">
      <p className="flex items-center gap-2 text-base font-bold text-ink">
        <CloudDownload className="h-5 w-5 text-tile-green-fg" /> আপনার খাতা ক্লাউডে আছে
      </p>
      <p className="text-sm text-ink-muted">
        {meta.shopName ? `“${meta.shopName}” · ` : ''}
        {meta.savedAt ? `${formatBanglaDateTime(meta.savedAt)}-এর কপি` : ''}। নতুন করে শুরু না করে আগের হিসাব ফিরিয়ে আনুন।
      </p>
      <RestoreFlow />
    </section>
  );
}
