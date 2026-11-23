'use client';

import React, { useMemo, useState } from 'react';
import { Banknote, Building2, Plus, Receipt, Smartphone, Wallet } from 'lucide-react';
import { ShowMore, usePaged } from '@/components/ui/ShowMore';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { computePeriodFlows, getPeriodBounds, isWithinRange } from '@/services/financeCalculator';
import {
  EXPENSE_CATEGORIES,
  formatBanglaDateTime,
  formatTaka,
  getChannelShortLabel,
} from '@/lib/format';
import type { PeriodPreset } from '@/types/domain';
import { SimpleSelect } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/segmented';

export function CashExpenseView() {
  const { data, currentBalances, openSheet } = useJomarkhata();
  const [period, setPeriod] = useState<PeriodPreset>('month');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showVoided, setShowVoided] = useState(false);

  const todayFlows = useMemo(() => {
    if (!data) return null;
    return computePeriodFlows(
      getPeriodBounds('today'),
      data.sales,
      data.purchases,
      data.moneyMovements,
      data.expenses,
      data.dueTransactions
    );
  }, [data]);

  const filteredExpenses = useMemo(() => {
    if (!data) return [];
    const range = getPeriodBounds(period);
    return data.expenses.filter((e) => {
      if (!isWithinRange(e.date, range)) return false;
      if (!showVoided && e.status !== 'active') return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
      return true;
    });
  }, [data, period, categoryFilter, showVoided]);
  const page = usePaged(filteredExpenses, JSON.stringify(filteredExpenses.length));

  const periodExpenseTotal = useMemo(
    () => filteredExpenses.filter((e) => e.status === 'active').reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  );

  if (!data || !todayFlows) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">দৈনিক ক্যাশ ও খরচের হিসাব</h1>
          <p className="text-xs text-ink-muted">
            বর্তমান মাধ্যমভিত্তিক ব্যালেন্স এবং দৈনিক দোকান খরচের হিসাব
          </p>
        </div>
        <button
          type="button"
          onClick={() => openSheet({ type: 'expense' })}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-primary-gradient px-4 text-sm font-semibold text-on-primary shadow-sm hover:brightness-[0.97]"
        >
          <Plus className="h-4 w-4" />
          <span>সহজ খরচ</span>
        </button>
      </div>

      {/* All-Time Cumulative Channel Balances (Separate from Period Flows!) */}
      <section className="rounded-3xl bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              বর্তমান ব্যালেন্স (সব সময়ের মোট স্থিতি)
            </h2>
            <p className="text-xs text-ink-muted">
              শুরুর ব্যালেন্স + সব সক্রিয় আদায় − সব সক্রিয় পরিশোধ ও খরচ
            </p>
          </div>
          <span className="text-sm font-bold tabular-nums text-primary-ink">
            মোট {formatTaka(currentBalances.totalLiquidBalance)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'হাতে ক্যাশ',
              amount: currentBalances.channelBalances.cash,
              icon: Banknote,
              highlight: true,
            },
            {
              label: 'বিকাশ',
              amount: currentBalances.channelBalances.bkash,
              icon: Smartphone,
              highlight: false,
            },
            {
              label: 'নগদ',
              amount: currentBalances.channelBalances.nagad,
              icon: Wallet,
              highlight: false,
            },
            {
              label: 'ব্যাংক',
              amount: currentBalances.channelBalances.bank,
              icon: Building2,
              highlight: false,
            },
          ].map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.label}
                className={`rounded-2xl p-3.5 ${
                  c.highlight ? 'bg-primary text-on-primary' : 'bg-canvas text-ink'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={`h-4 w-4 ${c.highlight ? 'text-on-primary' : 'text-primary-ink'}`}
                  />
                  <span className={`text-xs font-medium ${c.highlight ? 'text-on-primary' : 'text-ink-muted'}`}>
                    {c.label}
                  </span>
                </div>
                <p className="mt-1.5 text-lg font-bold tabular-nums">{formatTaka(c.amount)}</p>
              </div>
            );
          })}
        </div>

        {/* Today's Cash Flow Strip (Strictly Today!) */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-3.5 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2.5">
            <span className="text-primary-ink">আজ ক্যাশ এসেছে</span>
            <span className="font-bold tabular-nums text-primary-ink">
              + {formatTaka(todayFlows.cashInflow)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-danger-soft px-3 py-2.5">
            <span className="text-danger">আজ ক্যাশ গেছে</span>
            <span className="font-bold tabular-nums text-danger">
              - {formatTaka(todayFlows.cashOutflow)}
            </span>
          </div>
        </div>
      </section>

      {/* Expense List Header & Filters */}
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

        <div className="flex items-center gap-2">
          <SimpleSelect
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            aria-label="খরচের খাত"
            size="sm"
            className="w-auto min-w-36"
            options={[{ value: 'all', label: 'সব খাত' }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))]}
          />
          <button
            type="button"
            onClick={() => setShowVoided((v) => !v)}
            className={`h-10 rounded-xl border px-3 text-xs font-semibold ${
              showVoided
                ? 'border-danger bg-danger-soft text-danger'
                : 'border-border-strong bg-white text-ink-muted'
            }`}
          >
            বাতিলকৃত
          </button>
        </div>
      </div>

      {/* Period Expense Total Bar */}
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-card">
        <span className="text-xs font-semibold text-ink-muted">নির্বাচিত সময়ে মোট খরচ</span>
        <span className="text-base font-bold tabular-nums text-danger">
          {formatTaka(periodExpenseTotal)}
        </span>
      </div>

      {/* Expenses Feed */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-6 w-6" />}
          title="এই সময়ে কোনো খরচ নেই"
          description="শুধু টাকার পরিমাণ লিখেই দোকানের যেকোনো খরচ সংরক্ষণ করুন।"
          actionLabel="+ সহজ খরচ যোগ করুন"
          onAction={() => openSheet({ type: 'expense' })}
        />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-3xl bg-white shadow-card">
          {page.visible.map((exp) => {
            const isVoided = exp.status === 'voided';
            return (
              <button
                key={exp.id}
                type="button"
                onClick={() =>
                  openSheet({ type: 'transaction_detail', sourceType: 'expense', sourceId: exp.id })
                }
                className={`flex min-h-[68px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-canvas ${
                  isVoided ? 'opacity-55' : ''
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger-soft text-danger">
                  <Receipt className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{exp.title}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {exp.category} · {getChannelShortLabel(exp.paymentMethod)} ·{' '}
                    {formatBanglaDateTime(exp.date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      isVoided ? 'line-through text-ink-subtle' : 'text-danger'
                    }`}
                  >
                    - {formatTaka(exp.amount)}
                  </p>
                  {isVoided && <p className="text-xs font-semibold text-danger">বাতিলকৃত</p>}
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
