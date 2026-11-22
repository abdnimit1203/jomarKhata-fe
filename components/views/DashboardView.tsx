'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  Eye,
  EyeOff,
  Package,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Users,
  Wallet,
} from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import {
  buildUnifiedLedger,
  computePeriodFlows,
  getPeriodBounds,
} from '@/services/financeCalculator';
import {
  formatBanglaNumber,
  formatBanglaTime,
  formatTaka,
  getRelativeDateGroupLabel,
} from '@/lib/format';

export function DashboardView() {
  const { data, currentBalances, navigate, openSheet } = useJomarkhata();
  const [hideBalance, setHideBalance] = useState(false);
  const [period, setPeriod] = useState<'today' | 'month'>('today');

  const periodFlows = useMemo(() => {
    if (!data) return null;
    const range = getPeriodBounds(period);
    return computePeriodFlows(
      range,
      data.sales,
      data.purchases,
      data.moneyMovements,
      data.expenses,
      data.dueTransactions
    );
  }, [data, period]);

  const recentLedger = useMemo(() => {
    if (!data) return [];
    return buildUnifiedLedger(
      data.sales,
      data.purchases,
      data.dueTransactions,
      data.expenses,
      data.parties
    )
      .filter((item) => item.status === 'active')
      .slice(0, 6);
  }, [data]);

  if (!data || !periodFlows) return null;

  const mask = (text: string) => (hideBalance ? '•••••• ৳' : text);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-6">
      {/* Top Grid: Hero Balance Card + Period Summary (2 cols on desktop, stacked on mobile) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        {/* Emerald Hero Balance Card — STRICTLY Cumulative All-Time Balances */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary-hover to-primary-deep p-5 text-on-primary shadow-hero lg:col-span-7 lg:p-6">
          {/* Subtle decorative radial light */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          />

          <div className="relative z-10 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-on-primary/80">
                হাতে ক্যাশ · বর্তমান ব্যালেন্স (সব সময়ের)
              </p>
              <div className="mt-1.5 flex items-center gap-2.5">
                <h1 className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">
                  {mask(formatTaka(currentBalances.cashInHand))}
                </h1>
                <button
                  type="button"
                  onClick={() => setHideBalance((v) => !v)}
                  aria-label={hideBalance ? 'ব্যালেন্স দেখান' : 'ব্যালেন্স লুকান'}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/30 text-on-primary transition-colors hover:bg-white/45 active:scale-95"
                >
                  {hideBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1 text-xs text-on-primary/80 tabular-nums">
                মোট ক্যাশ ও ডিজিটাল ব্যালেন্স: {mask(formatTaka(currentBalances.totalLiquidBalance))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('cash')}
              className="rounded-xl bg-white/30 px-3 py-2 text-xs font-semibold text-on-primary whitespace-nowrap transition-colors hover:bg-white/45"
            >
              ক্যাশ বক্স →
            </button>
          </div>

          {/* All-Time Channel & Due Position Strip */}
          <div className="relative z-10 mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-xs sm:grid-cols-5">
            <div>
              <p className="text-on-primary/80">বিকাশ</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {mask(formatTaka(currentBalances.channelBalances.bkash))}
              </p>
            </div>
            <div>
              <p className="text-on-primary/80">নগদ</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {mask(formatTaka(currentBalances.channelBalances.nagad))}
              </p>
            </div>
            <div>
              <p className="text-on-primary/80">ব্যাংক</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {mask(formatTaka(currentBalances.channelBalances.bank))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('dues')}
              className="text-left transition-opacity hover:opacity-85"
            >
              <p className="text-on-primary/80">মোট পাবো</p>
              <p className="mt-0.5 font-semibold text-on-primary tabular-nums">
                {mask(formatTaka(currentBalances.totalReceivables))}
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate('dues')}
              className="text-left transition-opacity hover:opacity-85"
            >
              <p className="text-on-primary/80">মোট দিবো</p>
              <p className="mt-0.5 font-semibold text-on-primary tabular-nums">
                {mask(formatTaka(currentBalances.totalPayables))}
              </p>
            </button>
          </div>
        </section>

        {/* Period Flow Summary Card — STRICTLY Period-Scoped (আজ | এই মাস) */}
        <section className="flex flex-col justify-between rounded-3xl bg-white p-5 shadow-card lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {period === 'today' ? 'আজকের হিসাব' : 'এই মাসের হিসাব'}
              </h2>
              <p className="text-xs text-ink-muted">নির্বাচিত সময়ের আয়, আদায় ও খরচ</p>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-surface-muted p-1">
              <button
                type="button"
                onClick={() => setPeriod('today')}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  period === 'today' ? 'bg-primary text-on-primary shadow-xs' : 'text-ink-muted'
                }`}
              >
                দিন
              </button>
              <button
                type="button"
                onClick={() => setPeriod('month')}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  period === 'month' ? 'bg-primary text-on-primary shadow-xs' : 'text-ink-muted'
                }`}
              >
                মাস
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-canvas p-3">
              <p className="text-xs text-ink-muted">মোট বিক্রি</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink">
                {formatTaka(periodFlows.salesRevenue)}
              </p>
              <p className="text-xs text-ink-subtle tabular-nums">
                {formatBanglaNumber(periodFlows.salesCount)}টি বিক্রি
              </p>
            </div>

            <div className="rounded-2xl bg-secondary p-3">
              <p className="text-xs text-primary-ink">মোট টাকা আদায়</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-primary-ink">
                {formatTaka(periodFlows.totalCollected)}
              </p>
              <p className="text-xs text-primary-ink">বিক্রি + বাকি আদায়</p>
            </div>

            <div className="rounded-2xl bg-danger-soft p-3">
              <p className="text-xs text-danger">মোট খরচ</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-danger">
                {formatTaka(periodFlows.expensesTotal)}
              </p>
              <p className="text-xs text-danger">দোকানের ব্যয়</p>
            </div>

            <div className="rounded-2xl bg-canvas p-3">
              <p className="text-xs text-ink-muted">নতুন বাকি দিয়েছি</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-ink">
                {formatTaka(periodFlows.newReceivablesAdded)}
              </p>
              <p className="text-xs text-ink-subtle">কাস্টমার বাকি</p>
            </div>
          </div>
        </section>
      </div>

      {/* Primary 2-Tap Counter Buttons (বেচা & কেনা) */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => openSheet({ type: 'sale' })}
          className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-2xl bg-primary px-4 py-3.5 text-on-primary shadow-sm transition-all hover:bg-primary-hover active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/30">
            <ShoppingBag className="h-5 w-5" />
          </span>
          <div className="text-left">
            <p className="text-base font-bold leading-tight">বেচা</p>
            <p className="text-xs text-on-primary/80">দ্রুত বা পণ্য বিক্রি</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => openSheet({ type: 'purchase' })}
          className="flex min-h-[60px] items-center justify-center gap-2.5 rounded-2xl border border-border-strong bg-white px-4 py-3.5 text-ink shadow-card transition-all hover:border-primary-ink/50 active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary-ink">
            <ShoppingCart className="h-5 w-5" />
          </span>
          <div className="text-left">
            <p className="text-base font-bold leading-tight">কেনা</p>
            <p className="text-xs text-ink-muted">মালামাল ক্রয়</p>
          </div>
        </button>
      </div>

      {/* 4-Tile Quick Actions (Reference Image 1 Mint Squircle Row) */}
      <section className="grid grid-cols-4 gap-2.5 sm:gap-4">
        {[
          {
            label: 'বাকি আদায়',
            icon: ArrowDownLeft,
            onClick: () => openSheet({ type: 'due', defaultEntryType: 'customer_collection' }),
          },
          {
            label: 'সহজ খরচ',
            icon: Receipt,
            onClick: () => openSheet({ type: 'expense' }),
          },
          {
            label: 'পরিশোধ',
            icon: ArrowUpRight,
            onClick: () => openSheet({ type: 'due', defaultEntryType: 'supplier_payment' }),
          },
          {
            label: 'স্টক',
            icon: Package,
            onClick: () => navigate('stock'),
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="flex flex-col items-center gap-2 rounded-2xl bg-white py-3.5 px-2 shadow-card transition-transform active:scale-[0.97]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary-ink">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold text-ink whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </section>

      {/* Main Content Split: Books & Tools + Recent Transactions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left: খাতা সমূহ + আপনার ব্যবসার জন্য */}
        <div className="space-y-4 lg:col-span-5">
          <section className="rounded-3xl bg-white p-4 shadow-card">
            <h2 className="mb-3 px-1 text-sm font-semibold text-ink">খাতা সমূহ</h2>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'বেচার খাতা', icon: ShoppingBag, route: 'sales' as const },
                { label: 'কেনার খাতা', icon: ShoppingCart, route: 'purchases' as const },
                { label: 'বাকির খাতা', icon: BookOpen, route: 'dues' as const },
                { label: 'খরচের খাতা', icon: Wallet, route: 'cash' as const },
              ].map((b) => {
                const Icon = b.icon;
                return (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => navigate(b.route)}
                    className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-canvas p-2 text-center transition-colors hover:bg-secondary active:scale-[0.97]"
                  >
                    <Icon className="h-5 w-5 text-primary-ink" />
                    <span className="text-xs font-semibold text-ink leading-tight">
                      {b.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl bg-white p-4 shadow-card">
            <h2 className="mb-3 px-1 text-sm font-semibold text-ink">আপনার ব্যবসার জন্য</h2>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'পার্টি তালিকা', icon: Users, route: 'dues' as const },
                {
                  label: `স্টক (${formatBanglaNumber(currentBalances.totalStockQty)})`,
                  icon: Package,
                  route: 'stock' as const,
                },
                { label: 'রিপোর্ট', icon: BarChart3, route: 'reports' as const },
                { label: 'সেটিংস', icon: Settings, route: 'settings' as const },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => navigate(t.route)}
                    className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-canvas p-2 text-center transition-colors hover:bg-secondary active:scale-[0.97]"
                  >
                    <Icon className="h-5 w-5 text-primary-ink" />
                    <span className="text-xs font-semibold text-ink leading-tight">
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right: সাম্প্রতিক লেনদেন (Reference Image 1 Clean List Style) */}
        <section className="rounded-3xl bg-white p-4 shadow-card lg:col-span-7 lg:p-5">
          <div className="mb-3 flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-ink">সাম্প্রতিক লেনদেন</h2>
            <button
              type="button"
              onClick={() => navigate('ledger')}
              className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary-ink hover:underline"
            >
              <span>সব দেখুন</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {recentLedger.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">
              এখনও কোনো লেনদেন যোগ করা হয়নি। উপরের &quot;বেচা&quot; বা &quot;সহজ খরচ&quot; বাটনে ট্যাপ করুন।
            </p>
          ) : (
            <div className="divide-y divide-border">
              {recentLedger.map((item) => {
                const isPositive =
                  item.sourceType === 'sale' || item.sourceType === 'customer_collection';
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
                    className="flex min-h-[64px] w-full items-center gap-3 py-3 px-1 text-left transition-colors hover:bg-canvas active:bg-surface-muted"
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
                      <p className="truncate text-xs text-ink-muted">
                        {item.subtitle} · {getRelativeDateGroupLabel(item.date)},{' '}
                        {formatBanglaTime(item.date)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className={`text-sm font-bold tabular-nums ${
                          isPositive ? 'text-primary-ink' : 'text-ink'
                        }`}
                      >
                        {isPositive ? '+' : '-'} {formatTaka(item.amount)}
                      </p>
                      <p className="text-xs text-ink-muted">{item.badgeText}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
