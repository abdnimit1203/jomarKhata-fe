'use client';

import React, { useState } from 'react';
import { ArrowLeft, Info, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { noBackendAuthProvider, normalizeBdMobile, type AuthProvider } from '@/lib/auth';

/**
 * Sign in / sign up (S10, UI-NOW / BE-LATER). Google first; Bangladeshi mobile OTP as the second
 * option (D26). With no backend the provider refuses honestly: no session is ever created here.
 */
export function AuthScreen({ onBack, provider = noBackendAuthProvider }: { onBack: () => void; provider?: AuthProvider }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const attempt = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'লগইন করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => {
    const normalized = normalizeBdMobile(phone);
    if (!normalized) return setPhoneError('সঠিক মোবাইল নম্বর লিখুন (যেমন 01712345678)।');
    setPhoneError(null);
    void attempt(() => provider.sendOtp(normalized));
  };

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
        <h1 className="mt-5 text-2xl font-extrabold text-ink">লগইন / নতুন অ্যাকাউন্ট</h1>
        <p className="mt-1 text-base text-ink-muted">অ্যাকাউন্ট থাকলে ফোন বদলালেও হিসাব ফেরত পাবেন।</p>

        {!provider.available && (
          <p role="status" className="mt-4 flex items-start gap-2.5 rounded-2xl bg-warning-soft p-3.5 text-sm font-semibold text-warning-ink">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            অ্যাকাউন্ট ও লগইন এখনও চালু হয়নি। আপাতত হিসাব এই ফোনেই থাকবে — নিয়মিত ব্যাকআপ ফাইল রাখুন।
          </p>
        )}

        <div className="mt-5 space-y-4 rounded-3xl bg-white p-5 shadow-card">
          <Button variant="secondary" size="xl" fullWidth disabled={busy} onClick={() => attempt(() => provider.signInWithGoogle())}>
            <span aria-hidden="true" className="text-lg font-extrabold">G</span> Google দিয়ে চালিয়ে যান
          </Button>

          <div className="flex items-center gap-3 text-sm text-ink-subtle">
            <span className="h-px flex-1 bg-border" /> অথবা মোবাইল নম্বর <span className="h-px flex-1 bg-border" />
          </div>

          <div>
            <label htmlFor="auth-phone" className="mb-1.5 block text-sm font-semibold text-ink-muted">
              মোবাইল নম্বর
            </label>
            <div className="relative">
              <Smartphone className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                id="auth-phone"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="h-12 w-full rounded-2xl border border-border-strong bg-white pr-4 pl-11 text-base text-ink focus:border-primary-ink focus:outline-none"
              />
            </div>
            {phoneError && <p className="mt-1 text-sm font-semibold text-danger">{phoneError}</p>}
          </div>
          <Button size="xl" fullWidth disabled={busy} onClick={sendCode}>
            কোড পাঠান
          </Button>

          {message && (
            <p role="alert" className="rounded-2xl bg-surface-muted p-3 text-sm font-semibold text-ink">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
