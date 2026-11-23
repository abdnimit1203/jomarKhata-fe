'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Search, ShoppingBag } from 'lucide-react';
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

export function SalesView() {
  const { data, openSheet } = useJomarkhata();
  const [period, setPeriod] = useState<PeriodPreset>('month');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'due' | 'voided'>('all');
  const [search, setSearch] = useState('');

  const filteredSales = useMemo(() => {
    if (!data) return [];
    const range = getPeriodBounds(period);
    const q = search.trim().toLowerCase();
    return data.sales.filter((s) => {
      if (!isWithinRange(s.date, range)) return false;
      if (statusFilter === 'voided') {
        if (s.status !== 'voided') return false;
      } else {
        if (s.status !== 'active') return false;
        if (statusFilter === 'paid' && s.dueAmount > 0) return false;
        if (statusFilter === 'due' && s.dueAmount === 0) return false;
      }
      if (
        q &&
        !s.partyName.toLowerCase().includes(q) &&
        !s.invoiceNo.toLowerCase().includes(q) &&
        !(s.description?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [data, period, statusFilter, search]);
  const page = usePaged(filteredSales, JSON.stringify(filteredSales.length));

  const summary = useMemo(() => {
    let total = 0;
    let paid = 0;
    let due = 0;
    for (const s of filteredSales) {
      if (s.status !== 'active') continue;
      total += s.total;
      paid += s.paidAmount;
      due += s.dueAmount;
    }
    return { total, paid, due };
  }, [filteredSales]);

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">বিক্রির হিসাব (বিক্রি)</h1>
          <p className="text-xs text-ink-muted">সহজ বিক্রি ও পণ্য বিক্রির সম্পূর্ণ হিসাব</p>
        </div>
        <button
          type="button"
          onClick={() => openSheet({ type: 'sale' })}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-primary-gradient px-4 text-sm font-semibold text-on-primary shadow-sm hover:brightness-[0.97] active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন বিক্রি</span>
        </button>
      </div>

      {/* Period Summary Strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-ink-muted">মোট বিক্রি</p>
          <p className="mt-1 text-base font-bold tabular-nums text-ink sm:text-lg">
            {formatTaka(summary.total)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-ink-muted">বিক্রিতে আদায়</p>
          <p className="mt-1 text-base font-bold tabular-nums text-primary-ink sm:text-lg">
            {formatTaka(summary.paid)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-ink-muted">বাকি রয়েছে</p>
          <p className="mt-1 text-base font-bold tabular-nums text-danger sm:text-lg">
            {formatTaka(summary.due)}
          </p>
        </div>
      </div>

      {/* Period & Status Filters */}
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

        <SegmentedControl
          aria-label="অবস্থা"
          variant="chips"
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          options={[
            { value: 'all', label: 'সব সক্রিয়' },
            { value: 'paid', label: 'পুরো জমা' },
            { value: 'due', label: 'বাকি আছে' },
            { value: 'voided', label: 'বাতিলকৃত' },
          ]}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="কাস্টমার, ইনভয়েস বা বিবরণ খুঁজুন"
          className="h-12 w-full rounded-2xl border border-border-strong bg-white pr-4 pl-11 text-sm text-ink shadow-card focus:border-primary-ink focus:outline-none"
        />
      </div>

      {/* Sales List */}
      {filteredSales.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-6 w-6" />}
          title="কোনো বিক্রির হিসাব নেই"
          description="পণ্য যোগ না করেই সরাসরি টাকার পরিমাণ দিয়ে দ্রুত বিক্রি শুরু করুন।"
          actionLabel="+ নতুন বিক্রি যোগ করুন"
          onAction={() => openSheet({ type: 'sale' })}
        />
      ) : (
        <div className="space-y-2.5">
          {page.visible.map((sale) => {
            const isVoided = sale.status === 'voided';
            return (
              <button
                key={sale.id}
                type="button"
                onClick={() =>
                  openSheet({ type: 'transaction_detail', sourceType: 'sale', sourceId: sale.id })
                }
                className={`flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-card transition-colors hover:bg-canvas ${
                  isVoided ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-ink">
                      {sale.partyName}
                    </p>
                    <span className="text-xs text-ink-muted">· {sale.invoiceNo}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {sale.mode === 'quick' ? 'সহজ বিক্রি' : `${formatBanglaNumber(sale.items.length)}টি পণ্য`}
                    {sale.description ? ` · ${sale.description}` : ''} · {formatBanglaDateTime(sale.date)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      isVoided ? 'line-through text-ink-subtle' : 'text-ink'
                    }`}
                  >
                    {formatTaka(sale.total)}
                  </p>
                  <p className="mt-0.5 text-xs tabular-nums">
                    {isVoided ? (
                      <span className="font-semibold text-danger">বাতিলকৃত</span>
                    ) : sale.dueAmount > 0 ? (
                      <span className="font-semibold text-danger">
                        বাকি {formatTaka(sale.dueAmount)}
                      </span>
                    ) : (
                      <span className="font-medium text-primary-ink">
                        পরিশোধ ({getChannelShortLabel(sale.paymentMethod)})
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
