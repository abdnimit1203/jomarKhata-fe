'use client';

/** /admin/dashboard: counts, pending payment requests, and subscriptions ending within 7 days. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { BadgeCheck, CircleAlert, Clock, CreditCard, Users } from 'lucide-react';
import { formatBanglaNumber } from '@/lib/format';
import { adminFetch } from './adminApi';
import { fmtDate, Pill, TABLE, TD, TH } from './AdminShell';

export interface AdminUserRow {
  accountId: string;
  email: string;
  phone: string;
  shopName: string;
  displayName: string;
  role: string;
  status: 'active' | 'blocked';
  referralCode: string;
  referrerType: string;
  createdAt: string;
  lastSeenAt: string;
  subscription: { status: 'trial' | 'active' | 'expired'; plan: string; expiresAt: string; daysLeft: number };
}

interface Stats {
  total: number;
  trial: number;
  paid: number;
  expired: number;
  blocked: number;
  endingSoon: AdminUserRow[];
}

/** Users table (dashboard + users page). Row click opens the user. */
export function UsersTable({ users, empty = 'কাউকে পাওয়া যায়নি।' }: { users: AdminUserRow[]; empty?: string }) {
  const router = useRouter();
  if (users.length === 0) return <p className="px-4 py-8 text-center text-sm text-ink-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className={TABLE}>
        <thead>
          <tr>
            <th className={TH}>আইডি</th>
            <th className={TH}>দোকান / নাম</th>
            <th className={TH}>ইমেইল · ফোন</th>
            <th className={TH}>অবস্থা</th>
            <th className={TH}>মেয়াদ</th>
            <th className={TH}>যোগ দিয়েছেন</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.accountId} onClick={() => router.push(`/admin/users/${u.accountId}`)} className="cursor-pointer hover:bg-canvas">
              <td className={`${TD} font-mono text-xs font-bold`}>{u.accountId}</td>
              <td className={TD}>
                <span className="font-semibold">{u.shopName || u.displayName || '—'}</span>
                {u.status === 'blocked' && <span className="ml-1 text-xs font-bold text-danger">(বন্ধ)</span>}
                {u.role === 'super_admin' && <span className="ml-1 text-xs font-bold text-primary-ink">(অ্যাডমিন)</span>}
              </td>
              <td className={`${TD} text-xs text-ink-muted`}>
                {u.email}
                {u.phone && <div>{u.phone}</div>}
              </td>
              <td className={TD}>
                <Pill status={u.subscription.status} />
              </td>
              <td className={`${TD} text-xs`}>
                {fmtDate(u.subscription.expiresAt)}
                {u.subscription.status !== 'expired' && <div className="text-ink-muted">{formatBanglaNumber(u.subscription.daysLeft)} দিন বাকি</div>}
              </td>
              <td className={`${TD} text-xs text-ink-muted`}>{fmtDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminDashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    adminFetch<Stats>('/admin/stats')
      .then(setS)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'লোড করা যায়নি।'));
    adminFetch<{ pending: number }>('/admin/payments?status=pending')
      .then((r) => setPending(r.pending))
      .catch(() => {});
  }, []);
  if (err) return <p className="text-danger">{err}</p>;
  if (!s) return <p className="text-ink-muted">লোড হচ্ছে…</p>;

  // each box its own colour, so the numbers are easy to tell apart at a glance
  const cards = [
    { label: 'মোট ইউজার', value: s.total, href: '/admin/users', box: 'bg-tile-indigo-bg', tone: 'text-tile-indigo-fg', icon: Users },
    { label: 'ট্রায়ালে', value: s.trial, href: '/admin/users?filter=trial', box: 'bg-tile-sky-bg', tone: 'text-tile-sky-fg', icon: Clock },
    { label: 'পেইড', value: s.paid, href: '/admin/users?filter=paid', box: 'bg-tile-green-bg', tone: 'text-tile-green-fg', icon: BadgeCheck },
    { label: 'মেয়াদ শেষ', value: s.expired, href: '/admin/users?filter=expired', box: 'bg-tile-red-bg', tone: 'text-tile-red-fg', icon: CircleAlert },
    { label: 'নতুন পেমেন্ট রিকোয়েস্ট', value: pending ?? 0, href: '/admin/payments', box: 'bg-tile-gold-bg', tone: 'text-tile-gold-fg', icon: CreditCard },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`rounded-2xl p-4 shadow-card transition hover:-translate-y-0.5 ${c.box}`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs font-bold ${c.tone}`}>{c.label}</p>
              <c.icon className={`h-5 w-5 ${c.tone}`} />
            </div>
            <p className={`mt-2 text-3xl font-extrabold ${c.tone}`}>{formatBanglaNumber(c.value)}</p>
          </Link>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        <h2 className="border-b border-border bg-warning-soft px-4 py-3 text-sm font-bold text-warning-ink">৭ দিনের মধ্যে মেয়াদ শেষ হবে ({formatBanglaNumber(s.endingSoon.length)})</h2>
        <UsersTable users={s.endingSoon} empty="সামনের ৭ দিনে কারো মেয়াদ শেষ হচ্ছে না।" />
      </section>
    </div>
  );
}
