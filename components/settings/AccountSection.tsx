'use client';

/**
 * Profile → account: user ID and own referral code, each with a copy button, plus a WhatsApp share.
 * Both come from the SERVER. Until login exists (no backend yet), this honestly says so and shows
 * no made-up ID or code.
 */
import React, { useState } from 'react';
import { Check, Copy, Gift, IdCard, Share2 } from 'lucide-react';
import type { AuthState } from '@/lib/auth';
import { REFERRAL_COMMISSION_RATE, referralShareText } from '@/lib/referral';
import { formatBanglaNumber, formatTaka } from '@/lib/format';

function CopyRow({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the value is still visible and selectable */
    }
  };
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="truncate font-mono text-sm font-bold tracking-wide text-ink select-all">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`${label} কপি করুন`}
        className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl px-2.5 text-xs font-bold text-primary-ink hover:bg-secondary"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'কপি হয়েছে' : 'কপি'}
      </button>
    </div>
  );
}

export function AccountSection({
  auth,
  onLogin,
  onLogout,
}: {
  auth: AuthState;
  /** Guest / test mode → open the sign-in screen. */
  onLogin?: () => void;
  onLogout?: () => void;
}) {
  const rate = (auth.status === 'authenticated' && auth.user.referralStats?.commissionRate) || REFERRAL_COMMISSION_RATE;
  const percent = formatBanglaNumber(Math.round(rate * 100));
  const promoter = auth.status === 'authenticated' && auth.user.referralStats?.referrerType === 'promoter';

  if (auth.status !== 'authenticated') {
    return (
      <section className="space-y-2.5 rounded-3xl bg-white p-4 shadow-card" aria-label="অ্যাকাউন্ট ও রেফারেল">
        <h2 className="text-sm font-semibold text-ink">অ্যাকাউন্ট ও রেফারেল</h2>
        <p className="text-sm text-ink-muted">
          গেস্ট মোড — কোনো আইডি বা কোড এখনও নেই। লগইন করলে নিজের রেফারেল কোড পাবেন; সেই কোডে কেউ সাবস্ক্রিপশন নিলে আপনি ফ্রি মাস পাবেন।
        </p>
        {onLogin && (
          <button
            type="button"
            onClick={onLogin}
            className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary-gradient text-base font-bold text-on-primary shadow-sm"
          >
            লগইন / নতুন অ্যাকাউন্ট
          </button>
        )}
      </section>
    );
  }

  const { user } = auth;
  const origin = typeof window !== 'undefined' ? window.location?.origin ?? '' : '';
  const share = `https://wa.me/?text=${encodeURIComponent(referralShareText(user.referralCode, origin))}`;
  return (
    // Compact on purpose (owner): the shop settings are the focus; account and referral sit quietly below.
    <section className="space-y-1 rounded-3xl bg-white p-4 shadow-card" aria-label="অ্যাকাউন্ট ও রেফারেল">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">অ্যাকাউন্ট</h2>
        <p className="truncate text-xs text-ink-muted">{user.email}</p>
      </div>
      <div className="divide-y divide-border">
        <CopyRow label="ইউজার আইডি" value={user.accountId} icon={<IdCard className="h-4 w-4" />} />
        <CopyRow label="আমার রেফারেল কোড" value={user.referralCode} icon={<Gift className="h-4 w-4" />} />
      </div>
      <p className="pt-1 text-xs text-ink-muted">
        {promoter
          ? `এই কোড দিয়ে কেউ অ্যাকাউন্ট খুললে, তার সাবস্ক্রিপশন পেমেন্টের ${percent}% কমিশন আপনি পাবেন।`
          : 'এই কোড দিয়ে কেউ অ্যাকাউন্ট খুলে সাবস্ক্রিপশন নিলে আপনি ফ্রি মাস পাবেন।'}
        {user.referralStats &&
          ` আপনার কোডে যোগ দিয়েছেন ${formatBanglaNumber(user.referralStats.referredUsers)} জন · ` +
            (promoter
              ? `মোট কমিশন ${formatTaka(user.referralStats.commissionEarned)}`
              : `ফ্রি পেয়েছেন ${formatBanglaNumber(user.referralStats.freeDaysEarned ?? 0)} দিন`)}
      </p>
      <div className="flex gap-2 pt-2">
        <a
          href={share}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-tile-green-bg text-xs font-bold text-tile-green-fg"
        >
          <Share2 className="h-4 w-4" /> কোড পাঠান
        </a>
        {onLogout && (
          <button type="button" onClick={onLogout} className="min-h-10 flex-1 rounded-xl border border-border-strong text-xs font-bold text-ink">
            লগআউট
          </button>
        )}
      </div>
    </section>
  );
}
