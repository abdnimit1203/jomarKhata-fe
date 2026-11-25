'use client';

/**
 * Profile photo at the top of Settings. Missing or not loading (offline, deleted) → the shop's first
 * letter on the brand gradient. Signed-in + online only: a small camera button picks a photo, which
 * is compressed in the browser and uploaded to ImageKit (lib/upload.ts); the server deletes the old
 * one and limits changes to a few a day.
 */
import React, { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { useOnline } from '@/hooks/use-online';
import { apiFetch } from '@/lib/api';
import { currentIdToken } from '@/lib/auth-firebase';
import { uploadAvatar, uploadsConfigured } from '@/lib/upload';

export function Avatar({ url, name, size = 56 }: { url?: string; name: string; size?: number }) {
  const [broken, setBroken] = useState<string | null>(null);
  const letter = (name.trim()[0] ?? 'জ').toUpperCase();
  const style = { width: size, height: size };
  if (url && broken !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" style={style} onError={() => setBroken(url)} className="shrink-0 rounded-2xl bg-surface-muted object-cover" />
    );
  }
  return (
    <span style={style} className="flex shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-2xl font-extrabold text-on-primary">
      {letter}
    </span>
  );
}

export function ProfilePhoto({ name }: { name: string }) {
  const { auth, completeSignIn, showToast } = useJomarkhata();
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const user = auth.status === 'authenticated' ? auth.user : null;
  const canChange = Boolean(user) && uploadsConfigured;

  const pick = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      const up = await uploadAvatar(file);
      const token = await currentIdToken();
      if (!token) throw new Error('আবার লগইন করুন।');
      await apiFetch('/me/avatar', { token, method: 'PUT', body: up });
      await completeSignIn({ status: 'authenticated', user: { ...user, avatarUrl: up.url } });
      showToast('প্রোফাইল ছবি বদলানো হয়েছে।');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'ছবি আপলোড হয়নি।', 'error');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="relative shrink-0">
      <Avatar url={user?.avatarUrl} name={name} />
      {canChange && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="প্রোফাইল ছবি বাছুন"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void pick(f);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => (online ? fileRef.current?.click() : showToast('ছবি বদলাতে ইন্টারনেট লাগবে।', 'info'))}
            aria-label="প্রোফাইল ছবি বদলান"
            className="absolute -right-1.5 -bottom-1.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-primary text-on-primary shadow-sm disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
        </>
      )}
    </div>
  );
}
