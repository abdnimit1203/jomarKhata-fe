'use client';

import React, { useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { WelcomeIllustration } from './WelcomeIllustration';

interface WelcomeScreenProps {
  /** Start using the app in local mode (no account). */
  onStartLocal: () => void;
}

/**
 * First screen when the user is not logged in. Layout follows the owner's reference theme
 * ("Main app THEME … first page"): brand on top, large headline, illustration, one big pill CTA,
 * and a secondary sign-in line.
 *
 * Honest auth (plan §7.2): login needs the backend, so "লগইন করুন" only explains that cloud
 * accounts are not available yet. It never creates a signed-in state.
 */
export function WelcomeScreen({ onStartLocal }: WelcomeScreenProps) {
  const [showLoginNote, setShowLoginNote] = useState(false);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-secondary via-canvas to-canvas">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-10 pb-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-white shadow-sm">
            জ
          </span>
          <span className="text-xl font-extrabold tracking-tight text-primary">জমারখাতা</span>
        </div>

        {/* Headline */}
        <h1 className="mt-8 text-3xl leading-tight font-extrabold text-ink">
          দোকানের সব হিসাব,
          <br />
          এক খাতায়।
        </h1>
        <p className="mt-3 text-base font-medium text-ink-muted">
          বেচা-কেনা, বাকি আর খরচ — ইন্টারনেট ছাড়াই আপনার ফোনে সহজে রাখুন।
        </p>

        {/* Illustration */}
        <div className="mt-6 flex flex-1 items-center justify-center">
          <WelcomeIllustration className="h-auto w-full max-w-[340px]" />
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={onStartLocal}
          className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary px-6 text-base font-bold text-white shadow-hero transition-colors hover:bg-primary-hover active:scale-[0.99]"
        >
          <span>লগইন ছাড়া শুরু করুন</span>
          <ArrowRight className="h-5 w-5" />
        </button>

        {/* Secondary: sign in (backend not available yet) */}
        <p className="mt-4 text-center text-sm font-medium text-ink-muted">
          অ্যাকাউন্ট আছে?{' '}
          <button
            type="button"
            onClick={() => setShowLoginNote((v) => !v)}
            aria-expanded={showLoginNote}
            className="font-bold text-primary underline-offset-4 hover:underline"
          >
            লগইন করুন
          </button>
        </p>

        {showLoginNote && (
          <div role="status" className="mt-3 flex items-start gap-2.5 rounded-2xl bg-warning-soft p-3.5 text-sm font-medium text-warning-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              ক্লাউড অ্যাকাউন্ট এখনও চালু হয়নি। আপাতত লগইন ছাড়াই ব্যবহার করুন — আপনার হিসাব এই ফোনেই সংরক্ষিত থাকবে।
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
