'use client';

import React, { useMemo, useState } from 'react';
import { Banknote, Building2, Plus, Receipt, Smartphone, Wallet } from 'lucide-react';
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

  const periodExpenseTotal = useMemo(
    () => filteredExpenses.filter((e) => e.status === 'active').reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  );

  if (!data || !todayFlows) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0F1F18]">দৈনিক ক্যাশ ও খরচের খাতা</h1>
          <p className="text-xs text-[#586B62]">
            বর্তমান মাধ্যমভিত্তিক ব্যালেন্স এবং দৈনিক দোকান খরচের হিসাব
          </p>
        </div>
        <button
          type="button"
          onClick={() => openSheet({ type: 'expense' })}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-[#0D7A56] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#096244]"
        >
          <Plus className="h-4 w-4" />
          <span>সহজ খরচ</span>
        </button>
      </div>

      {/* All-Time Cumulative Channel Balances (Separate from Period Flows!) */}
      <section className="rounded-3xl bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#0F1F18]">
              বর্তমান ব্যালেন্স (সব সময়ের মোট স্থিতি)
            </h2>
            <p className="text-xs text-[#586B62]">
              শুরুর ব্যালেন্স + সব সক্রিয় আদায় − সব সক্রিয় পরিশোধ ও খরচ
            </p>
          </div>
          <span className="text-sm font-bold tabular-nums text-[#0D7A56]">
            মোট {formatTaka(currentBalances.totalLiquidBalance)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              label: 'হাতে নগদ',
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
              label: 'নগদ (MFS)',
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
                  c.highlight ? 'bg-[#0D7A56] text-white' : 'bg-[#F5F9F7] text-[#0F1F18]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={`h-4 w-4 ${c.highlight ? 'text-[#C6ECDC]' : 'text-[#0D7A56]'}`}
                  />
                  <span className={`text-xs font-medium ${c.highlight ? 'text-[#D6F3E6]' : 'text-[#586B62]'}`}>
                    {c.label}
                  </span>
                </div>
                <p className="mt-1.5 text-lg font-bold tabular-nums">{formatTaka(c.amount)}</p>
              </div>
            );
          })}
        </div>

        {/* Today's Cash Flow Strip (Strictly Today!) */}
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#EFF4F1] pt-3.5 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-[#ECF7F2] px-3 py-2.5">
            <span className="text-[#2F6A53]">আজ নগদ এসেছে</span>
            <span className="font-bold tabular-nums text-[#0D7A56]">
              + {formatTaka(todayFlows.cashInflow)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[#FEF2F2] px-3 py-2.5">
            <span className="text-[#9E3535]">আজ নগদ গেছে</span>
            <span className="font-bold tabular-nums text-[#DC2626]">
              - {formatTaka(todayFlows.cashOutflow)}
            </span>
          </div>
        </div>
      </section>

      {/* Expense List Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 rounded-full bg-[#E9F0EC] p-1">
          {(
            [
              { id: 'today', label: 'আজ' },
              { id: 'week', label: 'সপ্তাহ' },
              { id: 'month', label: 'মাস' },
              { id: 'all', label: 'সব' },
            ] as Array<{ id: PeriodPreset; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPeriod(t.id)}
              className={`min-h-[38px] rounded-full px-3.5 text-xs font-semibold ${
                period === t.id ? 'bg-[#0D7A56] text-white' : 'text-[#486055]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="খরচের খাত"
            className="h-10 rounded-xl border border-[#DCE6E0] bg-white px-3 text-xs font-semibold text-[#354B41] focus:border-[#0D7A56] focus:outline-none"
          >
            <option value="all">সব খাত</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowVoided((v) => !v)}
            className={`h-10 rounded-xl border px-3 text-xs font-semibold ${
              showVoided
                ? 'border-[#DC2626] bg-[#FEF2F2] text-[#DC2626]'
                : 'border-[#DCE6E0] bg-white text-[#486055]'
            }`}
          >
            বাতিলকৃত
          </button>
        </div>
      </div>

      {/* Period Expense Total Bar */}
      <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-card">
        <span className="text-xs font-semibold text-[#586B62]">নির্বাচিত সময়ে মোট খরচ</span>
        <span className="text-base font-bold tabular-nums text-[#DC2626]">
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
        <div className="divide-y divide-[#EEF3F0] overflow-hidden rounded-3xl bg-white shadow-card">
          {filteredExpenses.map((exp) => {
            const isVoided = exp.status === 'voided';
            return (
              <button
                key={exp.id}
                type="button"
                onClick={() =>
                  openSheet({ type: 'transaction_detail', sourceType: 'expense', sourceId: exp.id })
                }
                className={`flex min-h-[68px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors hover:bg-[#F7FAF8] ${
                  isVoided ? 'opacity-55' : ''
                }`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                  <Receipt className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#0F1F18]">{exp.title}</p>
                  <p className="mt-0.5 truncate text-xs text-[#586B62]">
                    {exp.category} · {getChannelShortLabel(exp.paymentMethod)} ·{' '}
                    {formatBanglaDateTime(exp.date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      isVoided ? 'line-through text-[#6A7F75]' : 'text-[#DC2626]'
                    }`}
                  >
                    - {formatTaka(exp.amount)}
                  </p>
                  {isVoided && <p className="text-[11px] font-semibold text-[#DC2626]">বাতিলকৃত</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
