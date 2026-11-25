'use client';

/**
 * Sidebar → রিপোর্ট: problem reports sent from the app's "সমস্যা জানান" button.
 * Who (account link or guest), which screen, what, when; mark solved / reopen.
 */
import Link from 'next/link';
import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SegmentedControl } from '@/components/ui/segmented';
import { adminFetch } from './adminApi';
import { Pill } from './AdminShell';
import { useFmtDate, useNum, useTr } from './i18n';

interface ReportRow {
  _id: string;
  accountId: string;
  email: string;
  shopName: string;
  reporterName: string;
  reporterPhone: string;
  writtenAt: string | null;
  message: string;
  page: string;
  appVersion: string;
  userAgent: string;
  status: 'open' | 'resolved';
  resolvedBy: string;
  createdAt: string;
}
type Status = 'open' | 'resolved' | 'all';

/** "Android · Chrome" style hint from the user agent (enough to reproduce). */
function device(ua: string): string {
  const os = /android/i.test(ua) ? 'Android' : /iphone|ipad/i.test(ua) ? 'iPhone' : /windows/i.test(ua) ? 'Windows' : /mac os/i.test(ua) ? 'Mac' : '';
  const br = /SamsungBrowser/i.test(ua) ? 'Samsung' : /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : '';
  return [os, br].filter(Boolean).join(' · ');
}

export function AdminReports() {
  const tr = useTr();
  const fd = useFmtDate();
  const num = useNum();
  // ?id=<report> (from the Telegram "View report" button): show all and highlight that one
  const focusId = useSearchParams()?.get('id') ?? '';
  const [status, setStatus] = useState<Status>(focusId ? 'all' : 'open');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [res, setRes] = useState<{ total: number; open: number; reports: ReportRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    adminFetch<{ total: number; open: number; reports: ReportRow[] }>(`/admin/reports?${new URLSearchParams({ status, q: query })}`)
      .then((r) => {
        setRes(r);
        setErr(null);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : tr('লোড করা যায়নি।')));
  }, [status, query, tr]);
  useEffect(load, [load]);
  useEffect(() => {
    if (focusId && res) document.getElementById(`report-${focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusId, res]);

  const mark = async (id: string, next: 'open' | 'resolved') => {
    setBusy(id);
    try {
      await adminFetch(`/admin/reports/${id}/status`, { method: 'POST', body: { status: next } });
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tr('করা যায়নি।'));
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
            placeholder={tr('লেখা, আইডি, ইমেইল বা দোকান')}
            aria-label={tr('রিপোর্ট খুঁজুন')}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border-strong bg-white px-3.5 text-sm focus:border-primary-ink focus:outline-none"
          />
          <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary">
            {tr('খুঁজুন')}
          </button>
        </form>
        <SegmentedControl
          aria-label={tr('কোন রিপোর্ট')}
          variant="chips"
          value={status}
          onValueChange={(v) => setStatus(v as Status)}
          options={[
            { value: 'open', label: tr('খোলা') },
            { value: 'resolved', label: tr('সমাধান হয়েছে') },
            { value: 'all', label: tr('সব') },
          ]}
        />
      </div>
      {err && <p className="rounded-xl bg-danger-soft p-3 text-sm font-semibold text-danger">{err}</p>}
      {res && (
        <section className="space-y-3">
          <p className="text-xs font-semibold text-ink-muted">
            {tr('মোট')} {num(res.total)} · {tr('খোলা')} {num(res.open)}
          </p>
          {res.reports.length === 0 && <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-ink-muted shadow-card">{tr('কোনো রিপোর্ট নেই।')}</p>}
          {res.reports.map((r) => (
            <article
              key={r._id}
              id={`report-${r._id}`}
              className={`space-y-2 rounded-2xl border-l-4 bg-white p-4 shadow-card ${r.status === 'open' ? 'border-tile-orange-fg' : 'border-success'} ${r._id === focusId ? 'ring-4 ring-primary/40' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  {r.accountId ? (
                    <Link href={`/admin/users/${r.accountId}`} className="font-bold text-primary-ink hover:underline">
                      {r.shopName || r.email}
                    </Link>
                  ) : (
                    <b>{r.shopName || tr('গেস্ট (লগইন ছাড়া)')}</b>
                  )}
                  <span className="ml-2 font-mono text-xs text-ink-muted">{r.accountId || tr('গেস্ট')}</span>
                  {/* second small line: who wrote it */}
                  {(r.reporterName || r.reporterPhone) && (
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {r.reporterName}
                      {r.reporterName && r.reporterPhone && ' · '}
                      {r.reporterPhone && (
                        <a href={`tel:${r.reporterPhone}`} className="font-semibold text-primary-ink hover:underline">
                          {r.reporterPhone}
                        </a>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-muted">{fd(r.createdAt)}</span>
                  <Pill status={r.status} />
                </div>
              </div>
              <p className="text-base whitespace-pre-wrap text-ink">{r.message}</p>
              <p className="text-xs text-ink-muted">
                {[r.page, r.appVersion && `v${r.appVersion}`, device(r.userAgent), r.email, r.writtenAt && `${tr('অফলাইনে লেখা')} ${fd(r.writtenAt)}`]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="flex items-center gap-2 pt-1">
                {r.status === 'open' ? (
                  <button type="button" disabled={busy === r._id} onClick={() => mark(r._id, 'resolved')} className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-on-primary disabled:opacity-50">
                    {tr('সমাধান হয়েছে')}
                  </button>
                ) : (
                  <>
                    <span className="text-xs text-ink-muted">{r.resolvedBy}</span>
                    <button type="button" disabled={busy === r._id} onClick={() => mark(r._id, 'open')} className="rounded-lg border border-border-strong px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                      {tr('আবার খুলুন')}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
