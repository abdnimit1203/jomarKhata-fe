'use client';

/**
 * /admin/payments  → সাবস্ক্রিপশন রিকোয়েস্ট (pending first, oldest first) with approve / reject.
 * /admin/orders    → সাবস্ক্রিপশন অর্ডার (approved payments, newest first).
 */
import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { SegmentedControl } from '@/components/ui/segmented';
import { formatBanglaNumber, formatTaka } from '@/lib/format';
import { adminFetch } from './adminApi';
import { fmtDate, Pill, TABLE, TD, TH } from './AdminShell';

interface PaymentRow {
  _id: string;
  accountId: string;
  email: string;
  shopName: string;
  plan: string;
  planLabel: string;
  days: number;
  amount: number;
  method: 'bkash' | 'nagad' | 'bank';
  payerNumber: string;
  trxId: string;
  note: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy: string;
  decidedAt: string | null;
  reason: string;
  expiresAtAfter: string | null;
  createdAt: string;
}
type Status = 'pending' | 'approved' | 'rejected' | 'all';
const METHOD: Record<string, string> = { bkash: 'বিকাশ', nagad: 'নগদ', bank: 'ব্যাংক' };

function PaymentsList({ fixed }: { fixed?: Status }) {
  const [status, setStatus] = useState<Status>(fixed ?? 'pending');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [res, setRes] = useState<{ total: number; requests: PaymentRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; reason: string } | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams({ status, q: query });
    adminFetch<{ total: number; requests: PaymentRow[] }>(`/admin/payments?${qs}`)
      .then((r) => {
        setRes(r);
        setErr(null);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'লোড করা যায়নি।'));
  }, [status, query]);
  useEffect(load, [load]);

  const act = async (id: string, kind: 'approve' | 'reject', reason?: string) => {
    setBusy(id);
    try {
      await adminFetch(`/admin/payments/${id}/${kind}`, { method: 'POST', body: kind === 'reject' ? { reason } : {} });
      setRejecting(null);
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'করা যায়নি।');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
          className="flex min-w-[260px] flex-1 gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="TrxID, আইডি, ইমেইল, দোকান বা নম্বর"
            aria-label="পেমেন্ট খুঁজুন"
            className="h-10 min-w-0 flex-1 rounded-xl border border-border-strong bg-white px-3.5 text-sm focus:border-primary-ink focus:outline-none"
          />
          <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary">
            খুঁজুন
          </button>
        </form>
        {!fixed && (
          <SegmentedControl
            aria-label="কোন রিকোয়েস্ট"
            variant="chips"
            value={status}
            onValueChange={(v) => setStatus(v as Status)}
            options={[
              { value: 'pending', label: 'অপেক্ষায়' },
              { value: 'approved', label: 'অনুমোদিত' },
              { value: 'rejected', label: 'বাতিল' },
              { value: 'all', label: 'সব' },
            ]}
          />
        )}
      </div>
      {err && <p className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">{err}</p>}
      {res && (
        <section className="overflow-hidden rounded-2xl bg-white shadow-card">
          <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-ink-muted">মোট {formatBanglaNumber(res.total)}টি</p>
          {res.requests.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">{status === 'pending' ? 'নতুন কোনো রিকোয়েস্ট নেই।' : 'কিছু নেই।'}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={TABLE}>
                <thead>
                  <tr>
                    <th className={TH}>তারিখ</th>
                    <th className={TH}>দোকান / আইডি</th>
                    <th className={TH}>প্ল্যান</th>
                    <th className={TH}>টাকা</th>
                    <th className={TH}>মাধ্যম · নম্বর</th>
                    <th className={TH}>TrxID</th>
                    <th className={TH}>অবস্থা</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {res.requests.map((p) => (
                    <tr key={p._id} className="hover:bg-canvas">
                      <td className={`${TD} text-xs`}>{fmtDate(p.createdAt)}</td>
                      <td className={TD}>
                        <Link href={`/admin/users/${p.accountId}`} className="font-semibold text-primary-ink hover:underline">
                          {p.shopName || p.email}
                        </Link>
                        <div className="font-mono text-xs text-ink-muted">{p.accountId}</div>
                      </td>
                      <td className={`${TD} text-xs`}>
                        {p.planLabel} ({formatBanglaNumber(p.days)} দিন)
                      </td>
                      <td className={`${TD} font-bold`}>{formatTaka(p.amount)}</td>
                      <td className={`${TD} text-xs`}>
                        {METHOD[p.method]}
                        {p.payerNumber && <div className="text-ink-muted">{p.payerNumber}</div>}
                      </td>
                      <td className={`${TD} font-mono text-xs font-bold`}>{p.trxId}</td>
                      <td className={TD}>
                        <Pill status={p.status} />
                        {p.status === 'approved' && p.expiresAtAfter && <div className="mt-1 text-xs text-ink-muted">{fmtDate(p.expiresAtAfter)} পর্যন্ত</div>}
                        {p.status === 'rejected' && p.reason && <div className="mt-1 text-xs text-danger">{p.reason}</div>}
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>
                        {p.status === 'pending' &&
                          (rejecting?.id === p._id ? (
                            <div className="flex gap-1.5">
                              <input
                                autoFocus
                                value={rejecting.reason}
                                onChange={(e) => setRejecting({ id: p._id, reason: e.target.value })}
                                placeholder="কারণ"
                                className="h-8 w-32 rounded-lg border border-border-strong px-2 text-xs"
                              />
                              <button type="button" disabled={!rejecting.reason.trim() || busy === p._id} onClick={() => act(p._id, 'reject', rejecting.reason)} className="rounded-lg bg-danger px-2.5 text-xs font-bold text-white disabled:opacity-50">
                                বাতিল
                              </button>
                              <button type="button" onClick={() => setRejecting(null)} className="px-1 text-xs text-ink-muted">
                                না
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-1.5">
                              <button type="button" disabled={busy === p._id} onClick={() => act(p._id, 'approve')} className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                                অনুমোদন
                              </button>
                              <button type="button" onClick={() => setRejecting({ id: p._id, reason: '' })} className="rounded-lg border border-danger-border px-3 py-1.5 text-xs font-bold text-danger">
                                বাতিল
                              </button>
                            </div>
                          ))}
                        {p.status !== 'pending' && <span className="text-xs text-ink-muted">{p.decidedBy}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function AdminPayments() {
  return <PaymentsList />;
}

export function AdminOrders() {
  return <PaymentsList fixed="approved" />;
}
