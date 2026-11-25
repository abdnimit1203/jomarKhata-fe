'use client';

/** Settings → ব্যাকআপ: cloud copy status, "এখনই ক্লাউডে রাখুন", and the auto on/off switch. */
import React, { useEffect, useState } from 'react';
import { Cloud, CloudUpload } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { useOnline } from '@/hooks/use-online';
import { cloudAutoEnabled, getCloudMeta, setCloudAuto, uploadCloudBackup } from '@/lib/cloudBackup';
import { formatBanglaDateTime } from '@/lib/format';

export function CloudBackupBox({ onLogin }: { onLogin?: () => void }) {
  const { auth, mode, data, actions, showToast } = useJomarkhata();
  const online = useOnline();
  const signedIn = auth.status === 'authenticated';
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [auto, setAuto] = useState(() => (typeof window === 'undefined' ? true : cloudAutoEnabled()));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn || !online) return;
    let alive = true;
    getCloudMeta()
      .then((m) => alive && (setSavedAt(m.exists ? (m.savedAt ?? null) : null), setChecked(true)))
      .catch(() => alive && setChecked(true));
    return () => {
      alive = false;
    };
  }, [signedIn, online]);

  if (mode !== 'real' || !data) return null;

  if (!signedIn) {
    return (
      <div className="space-y-2 rounded-2xl bg-white p-3.5">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <Cloud className="h-5 w-5 text-primary-ink" /> ক্লাউড ব্যাকআপ
        </p>
        <p className="text-sm text-ink-muted">লগইন করলে হিসাবের কপি নিজে থেকেই ক্লাউডে থাকবে — ফোন হারালেও ফেরত পাবেন।</p>
        {onLogin && (
          <button type="button" onClick={onLogin} className="h-11 w-full rounded-2xl bg-primary text-sm font-bold text-on-primary">
            লগইন করুন
          </button>
        )}
      </div>
    );
  }

  const now = async () => {
    setBusy(true);
    try {
      setSavedAt(await uploadCloudBackup(await actions.buildCloudBackupJson(), data.businessProfile.shopName));
      showToast('ক্লাউডে ব্যাকআপ রাখা হয়েছে।');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ক্লাউডে রাখা যায়নি।', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5 rounded-2xl bg-white p-3.5">
      <p className="flex items-center gap-2 text-sm font-bold text-ink">
        <Cloud className="h-5 w-5 text-primary-ink" /> ক্লাউড ব্যাকআপ
      </p>
      <p className="text-sm">
        <span className="text-ink-muted">শেষ ক্লাউড কপি: </span>
        <b className={savedAt ? 'text-success' : 'text-ink'}>
          {savedAt ? formatBanglaDateTime(savedAt) : !online ? 'ইন্টারনেট নেই' : checked ? 'এখনও রাখা হয়নি' : 'দেখা হচ্ছে…'}
        </b>
      </p>
      <button
        type="button"
        disabled={busy || !online}
        onClick={now}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-on-primary disabled:opacity-50"
      >
        <CloudUpload className="h-5 w-5" /> {busy ? 'রাখা হচ্ছে…' : 'এখনই ক্লাউডে রাখুন'}
      </button>
      <label className="flex items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => {
            setAuto(e.target.checked);
            setCloudAuto(e.target.checked);
          }}
          className="h-5 w-5 accent-primary"
        />
        নেট থাকলে নিজে থেকে ক্লাউডে রাখুন
      </label>
      <p className="text-xs text-ink-muted">নতুন ফোনে একই অ্যাকাউন্টে লগইন করে “ক্লাউড থেকে আনুন” চাপলে পুরো খাতা ফেরত আসবে।</p>
    </div>
  );
}
