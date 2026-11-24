'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { RestoreFlow } from '@/components/settings/RestoreFlow';
import { AuthScreen } from './AuthScreen';
import { useJomarkhata } from '@/context/JomarkhataContext';

interface WelcomeScreenProps {
  /** Open the shop setup form: after signing in, or in guest / test mode. */
  onStart: () => void;
}

/**
 * First screen (owner, 2026-11-24): ONE choice. Full-screen illustration (`/brand/welcome-banner.webp`,
 * 74 KB, cached by the service worker so it shows offline), headline in the empty sky at the top,
 * and at the bottom a fade with a single "শুরু করুন" button that goes to sign-in. Accounts are
 * mandatory (email), so sign-in IS "start". Restoring from a backup file stays as a small link.
 *
 * Honest auth: sign-in needs the backend. Until it exists, the sign-in screen says so and offers a
 * temporary "try without login" path; that path disappears by itself once a real provider is available.
 */
export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const { completeSignIn } = useJomarkhata();
  const [showAuth, setShowAuth] = useState(false);
  const [showRestore, setShowRestore] = useState(false);
  if (showAuth)
    return (
      <AuthScreen
        onBack={() => setShowAuth(false)}
        onGuest={onStart}
        onSignedIn={async (state) => {
          await completeSignIn(state);
          onStart(); // signed in: set up the shop (name, owner, phone)
        }}
      />
    );

  return (
    <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-secondary via-canvas to-canvas">
      {/* Illustration fills the screen; the brand gradient shows until it loads (and offline before first cache). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/welcome-banner.webp"
        alt=""
        aria-hidden="true"
        width={720}
        height={1280}
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 mx-auto h-full w-full max-w-md object-cover object-[50%_60%]"
      />
      {/* Top fade keeps the headline readable over the shop roof */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[34%] bg-gradient-to-b from-secondary via-secondary/80 to-transparent" />
      {/* Bottom fade so the button sits on a calm background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-canvas via-canvas/90 to-transparent" />

      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-10 pb-8">
        {/* Brand + headline in the empty sky */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10" />
          <span className="text-xl font-extrabold tracking-tight text-primary-ink">জমারখাতা</span>
        </div>
        <h1 className="mt-6 text-3xl leading-tight font-extrabold text-ink">
          দোকানের সব হিসাব,
          <br />
          এক খাতায়।
        </h1>
        <p className="mt-2 text-base font-semibold text-ink-muted">বাকি, বিক্রি, খরচ — ইন্টারনেট ছাড়াও।</p>

        <div className="flex-1" />

        {/* One action */}
        <button
          type="button"
          onClick={() => setShowAuth(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient px-6 text-lg font-bold text-on-primary shadow-hero transition-colors hover:brightness-[0.97] active:scale-[0.99]"
        >
          <span>শুরু করুন</span>
          <ArrowRight className="h-5 w-5" />
        </button>

        {/* New phone / reinstalled app: bring the khata back from a backup file (S8). */}
        <p className="mt-4 text-center text-sm font-medium text-ink-muted">
          আগের হিসাবের ব্যাকআপ ফাইল আছে?{' '}
          <button
            type="button"
            onClick={() => setShowRestore((v) => !v)}
            aria-expanded={showRestore}
            className="font-bold text-primary-ink underline-offset-4 hover:underline"
          >
            ফিরিয়ে আনুন
          </button>
        </p>
        {showRestore && (
          <div className="mt-3 rounded-2xl bg-white p-4 shadow-card">
            <RestoreFlow />
          </div>
        )}
      </div>
    </div>
  );
}
