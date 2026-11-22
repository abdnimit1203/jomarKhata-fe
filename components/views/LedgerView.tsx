'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BookText, Receipt, Search } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { buildUnifiedLedger } from '@/services/financeCalculator';
import {
  formatBanglaTime,
  formatTaka,
  getRelativeDateGroupLabel,
  PAYMENT_CHANNELS,
} from '@/lib/format';
import type { PaymentChannel, UnifiedLedgerItem } from '@/types/domain';

type LedgerFilter = 'all' | 'sale' | 'settlement' | 'purchase' | 'expense';

export function LedgerView() {
  const { data, openSheet } = useJomarkhata();
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | PaymentChannel>('all');
  const [showVoided, setShowVoided] = useState(false);
  const [search, setSearch] = useState('');

  const grouped = useMemo(() => {
    if (!data) return [];
    const all = buildUnifiedLedger(
      data.sales,
      data.purchases,
      data.dueTransactions,
      data.expenses,
      data.parties
    );

    const q = search.trim().toLowerCase();
    const filtered = all.filter((item) => {
      if (!showVoided && item.status !== 'active') return false;
      if (filter === 'sale' && item.sourceType !== 'sale') return false;
      if (filter === 'purchase' && item.sourceType !== 'purchase') return false;
      if (filter === 'expense' && item.sourceType !== 'expense') return false;
      if (
        filter === 'settlement' &&
        item.sourceType !== 'customer_collection' &&
        item.sourceType !== 'supplier_payment' &&
        item.sourceType !== 'manual_due'
      ) {
        return false;
      }
      if (channelFilter !== 'all' && item.paymentMethod !== channelFilter) return false;
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.subtitle.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    const groups: Array<{ label: string; items: UnifiedLedgerItem[] }> = [];
    const map = new Map<string, UnifiedLedgerItem[]>();

    for (const item of filtered) {
      const label = getRelativeDateGroupLabel(item.date);
      if (!map.has(label)) {
        const arr: UnifiedLedgerItem[] = [];
        map.set(label, arr);
        groups.push({ label, items: arr });
      }
      map.get(label)!.push(item);
    }

    return groups;
  }, [data, filter, channelFilter, showVoided, search]);

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <div>
        <h1 className="text-xl font-bold text-ink">সব লেনদেন (লেজার)</h1>
        <p className="text-xs text-ink-muted">
          যেকোনো লেনদেনে ট্যাপ করে সংশোধন, বাতিল (Void) বা অডিট ইতিহাস দেখুন
        </p>
      </div>

      {/* Reference Image 1 Segmented Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(
          [
            { id: 'all', label: 'সব' },
            { id: 'sale', label: 'বিক্রি' },
            { id: 'settlement', label: 'আদায় / পরিশোধ' },
            { id: 'purchase', label: 'কেনা' },
            { id: 'expense', label: 'খরচ' },
          ] as Array<{ id: LedgerFilter; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`min-h-[40px] rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === tab.id
                ? 'bg-primary text-white shadow-xs'
                : 'bg-white text-ink-muted shadow-card hover:bg-surface-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Channel + Voided Toggle */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="লেনদেন বা নাম খুঁজুন..."
            className="h-11 w-full rounded-2xl border border-border-strong bg-white pr-4 pl-11 text-sm text-ink shadow-card focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as 'all' | PaymentChannel)}
            aria-label="পেমেন্ট মাধ্যম"
            className="h-11 rounded-2xl border border-border-strong bg-white px-3 text-xs font-semibold text-ink-muted shadow-card focus:border-primary focus:outline-none"
          >
            <option value="all">সব মাধ্যম</option>
            {PAYMENT_CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowVoided((v) => !v)}
            className={`h-11 rounded-2xl border px-3.5 text-xs font-semibold whitespace-nowrap shadow-card ${
              showVoided
                ? 'border-danger bg-danger-soft text-danger'
                : 'border-border-strong bg-white text-ink-muted'
            }`}
          >
            বাতিলকৃত
          </button>
        </div>
      </div>

      {/* Date-Grouped Transaction List */}
      {grouped.length === 0 ? (
        <EmptyState
          icon={<BookText className="h-6 w-6" />}
          title="কোনো লেনদেন পাওয়া যায়নি"
          description="ফিল্টার পরিবর্তন করুন অথবা নতুন বিক্রি/খরচ যোগ করুন।"
        />
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => (
            <section key={group.label} className="space-y-2">
              <h2 className="px-1 text-xs font-semibold text-ink-muted">{group.label}</h2>
              <div className="divide-y divide-border overflow-hidden rounded-3xl bg-white shadow-card">
                {group.items.map((item) => {
                  const isPositive =
                    item.sourceType === 'sale' || item.sourceType === 'customer_collection';
                  const isVoided = item.status === 'voided';
                  const detailSourceType =
                    item.sourceType === 'sale'
                      ? 'sale'
                      : item.sourceType === 'purchase'
                        ? 'purchase'
                        : item.sourceType === 'expense'
                          ? 'expense'
                          : 'due_transaction';

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        openSheet({
                          type: 'transaction_detail',
                          sourceType: detailSourceType,
                          sourceId: item.sourceId,
                        })
                      }
                      className={`flex min-h-[68px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-canvas ${
                        isVoided ? 'opacity-55' : ''
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          isPositive
                            ? 'bg-secondary text-primary'
                            : item.sourceType === 'expense'
                              ? 'bg-danger-soft text-danger'
                              : 'bg-warning-soft text-accent-ink'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowDownLeft className="h-5 w-5" />
                        ) : item.sourceType === 'expense' ? (
                          <Receipt className="h-5 w-5" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5" />
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {item.subtitle} · {formatBanglaTime(item.date)}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            isVoided
                              ? 'line-through text-ink-subtle'
                              : isPositive
                                ? 'text-primary'
                                : 'text-ink'
                          }`}
                        >
                          {isPositive ? '+' : '-'} {formatTaka(item.amount)}
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {isVoided ? 'বাতিলকৃত' : item.badgeText}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
