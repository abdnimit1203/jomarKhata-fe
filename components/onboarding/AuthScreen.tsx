'use client';

import React, { useState } from 'react';
import { ArrowLeft, FlaskConical, Gift, Info, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/segmented';
import type { AuthProvider, AuthState } from '@/lib/auth';
import { authProvider } from '@/lib/auth-firebase';
import { useOnline } from '@/hooks/use-online';
import { normalizeReferralCode, referralFromSearch } from '@/lib/referral';

/**
 * Sign in / create account (owner, 2026-11-24: accounts are email-based and login is the normal way in).
 * - Google, or email + password (with "forgot password"). Firebase checks the password; our server
 *   never sees or stores it.
 * - Optional referral code (only used when a NEW account is created). `?ref=CODE` pre-fills it.
 * - "গেস্ট / টেস্ট মোড" is always offered: a khata on this phone only. Nothing goes to the server,
 *   and resetting the phone loses it.
 */
export function AuthScreen({
  onBack,
  onGuest,
  onSignedIn,
  provider = authProvider,
}: {
  onBack: () => void;
  /** Guest / test mode: continue without an account (this phone only). */
  onGuest?: () => void;
  /** A real session was opened. */
  onSignedIn?: (state: AuthState) => void | Promise<void>;
  provider?: AuthProvider;
}) {
  const online = useOnline();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [referral, setReferral] = useState(() => (typeof window !== 'undefined' ? referralFromSearch(window.location?.search ?? '') ?? '' : ''));
  const [referralError, setReferralError] = useState<string | null>(null);

  /** {} = no code; null = a code that isn't valid (asks to fix or clear it). */
  const referralOption = (): { referralCode?: string } | null => {
    if (!referral.trim()) return {};
    const code = normalizeReferralCode(referral);
    if (!code) {
      setReferralError('রেফারেল কোডটি ঠিক নেই। না থাকলে ঘরটি খালি রাখুন।');
      return null;
    }
    setReferralError(null);
    return { referralCode: code };
  };

  const attempt = async (fn: () => Promise<AuthState | void>) => {
    setBusy(true);
    setMessage(null);
    setInfo(null);
    try {
      const state = await fn();
      if (state && state.status === 'authenticated') await onSignedIn?.(state);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'লগইন করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMessage('ইমেইল ঠিকভাবে লিখুন।');
    if (password.length < 6) return setMessage('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন।');
    if (mode === 'signin') return void attempt(() => provider.signInWithEmail(email, password));
    const opt = referralOption();
    if (opt) void attempt(() => provider.signUpWithEmail(email, password, opt));
  };

  const forgot = () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setMessage('আগে ইমেইল লিখুন, তারপর "পাসওয়ার্ড ভুলে গেছি" চাপুন।');
    void attempt(async () => {
      await provider.sendPasswordReset(email);
      setInfo('পাসওয়ার্ড বদলানোর লিংক আপনার ইমেইলে পাঠানো হয়েছে।');
    });
  };

  const field =
    'h-12 w-full rounded-2xl border border-border-strong bg-white pr-4 pl-11 text-base text-ink focus:border-primary-ink focus:outline-none';

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="পিছনে যান"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="mt-5 text-2xl font-extrabold text-ink">{mode === 'signin' ? 'লগইন করুন' : 'নতুন অ্যাকাউন্ট খুলুন'}</h1>
        <p className="mt-1 text-base text-ink-muted">অ্যাকাউন্ট থাকলে ফোন বদলালেও হিসাব ফেরত পাবেন।</p>

        {provider.available && !online && (
          <p role="status" className="mt-4 flex items-start gap-2.5 rounded-2xl bg-warning-soft p-3.5 text-sm font-semibold text-warning-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            এখন ইন্টারনেট নেই। লগইন করতে একবার নেট লাগবে। নেট চালু হলে আবার চেষ্টা করুন — আপনার হিসাব নিরাপদ আছে।
          </p>
        )}
        {!provider.available && (
          <p role="status" className="mt-4 flex items-start gap-2.5 rounded-2xl bg-warning-soft p-3.5 text-sm font-semibold text-warning-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            অ্যাকাউন্ট ও লগইন এখনও চালু হয়নি। আপাতত গেস্ট / টেস্ট মোডে চালান।
          </p>
        )}

        <div className="mt-5 space-y-4 rounded-3xl bg-white p-5 shadow-card">
          {/* sign in / create account */}
          <SegmentedControl
            aria-label="লগইন না নতুন অ্যাকাউন্ট"
            variant="track"
            fullWidth
            value={mode}
            onValueChange={(v) => setMode(v as 'signin' | 'signup')}
            options={[
              { value: 'signin', label: 'লগইন' },
              { value: 'signup', label: 'নতুন অ্যাকাউন্ট' },
            ]}
          />

          <Button
            variant="secondary"
            size="xl"
            fullWidth
            disabled={busy}
            onClick={() => {
              const opt = mode === 'signup' ? referralOption() : {};
              if (opt) void attempt(() => provider.signInWithGoogle(opt));
            }}
          >
            <span aria-hidden="true" className="text-lg font-extrabold">G</span> Google দিয়ে {mode === 'signin' ? 'লগইন' : 'অ্যাকাউন্ট খুলুন'}
          </Button>

          <div className="flex items-center gap-3 text-sm text-ink-subtle">
            <span className="h-px flex-1 bg-border" /> অথবা ইমেইল দিয়ে <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submitEmail} className="space-y-3" noValidate>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                id="auth-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                aria-label="ইমেইল"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="আপনার ইমেইল"
                className={field}
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                id="auth-password"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                aria-label="পাসওয়ার্ড"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signin' ? 'পাসওয়ার্ড' : 'নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)'}
                className={field}
              />
            </div>

            {mode === 'signup' && (
              <div>
                <label htmlFor="auth-referral" className="mb-1.5 block text-sm font-semibold text-ink-muted">
                  রেফারেল কোড <span className="font-normal text-ink-subtle">(ঐচ্ছিক)</span>
                </label>
                <div className="relative">
                  <Gift className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
                  <input
                    id="auth-referral"
                    autoCapitalize="characters"
                    autoComplete="off"
                    value={referral}
                    onChange={(e) => setReferral(e.target.value)}
                    placeholder="কেউ কোড দিয়ে থাকলে লিখুন"
                    className={`${field} font-mono tracking-wider uppercase placeholder:font-sans placeholder:tracking-normal placeholder:normal-case`}
                  />
                </div>
                {referralError && <p className="mt-1 text-sm font-semibold text-danger">{referralError}</p>}
              </div>
            )}

            <Button type="submit" size="xl" fullWidth disabled={busy}>
              {busy ? 'অপেক্ষা করুন…' : mode === 'signin' ? 'লগইন করুন' : 'অ্যাকাউন্ট খুলুন'}
            </Button>
            {mode === 'signin' && (
              <button type="button" onClick={forgot} className="w-full text-center text-sm font-bold text-primary-ink">
                পাসওয়ার্ড ভুলে গেছি
              </button>
            )}
          </form>

          {message && (
            <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-danger">
              {message}
            </p>
          )}
          {info && (
            <p role="status" className="rounded-2xl bg-success-soft p-3 text-sm font-semibold text-ink">
              {info}
            </p>
          )}
        </div>

        {onGuest && (
          <div className="mt-5 rounded-3xl border border-dashed border-border-strong p-4 text-center">
            <button
              type="button"
              onClick={onGuest}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-base font-bold text-ink shadow-card"
            >
              <FlaskConical className="h-4 w-4" /> গেস্ট / টেস্ট মোডে চালান
            </button>
            <p className="mt-2 text-xs text-ink-muted">হিসাব শুধু এই ফোনে থাকবে, কোথাও যাবে না। ফোন রিসেট করলে সব মুছে যাবে।</p>
          </div>
        )}
      </div>
    </div>
  );
}
