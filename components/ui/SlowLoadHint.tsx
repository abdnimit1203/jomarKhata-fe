'use client';

/**
 * Shown only when opening takes long (owner, 2026-11-25: "লোড হতে একটু সময় লাগে — সতর্কবার্তা
 * দেওয়া উচিত"). Appears after a few seconds so a normal fast start never shows it.
 */
import React, { useEffect, useState } from 'react';

export function SlowLoadHint({ afterMs = 4000 }: { afterMs?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShow(true), afterMs);
    return () => window.clearTimeout(t);
  }, [afterMs]);
  if (!show) return null;
  return (
    <p role="status" className="mx-auto mt-4 max-w-sm rounded-2xl bg-warning-soft px-4 py-3 text-center text-sm text-warning-ink">
      খাতা খুলতে একটু সময় লাগছে… নেট দুর্বল হলে বা ফোনে জায়গা কম থাকলে এমন হয়। অপেক্ষা করুন — আপনার হিসাব ফোনেই নিরাপদ আছে।
    </p>
  );
}

/** Branded start screen while the saved sign-in is read from the phone. */
export function StartSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="" width={64} height={64} className="h-16 w-16 animate-pulse" />
      <p className="mt-3 text-base font-bold text-primary-ink">জমারখাতা খোলা হচ্ছে…</p>
      <SlowLoadHint />
    </div>
  );
}
