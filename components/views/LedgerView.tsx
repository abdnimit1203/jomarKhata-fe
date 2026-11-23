'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, BookText, Receipt, Search } from 'lucide-react';
import { ShowMore, usePaged } from '@/components/ui/ShowMore';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { buildUnifiedLedger, isWithinRange } from '@/services/financeCalculator';
import { PeriodFilter, usePeriodFilter } from '@/components/ui/PeriodFilter';
import {
  formatBanglaTime,
  formatTaka,
  getRelativeDateGroupLabel,
  PAYMENT_CHANNELS,
} from '@/lib/format';
import type { PaymentChannel, UnifiedLedgerItem } from '@/types/domain';
import { SimpleSelect } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/segmented';

type LedgerFilter = 'all' | 'sale' | 'settlement' | 'purchase' | 'expense';

export function LedgerView() {
  const { data, openSheet } = useJomarkhata();
  // phone under the party name in rows (owner request)
  const phoneOf = useMemo(() => new Map((data?.parties ?? []).map((p) => [p.id, p.phone])), [data?.parties]);
  const [filter, setFilter] = useState<LedgerFilter>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | PaymentChannel>('all');
  const [showVoided, setShowVoided] = useState(false);
  const [search, setSearch] = useState('');
  const saleDates = useMemo(() => (data?.sales ?? []).map((s) => s.date), [data?.sales]);
  const pf = usePeriodFilter(saleDates, 'all'); // default: everything, as before

  const filtered = useMemo(() => {
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
      if (!isWithinRange(item.date, pf.range)) return false;
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
    return filtered;
  }, [data, filter, channelFilter, showVoided, search, pf.range]);

  // S13: page the flat list (100 at a time), then group only what is shown.
  const page = usePaged(filtered, `${filter}|${channelFilter}|${showVoided}|${search}|${pf.period}|${pf.picked.year}-${pf.picked.month}`);
  const grouped = useMemo(() => {
    const groups: Array<{ label: string; items: UnifiedLedgerItem[] }> = [];
    const map = new Map<string, UnifiedLedgerItem[]>();

    for (const item of page.visible) {
      const label = getRelativeDateGroupLabel(item.date);
      if (!map.has(label)) {
        const arr: UnifiedLedgerItem[] = [];
        map.set(label, arr);
        groups.push({ label, items: arr });
      }
      map.get(label)!.push(item);
    }

    return groups;
  }, [page.visible]);

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <div>
        <h1 className="text-xl font-bold text-ink">সব লেনদেন (লেজার)</h1>
        <p className="text-xs text-ink-muted">
          যেকোনো লেনদেনে ট্যাপ করে সংশোধন, বাতিল বা পরিবর্তনের ইতিহাস দেখুন
        </p>
      </div>

      <PeriodFilter state={pf} />

      {/* Reference Image 1 Segmented Filter Tabs */}
      <SegmentedControl
        aria-label="লেনদেনের ধরন"
        variant="chips"
        value={filter}
        onValueChange={(v) => setFilter(v as LedgerFilter)}
        options={[
          { value: 'all', label: 'সব' },
          { value: 'sale', label: 'বিক্রি' },
          { value: 'settlement', label: 'আদায় / পরিশোধ' },
          { value: 'purchase', label: 'কেনা' },
          { value: 'expense', label: 'খরচ' },
        ]}
      />

      {/* Search + Channel + Voided Toggle */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="লেনদেন বা নাম খুঁজুন..."
            className="h-11 w-full rounded-2xl border border-border-strong bg-white pr-4 pl-11 text-sm text-ink shadow-card focus:border-primary-ink focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <SimpleSelect
            value={channelFilter}
            onValueChange={(v) => setChannelFilter(v as 'all' | PaymentChannel)}
            aria-label="পেমেন্ট মাধ্যম"
            size="sm"
            className="w-auto min-w-36"
            options={[{ value: 'all', label: 'সব মাধ্যম' }, ...PAYMENT_CHANNELS.map((c) => ({ value: c.id, label: c.label }))]}
          />
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
                            ? 'bg-secondary text-primary-ink'
                            : item.sourceType === 'expense'
                              ? 'bg-danger-soft text-danger'
                              : 'bg-warning-soft text-warning-ink'
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
                        {item.partyId && phoneOf.get(item.partyId) && (
                          <p className="truncate text-xs tabular-nums text-ink-muted">{phoneOf.get(item.partyId)}</p>
                        )}
                        <p className="mt-0.5 truncate text-xs text-ink-muted">{item.subtitle}</p>
                        <p className="text-xs leading-4 text-ink-subtle">{formatBanglaTime(item.date)}</p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            isVoided
                              ? 'line-through text-ink-subtle'
                              : isPositive
                                ? 'text-primary-ink'
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
          <ShowMore remaining={page.remaining} onMore={page.more} />
        </div>
      )}
    </div>
  );
}
