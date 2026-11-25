'use client';

/**
 * Top of Settings: what kind of user this is, in one small strip (owner, 2026-11-25):
 * গেস্ট · ফ্রি ট্রায়াল (N দিন বাকি) · সাবস্ক্রাইবড · মেয়াদ শেষ — and one highlighted button to the
 * plans (নবায়ন). Uses the cached session, so it shows offline too.
 */
import React, { useState } from 'react';
import { Crown, Sparkles, TriangleAlert } from 'lucide-react';
import type { AuthState } from '@/lib/auth';
import { formatBanglaNumber, toBanglaDigits } from '@/lib/format';
import { RenewSheet } from './RenewSheet';

export function PlanStatus({ auth }: { auth: AuthState }) {
  const [open, setOpen] = useState(false);
  const [now] = useState(() => Date.now()); // read once (render stays pure)

  // guests already see the "গেস্ট মোড … লগইন" banner at the top of every screen
  if (auth.status !== 'authenticated') return null;

  const sub = auth.user.subscription;
  const end = sub ? new Date(sub.expiresAt) : null;
  const left = end ? Math.ceil((end.getTime() - now) / 86_400_000) : 0;
  const expired = !sub || left <= 0;
  const trial = !expired && sub?.status === 'trial';
  const p = (n: number) => String(n).padStart(2, '0');
  const date = end ? toBanglaDigits(`${p(end.getDate())}/${p(end.getMonth() + 1)}/${end.getFullYear()}`) : '';

  const look = expired
    ? { box: 'bg-danger-soft', icon: <TriangleAlert className="h-5 w-5 text-danger" />, title: 'মেয়াদ শেষ', cta: 'এখনই নবায়ন করুন' }
    : trial
      ? { box: 'bg-tile-gold-bg', icon: <Sparkles className="h-5 w-5 text-tile-gold-fg" />, title: 'ফ্রি ট্রায়াল চলছে', cta: 'প্ল্যান দেখুন' }
      : { box: 'bg-success-soft', icon: <Crown className="h-5 w-5 text-success" />, title: 'সাবস্ক্রাইবড', cta: 'মেয়াদ বাড়ান' };

  return (
    <>
      <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${look.box}`}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white">{look.icon}</span>
        <p className="min-w-0 flex-1 text-sm">
          <b className="text-ink">{look.title}</b>
          <span className="block text-xs text-ink-muted">
            {expired ? 'হিসাব দেখা যাবে, নতুন লেখা যাবে না' : `${date} পর্যন্ত · ${formatBanglaNumber(left)} দিন বাকি`}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`shrink-0 rounded-xl px-3.5 py-2 text-sm font-bold ${expired || trial ? 'bg-primary-gradient text-on-primary shadow-sm' : 'bg-white text-primary-ink'}`}
        >
          {look.cta}
        </button>
      </div>
      <RenewSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
