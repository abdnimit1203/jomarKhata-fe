'use client';

/**
 * /admin/users/[accountId]: one user. Subscription (extend +30/+180/+365 or custom, set an end
 * date, expire now — every change logged), block / unblock, who referred them, who they referred,
 * and the subscription history.
 */
import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { useFmtDate, useNum, useTr } from './i18n';
import { DateInput } from '@/components/ui/DateInput';
import { SimpleSelect } from '@/components/ui/select';
import { formatBanglaNumber, formatTaka } from '@/lib/format';
import { adminFetch } from './adminApi';
import { type AdminUserRow, UsersTable } from './AdminDashboard';
import { Pill, TABLE, TD, TH } from './AdminShell';

interface LogRow {
  _id: string;
  action: 'extend' | 'set_date' | 'expire';
  plan: string;
  days: number;
  before: string;
  after: string;
  amount: number;
  method: string;
  trxId: string;
  note: string;
  by: string;
  createdAt: string;
}
interface Detail {
  user: AdminUserRow;
  referredBy: { accountId: string; email: string; referralCode: string } | null;
  referred: AdminUserRow[];
  history: LogRow[];
}
const ACTION: Record<string, string> = { extend: 'মেয়াদ বাড়ানো', set_date: 'তারিখ ঠিক করা', expire: 'মেয়াদ শেষ করা' };
const input = 'h-10 w-full rounded-xl border border-border-strong bg-white px-3 text-sm focus:border-primary-ink focus:outline-none';

export function AdminUserDetail({ accountId }: { accountId: string }) {
  const tr = useTr();
  const fd = useFmtDate();
  const num = useNum();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState('30');
  const [date, setDate] = useState('');
  const [pay, setPay] = useState({ amount: '', method: 'bkash', trxId: '', note: '' });

  const load = useCallback(() => {
    adminFetch<Detail>(`/admin/users/${encodeURIComponent(accountId)}`)
      .then(setD)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'লোড করা যায়নি।'));
  }, [accountId]);
  useEffect(load, [load]);

  if (err) return <p className="text-danger">{err}</p>;
  if (!d) return <p className="text-ink-muted">{tr("লোড হচ্ছে…")}</p>;
  const u = d.user;

  const change = async (body: Record<string, unknown>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const payment = { amount: Number(pay.amount) || 0, method: pay.method, trxId: pay.trxId.trim(), note: pay.note.trim() };
      await adminFetch(`/admin/users/${encodeURIComponent(accountId)}/subscription`, { method: 'POST', body: { ...body, ...payment } });
      setMsg(done);
      setPay({ amount: '', method: 'bkash', trxId: '', note: '' });
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };
  const setStatus = async (status: 'active' | 'blocked') => {
    try {
      await adminFetch(`/admin/users/${encodeURIComponent(accountId)}/status`, { method: 'POST', body: { status } });
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'করা যায়নি।');
    }
  };

  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="text-sm font-bold text-primary-ink">
        {tr("← সব ইউজার")}
      </Link>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="space-y-2 rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">{u.shopName || u.displayName || u.email}</h2>
              <p className="font-mono text-sm font-bold">{u.accountId}</p>
            </div>
            {u.role !== 'super_admin' &&
              (u.status === 'blocked' ? (
                <button type="button" onClick={() => setStatus('active')} className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white">
                  {tr("চালু করুন")}
                </button>
              ) : (
                <button type="button" onClick={() => setStatus('blocked')} className="rounded-lg border border-danger-border px-3 py-1.5 text-xs font-bold text-danger">
                  {tr("বন্ধ করুন")}
                </button>
              ))}
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-y-1.5 text-sm">
            <dt className="text-ink-muted">{tr("ইমেইল")}</dt>
            <dd>{u.email}</dd>
            <dt className="text-ink-muted">{tr("ফোন")}</dt>
            <dd>{u.phone || '—'}</dd>
            <dt className="text-ink-muted">{tr("অবস্থা")}</dt>
            <dd>{u.status === 'blocked' ? <span className="font-bold text-danger">{tr("বন্ধ")}</span> : 'চালু'}</dd>
            <dt className="text-ink-muted">{tr("রেফারেল কোড")}</dt>
            <dd className="font-mono font-bold">{u.referralCode}</dd>
            <dt className="text-ink-muted">{tr("যাকে দিয়ে এসেছে")}</dt>
            <dd>
              {d.referredBy ? (
                <Link href={`/admin/users/${d.referredBy.accountId}`} className="text-primary-ink hover:underline">
                  {d.referredBy.accountId} ({d.referredBy.referralCode})
                </Link>
              ) : (
                '—'
              )}
            </dd>
            <dt className="text-ink-muted">{tr("যোগ দিয়েছেন")}</dt>
            <dd>{fd(u.createdAt)}</dd>
            <dt className="text-ink-muted">{tr("শেষ দেখা")}</dt>
            <dd>{fd(u.lastSeenAt)}</dd>
          </dl>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{tr("সাবস্ক্রিপশন")}</h2>
            <Pill status={u.subscription.status} />
          </div>
          <p className="text-sm">
            <b>{fd(u.subscription.expiresAt)}</b> পর্যন্ত
            {u.subscription.status !== 'expired' && ` · ${num(u.subscription.daysLeft)} দিন বাকি`}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input className={input} placeholder={tr("টাকা (ঐচ্ছিক)")} inputMode="decimal" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            <SimpleSelect
              aria-label={tr("মাধ্যম")}
              value={pay.method}
              onValueChange={(v) => setPay({ ...pay, method: v })}
              options={[
                { value: 'bkash', label: tr("বিকাশ") },
                { value: 'nagad', label: tr("নগদ") },
                { value: 'bank', label: tr("ব্যাংক") },
                { value: 'cash', label: tr("ক্যাশ") },
                { value: 'free', label: tr("ফ্রি") },
              ]}
            />
            <input className={input} placeholder={tr("TrxID (ঐচ্ছিক)")} value={pay.trxId} onChange={(e) => setPay({ ...pay, trxId: e.target.value })} />
            <input className={input} placeholder="নোট" value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[30, 180, 365].map((n) => (
              <button key={n} type="button" disabled={busy} onClick={() => change({ action: 'extend', days: n, plan: `${n}d` }, `${n} দিন বাড়ানো হয়েছে।`)} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-on-primary disabled:opacity-50">
                +{num(n)} দিন
              </button>
            ))}
            <span className="flex items-center gap-1">
              <input className={`${input} w-20`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} aria-label={tr("দিন")} />
              <button type="button" disabled={busy || !(Number(days) > 0)} onClick={() => change({ action: 'extend', days: Number(days), plan: `${days}d` }, `${days} দিন বাড়ানো হয়েছে।`)} className="rounded-lg border border-border-strong px-3 py-2 text-xs font-bold disabled:opacity-50">
                {tr("দিন বাড়ান")}
              </button>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-44">
              <DateInput value={date} onChange={setDate} aria-label={tr("শেষ তারিখ")} />
            </div>
            <button type="button" disabled={busy || !date} onClick={() => change({ action: 'set_date', expiresAt: date, plan: 'custom' }, 'তারিখ ঠিক করা হয়েছে।')} className="rounded-lg border border-border-strong px-3 py-2 text-xs font-bold disabled:opacity-50">
              {tr("এই তারিখ পর্যন্ত")}
            </button>
            <button type="button" disabled={busy} onClick={() => change({ action: 'expire' }, 'মেয়াদ শেষ করা হয়েছে।')} className="ml-auto rounded-lg border border-danger-border px-3 py-2 text-xs font-bold text-danger disabled:opacity-50">
              {tr("এখনই মেয়াদ শেষ")}
            </button>
          </div>
          {msg && <p className="rounded-xl bg-surface-muted p-2.5 text-sm font-semibold">{msg}</p>}
          <p className="text-xs text-ink-muted">{tr("দিন বাড়ালে বাকি থাকা দিনের পরে যোগ হয়। প্রতিটা বদল নিচের ইতিহাসে থাকে।")} {tr("টাকা, TrxID আর নোট ঐচ্ছিক — শুধু রেকর্ড রাখার জন্য (যেমন কেউ সরাসরি টাকা দিল, বা প্রচারের জন্য ফ্রি দিন)।")}</p>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-bold">{tr("সাবস্ক্রিপশনের ইতিহাস")}</h2>
        {d.history.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink-muted">{tr("এখনও কোনো বদল নেই।")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead>
                <tr>
                  <th className={TH}>{tr("তারিখ")}</th>
                  <th className={TH}>{tr("কাজ")}</th>
                  <th className={TH}>{tr("আগে → পরে")}</th>
                  <th className={TH}>{tr("টাকা · মাধ্যম")}</th>
                  <th className={TH}>{tr("TrxID · নোট")}</th>
                  <th className={TH}>{tr("কে করেছে")}</th>
                </tr>
              </thead>
              <tbody>
                {d.history.map((h) => (
                  <tr key={h._id}>
                    <td className={`${TD} text-xs`}>{fd(h.createdAt)}</td>
                    <td className={`${TD} text-xs`}>
                      {tr(ACTION[h.action])}
                      {h.days ? ` (+${num(h.days)} দিন)` : ''}
                    </td>
                    <td className={`${TD} text-xs`}>
                      {fd(h.before)} → <b>{fd(h.after)}</b>
                    </td>
                    <td className={`${TD} text-xs`}>
                      {h.amount ? `৳ ${num(h.amount)}` : '—'} {h.method}
                    </td>
                    <td className={`${TD} text-xs`}>
                      <span className="font-mono">{h.trxId}</span> {h.note}
                    </td>
                    <td className={`${TD} text-xs text-ink-muted`}>{h.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-card">
        <h2 className="border-b border-border px-4 py-3 text-sm font-bold">এই ইউজারের রেফারেলে এসেছে ({num(d.referred.length)})</h2>
        <UsersTable users={d.referred} empty="এখনও কেউ না।" />
      </section>
    </div>
  );
}
