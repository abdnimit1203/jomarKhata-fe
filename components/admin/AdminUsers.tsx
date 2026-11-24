'use client';

/** /admin/users: search (ID, email, phone, shop, referral code) + filter + pages, as a table. */
import { useSearchParams } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useFmtDate, useNum, useTr } from './i18n';
import { SegmentedControl } from '@/components/ui/segmented';
import { formatBanglaNumber } from '@/lib/format';
import { adminFetch } from './adminApi';
import { type AdminUserRow, UsersTable } from './AdminDashboard';

type Filter = 'all' | 'trial' | 'paid' | 'expired' | 'blocked';

export function AdminUsers() {
  const tr = useTr();
  const fd = useFmtDate();
  const num = useNum();
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>((params?.get('filter') as Filter) || 'all');
  const [page, setPage] = useState(1);
  const [res, setRes] = useState<{ total: number; pageSize: number; users: AdminUserRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ q: query, filter, page: String(page) });
    adminFetch<{ total: number; pageSize: number; users: AdminUserRow[] }>(`/admin/users?${qs}`)
      .then((r) => {
        if (!alive) return;
        setRes(r);
        setErr(null);
      })
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : 'লোড করা যায়নি।'));
    return () => {
      alive = false;
    };
  }, [query, filter, page]);

  const pages = res ? Math.max(1, Math.ceil(res.total / res.pageSize)) : 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setQuery(q.trim());
          }}
          className="flex min-w-[260px] flex-1 gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr("আইডি, ইমেইল, ফোন, দোকান বা রেফারেল কোড")}
            aria-label={tr("ইউজার খুঁজুন")}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border-strong bg-white px-3.5 text-sm focus:border-primary-ink focus:outline-none"
          />
          <button type="submit" className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-on-primary">
            {tr("খুঁজুন")}
          </button>
        </form>
        <SegmentedControl
          aria-label={tr("কাদের দেখাবে")}
          variant="chips"
          value={filter}
          onValueChange={(v) => {
            setPage(1);
            setFilter(v as Filter);
          }}
          options={[
            { value: 'all', label: tr("সবাই") },
            { value: 'trial', label: tr("ট্রায়াল") },
            { value: 'paid', label: tr("পেইড") },
            { value: 'expired', label: tr("মেয়াদ শেষ") },
            { value: 'blocked', label: tr("বন্ধ") },
          ]}
        />
      </div>
      {err && <p className="text-danger">{err}</p>}
      {res && (
        <section className="overflow-hidden rounded-2xl bg-white shadow-card">
          <p className="border-b border-border px-4 py-2.5 text-xs font-semibold text-ink-muted">মোট {num(res.total)} জন</p>
          <UsersTable users={res.users} />
        </section>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-xl border border-border-strong bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-40">
            {tr("আগের")}
          </button>
          <span className="text-sm">
            {num(page)} / {num(pages)}
          </span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)} className="rounded-xl border border-border-strong bg-white px-3 py-1.5 text-sm font-bold disabled:opacity-40">
            {tr("পরের")}
          </button>
        </div>
      )}
    </div>
  );
}
