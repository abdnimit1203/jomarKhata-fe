'use client';

import React, { useState } from 'react';
import { ArrowRight, Info } from 'lucide-react';
import { WelcomeIllustration } from './WelcomeIllustration';
import { RestoreFlow } from '@/components/settings/RestoreFlow';

interface WelcomeScreenProps {
  /** Start the owner's own khata (opens the shop setup form). */
  onStart: () => void;
  /** Look around with sample data (separate demo database). */
  onDemo: () => void;
}

/**
 * First screen when the user is not logged in. Layout follows the owner's reference theme
 * ("Main app THEME … first page"): brand on top, large headline, illustration, one big pill CTA,
 * and a secondary sign-in line.
 *
 * Honest auth (plan §7.2): login needs the backend, so "লগইন করুন" only explains that accounts
 * are not available yet. It never creates a signed-in state. (D26: login becomes mandatory once
 * the backend exists; until then the khata is local to this phone.)
 */
export function WelcomeScreen({ onStart, onDemo }: WelcomeScreenProps) {
  const [showLoginNote, setShowLoginNote] = useState(false);
  const [showRestore, setShowRestore] = useState(false);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-secondary via-canvas to-canvas">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-10 pb-8">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10" />
          <span className="text-xl font-extrabold tracking-tight text-primary-ink">জমারখাতা</span>
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
          onClick={onStart}
          className="mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-primary-gradient px-6 text-base font-bold text-on-primary shadow-hero transition-colors hover:brightness-[0.97] active:scale-[0.99]"
        >
          <span>আমার খাতা শুরু করুন</span>
          <ArrowRight className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onDemo}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-full border border-border-strong bg-white px-6 text-base font-bold text-ink"
        >
          আগে ডেমো দেখুন
        </button>

        {/* Secondary: sign in (backend not available yet) */}
        <p className="mt-4 text-center text-sm font-medium text-ink-muted">
          অ্যাকাউন্ট আছে?{' '}
          <button
            type="button"
            onClick={() => setShowLoginNote((v) => !v)}
            aria-expanded={showLoginNote}
            className="font-bold text-primary-ink underline-offset-4 hover:underline"
          >
            লগইন করুন
          </button>
        </p>

        {showLoginNote && (
          <div role="status" className="mt-3 flex items-start gap-2.5 rounded-2xl bg-warning-soft p-3.5 text-sm font-medium text-warning-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              অ্যাকাউন্ট ও লগইন এখনও চালু হয়নি। আপাতত আপনার হিসাব এই ফোনেই সংরক্ষিত থাকবে; অ্যাকাউন্ট চালু হলে এই হিসাব আপনার অ্যাকাউন্টে যুক্ত করা যাবে।
            </span>
          </div>
        )}

        {/* New phone / reinstalled app: bring the khata back from a backup file (S8). */}
        <p className="mt-3 text-center text-sm font-medium text-ink-muted">
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
