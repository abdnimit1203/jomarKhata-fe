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
    <div className="flex items-center gap-3 rounded-2xl bg-surface-muted p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-ink">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-ink-muted">{label}</p>
        <p className="truncate font-mono text-base font-bold tracking-wider text-ink select-all">{value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`${label} কপি করুন`}
        className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-primary-ink shadow-card"
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
      <section className="space-y-2.5 rounded-3xl bg-white p-5 shadow-card" aria-label="অ্যাকাউন্ট ও রেফারেল">
        <h2 className="text-sm font-semibold text-ink">অ্যাকাউন্ট ও রেফারেল</h2>
        <p className="rounded-2xl bg-warning-soft p-3 text-xs font-semibold text-warning-ink">
          আপনি গেস্ট / টেস্ট মোডে আছেন। হিসাব শুধু এই ফোনে, কোনো আইডি বা কোড এখনও নেই।
        </p>
        <p className="text-sm text-ink-muted">
          লগইন করলে এখানে আপনার ইউজার আইডি আর নিজের রেফারেল কোড দেখাবে, কপি করার বাটনসহ। আপনার কোড দিয়ে কেউ
          অ্যাকাউন্ট খুলে সাবস্ক্রিপশন নিলে আপনি ফ্রি মাস পাবেন।
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
    <section className="space-y-3 rounded-3xl bg-white p-5 shadow-card" aria-label="অ্যাকাউন্ট ও রেফারেল">
      <h2 className="text-sm font-semibold text-ink">অ্যাকাউন্ট ও রেফারেল</h2>
      <CopyRow label="ইউজার আইডি" value={user.accountId} icon={<IdCard className="h-5 w-5" />} />
      <CopyRow label="আমার রেফারেল কোড" value={user.referralCode} icon={<Gift className="h-5 w-5" />} />
      <p className="text-xs text-ink-muted">
        {promoter
          ? `এই কোড দিয়ে কেউ অ্যাকাউন্ট খুললে, তার সাবস্ক্রিপশন পেমেন্টের ${percent}% কমিশন আপনি পাবেন।`
          : 'এই কোড দিয়ে কেউ অ্যাকাউন্ট খুলে সাবস্ক্রিপশন নিলে আপনি ফ্রি মাস পাবেন।'}
      </p>
      {user.referralStats && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl bg-surface-muted p-3">
            <p className="text-xs text-ink-muted">আপনার কোডে যোগ দিয়েছেন</p>
            <p className="text-lg font-extrabold text-ink">{formatBanglaNumber(user.referralStats.referredUsers)} জন</p>
          </div>
          <div className="rounded-2xl bg-surface-muted p-3">
            {promoter ? (
              <>
                <p className="text-xs text-ink-muted">মোট কমিশন</p>
                <p className="text-lg font-extrabold text-ink">{formatTaka(user.referralStats.commissionEarned)}</p>
              </>
            ) : (
              <>
                <p className="text-xs text-ink-muted">ফ্রি পেয়েছেন</p>
                <p className="text-lg font-extrabold text-ink">{formatBanglaNumber(user.referralStats.freeDaysEarned ?? 0)} দিন</p>
              </>
            )}
          </div>
        </div>
      )}
      <a
        href={share}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tile-green-bg text-sm font-bold text-tile-green-fg"
      >
        <Share2 className="h-4 w-4" /> WhatsApp-এ কোড পাঠান
      </a>
      <p className="text-xs text-ink-muted">{user.email}</p>
      {onLogout && (
        <button type="button" onClick={onLogout} className="min-h-11 w-full rounded-2xl border border-border-strong text-sm font-bold text-ink">
          লগআউট
        </button>
      )}
    </section>
  );
}
