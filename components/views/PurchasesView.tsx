'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import { ShowMore, usePaged } from '@/components/ui/ShowMore';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { getPeriodBounds, isWithinRange } from '@/services/financeCalculator';
import {
  formatBanglaDateTime,
  formatBanglaNumber,
  formatTaka,
  getChannelShortLabel,
} from '@/lib/format';
import type { PeriodPreset } from '@/types/domain';
import { SegmentedControl } from '@/components/ui/segmented';

export function PurchasesView() {
  const { data, openSheet } = useJomarkhata();
  const [period, setPeriod] = useState<PeriodPreset>('month');
  const [showVoided, setShowVoided] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPurchases = useMemo(() => {
    if (!data) return [];
    const range = getPeriodBounds(period);
    const q = search.trim().toLowerCase();
    return data.purchases.filter((p) => {
      if (!isWithinRange(p.date, range)) return false;
      if (!showVoided && p.status !== 'active') return false;
      if (
        q &&
        !p.partyName.toLowerCase().includes(q) &&
        !p.billNo.toLowerCase().includes(q) &&
        !(p.description?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [data, period, showVoided, search]);
  const page = usePaged(filteredPurchases, JSON.stringify(filteredPurchases.length));

  const summary = useMemo(() => {
    let total = 0;
    let paid = 0;
    let due = 0;
    for (const p of filteredPurchases) {
      if (p.status !== 'active') continue;
      total += p.total;
      paid += p.paidAmount;
      due += p.dueAmount;
    }
    return { total, paid, due };
  }, [filteredPurchases]);

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">কেনার খাতা (ক্রয়)</h1>
          <p className="text-xs text-ink-muted">পাইকারি ক্রয় ও সাপ্লায়ার বিলের হিসাব</p>
        </div>
        <button
          type="button"
          onClick={() => openSheet({ type: 'purchase' })}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-primary-gradient px-4 text-sm font-semibold text-on-primary shadow-sm hover:brightness-[0.97]"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন ক্রয়</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-ink-muted">মোট কেনা</p>
          <p className="mt-1 text-base font-bold tabular-nums text-ink sm:text-lg">
            {formatTaka(summary.total)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-ink-muted">পরিশোধিত</p>
          <p className="mt-1 text-base font-bold tabular-nums text-primary-ink sm:text-lg">
            {formatTaka(summary.paid)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-ink-muted">সাপ্লায়ার বাকি</p>
          <p className="mt-1 text-base font-bold tabular-nums text-warning-ink sm:text-lg">
            {formatTaka(summary.due)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <SegmentedControl
          aria-label="সময়কাল"
          variant="track"
          value={period}
          onValueChange={(v) => setPeriod(v as PeriodPreset)}
          options={[
            { value: 'today', label: 'আজ' },
            { value: 'week', label: 'সপ্তাহ' },
            { value: 'month', label: 'মাস' },
            { value: 'all', label: 'সব' },
          ]}
        />

        <button
          type="button"
          onClick={() => setShowVoided((v) => !v)}
          className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold ${
            showVoided
              ? 'border-primary-ink bg-secondary text-primary-ink'
              : 'border-border-strong bg-white text-ink-muted'
          }`}
        >
          বাতিলকৃত দেখান
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="সাপ্লায়ার বা বিল নম্বর খুঁজুন"
          className="h-12 w-full rounded-2xl border border-border-strong bg-white pr-4 pl-11 text-sm text-ink shadow-card focus:border-primary-ink focus:outline-none"
        />
      </div>

      {filteredPurchases.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title="কোনো ক্রয়ের হিসাব নেই"
          description="সাপ্লায়ার থেকে মালামাল কেনার হিসাব এখানে সংরক্ষণ করুন।"
          actionLabel="+ নতুন ক্রয় যোগ করুন"
          onAction={() => openSheet({ type: 'purchase' })}
        />
      ) : (
        <div className="space-y-2.5">
          {page.visible.map((p) => {
            const isVoided = p.status === 'voided';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  openSheet({ type: 'transaction_detail', sourceType: 'purchase', sourceId: p.id })
                }
                className={`flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-card transition-colors hover:bg-canvas ${
                  isVoided ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{p.partyName}</p>
                    <span className="text-xs text-ink-muted">· {p.billNo}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {p.mode === 'quick' ? 'সহজ ক্রয়' : `${formatBanglaNumber(p.items.length)}টি পণ্য`}
                    {p.description ? ` · ${p.description}` : ''} · {formatBanglaDateTime(p.date)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      isVoided ? 'line-through text-ink-subtle' : 'text-ink'
                    }`}
                  >
                    {formatTaka(p.total)}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums">
                    {isVoided ? (
                      <span className="font-semibold text-danger">বাতিলকৃত</span>
                    ) : p.dueAmount > 0 ? (
                      <span className="font-semibold text-warning-ink">
                        দিবো {formatTaka(p.dueAmount)}
                      </span>
                    ) : (
                      <span className="font-medium text-primary-ink">
                        পরিশোধ ({getChannelShortLabel(p.paymentMethod)})
                      </span>
                    )}
                  </p>
                </div>
              </button>
            );
          })}
          <ShowMore remaining={page.remaining} onMore={page.more} />
        </div>
      )}
    </div>
  );
}
