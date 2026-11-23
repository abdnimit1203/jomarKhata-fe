'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BACKUP_REMINDER_DAYS, needsBackupReminder } from '@/lib/backup-reminder';
import { backupFileName } from '@/components/settings/BackupSection';
import { downloadTextFile } from '@/lib/format';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { FeatureIcon, type FeatureTone } from '@/components/ui/FeatureIcon';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
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
import { SegmentedControl } from '@/components/ui/segmented';

export function DashboardView() {
  const { data, currentBalances, navigate, openSheet, mode, actions, showToast } = useJomarkhata();
  const [lastBackupAt, setLastBackupAt] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    void actions.getLastBackupAt().then(setLastBackupAt);
  }, [actions]);
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

  const channelLine = [
    ['বিকাশ', currentBalances.channelBalances.bkash],
    ['নগদ', currentBalances.channelBalances.nagad],
    ['ব্যাংক', currentBalances.channelBalances.bank],
  ] as const;

  return (
    <div className="mx-auto max-w-6xl pb-6 lg:grid lg:grid-cols-12 lg:gap-5">
      {/* LEFT (mobile: top-to-bottom order of S4 / plan 3.1) */}
      <div className="space-y-4 lg:col-span-7">
        {mode === 'real' &&
          lastBackupAt !== undefined &&
          needsBackupReminder(lastBackupAt, data.sales.length + data.purchases.length + data.expenses.length + data.dueTransactions.length) && (
            <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-ink">
              <span>
                {lastBackupAt
                  ? `${formatBanglaNumber(BACKUP_REMINDER_DAYS)} দিনের বেশি ব্যাকআপ নেওয়া হয়নি।`
                  : 'এখনও কোনো ব্যাকআপ নেই। ফোন হারালে হিসাব হারাবে।'}
              </span>
              <button
                type="button"
                onClick={async () => {
                  const json = await actions.exportBackupJson();
                  downloadTextFile(backupFileName(data.businessProfile.shopName), json, 'application/json');
                  setLastBackupAt(new Date().toISOString());
                  showToast('ব্যাকআপ ডাউনলোড হয়েছে। ফাইলটি নিরাপদ জায়গায় (Google Drive / WhatsApp-এ নিজের কাছে) রাখুন।');
                }}
                className="rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-warning-ink shadow-sm"
              >
                এখনই ব্যাকআপ নিন
              </button>
            </div>
          )}
        {/* 1. Compact hero: cash in hand + পাবো / দিবো (all-time balances) */}
        <section className="relative overflow-hidden rounded-3xl bg-primary-gradient p-4 text-on-primary shadow-hero lg:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-on-primary">হাতে ক্যাশ</p>
              <div className="mt-0.5 flex items-center gap-2">
                <h1 className="text-3xl font-bold tracking-tight tabular-nums">
                  {mask(formatTaka(currentBalances.cashInHand))}
                </h1>
                <button
                  type="button"
                  onClick={() => setHideBalance((v) => !v)}
                  aria-label={hideBalance ? 'ব্যালেন্স দেখান' : 'ব্যালেন্স লুকান'}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/30 text-on-primary transition-colors hover:bg-white/45 active:scale-95"
                >
                  {hideBalance ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-0.5 text-xs leading-snug text-on-primary tabular-nums">
                {channelLine.map(([l, v]) => `${l} ${mask(formatTaka(v))}`).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('cash')}
              className="shrink-0 rounded-xl bg-white/30 px-3 py-2 text-xs font-semibold text-on-primary whitespace-nowrap transition-colors hover:bg-white/45"
            >
              ক্যাশ বক্স →
            </button>
          </div>

          <div className="relative z-10 mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => navigate('dues')}
              className="rounded-2xl bg-white/20 px-3 py-2 text-left transition-colors hover:bg-white/30"
            >
              <p className="text-xs text-on-primary">মোট পাবো</p>
              <p className="text-base font-bold tabular-nums">{mask(formatTaka(currentBalances.totalReceivables))}</p>
            </button>
            <button
              type="button"
              onClick={() => navigate('dues')}
              className="rounded-2xl bg-white/20 px-3 py-2 text-left transition-colors hover:bg-white/30"
            >
              <p className="text-xs text-on-primary">মোট দিবো</p>
              <p className="text-base font-bold tabular-nums">{mask(formatTaka(currentBalances.totalPayables))}</p>
            </button>
          </div>
        </section>

        {/* 2. বেচা / কেনা — the two most used actions, visible without scrolling at 360x640 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => openSheet({ type: 'sale' })}
            className="flex min-h-[64px] items-center justify-center gap-2.5 rounded-2xl bg-primary-gradient px-3 py-3 text-on-primary shadow-sm transition-all hover:brightness-[0.97] active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white">
              <AppIcon name="sale" className="h-8 w-8" />
            </span>
            <span className="text-left">
              <span className="block text-lg font-bold leading-tight">বেচা</span>
              <span className="block text-xs text-on-primary">বিক্রি লিখুন</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => openSheet({ type: 'purchase' })}
            className="flex min-h-[64px] items-center justify-center gap-2.5 rounded-2xl border border-border-strong bg-white px-3 py-3 text-ink shadow-card transition-all hover:border-primary-ink/50 active:scale-[0.98]"
          >
            <FeatureIcon tone="blue" size="sm">
              <AppIcon name="purchase" />
            </FeatureIcon>
            <span className="text-left">
              <span className="block text-lg font-bold leading-tight">কেনা</span>
              <span className="block text-xs text-ink-muted">মাল কেনা</span>
            </span>
          </button>
        </div>

        {/* 3. Four quick actions */}
        <section className="grid grid-cols-4 gap-2.5 sm:gap-4">
          {[
            {
              label: 'বাকি আদায়',
              icon: 'due-collect' as AppIconName,
              tone: 'orange' as FeatureTone,
              onClick: () => openSheet({ type: 'due', defaultEntryType: 'customer_collection' }),
            },
            {
              label: 'খরচ',
              icon: 'expense' as AppIconName,
              tone: 'red' as FeatureTone,
              onClick: () => openSheet({ type: 'expense' }),
            },
            {
              label: 'পরিশোধ',
              icon: 'supplier-pay' as AppIconName,
              tone: 'teal' as FeatureTone,
              onClick: () => openSheet({ type: 'due', defaultEntryType: 'supplier_payment' }),
            },
            {
              label: 'স্টক',
              icon: 'stock' as AppIconName,
              tone: 'indigo' as FeatureTone,
              onClick: () => navigate('stock'),
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-1 py-3 shadow-card transition-transform active:scale-[0.97]"
            >
              <FeatureIcon tone={item.tone}>
                <AppIcon name={item.icon} />
              </FeatureIcon>
              <span className="text-xs font-semibold text-ink whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </section>

        {/* 4. Today / month summary (compact 2x2) */}
        <section className="rounded-3xl bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              {period === 'today' ? 'আজকের হিসাব' : 'এই মাসের হিসাব'}
            </h2>
            <SegmentedControl
              aria-label="সময়কাল"
              variant="track"
              size="sm"
              value={period}
              onValueChange={setPeriod}
              options={[
                { value: 'today', label: 'আজ' },
                { value: 'month', label: 'মাস' },
              ]}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl bg-canvas p-3">
              <p className="text-xs text-ink-muted">মোট বিক্রি</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">{formatTaka(periodFlows.salesRevenue)}</p>
              <p className="text-xs text-ink-subtle tabular-nums">{formatBanglaNumber(periodFlows.salesCount)}টি বিক্রি</p>
            </div>
            <div className="rounded-2xl bg-secondary p-3">
              <p className="text-xs text-primary-ink">টাকা আদায়</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-primary-ink">{formatTaka(periodFlows.totalCollected)}</p>
              <p className="text-xs text-primary-ink">বিক্রি + বাকি আদায়</p>
            </div>
            <div className="rounded-2xl bg-danger-soft p-3">
              <p className="text-xs text-danger">মোট খরচ</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-danger">{formatTaka(periodFlows.expensesTotal)}</p>
              <p className="text-xs text-danger">দোকানের ব্যয়</p>
            </div>
            <div className="rounded-2xl bg-canvas p-3">
              <p className="text-xs text-ink-muted">নতুন বাকি দিয়েছি</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">{formatTaka(periodFlows.newReceivablesAdded)}</p>
              <p className="text-xs text-ink-subtle">কাস্টমার বাকি</p>
            </div>
          </div>
        </section>

        {/* খাতা: the four books (lists). Other tools live in আরও (no duplicate grid, plan 3.2). */}
        <section className="rounded-3xl bg-white p-4 shadow-card">
          <h2 className="mb-2 px-1 text-sm font-semibold text-ink">খাতা</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'বেচার খাতা', icon: 'book-sales' as AppIconName, route: 'sales' as const, tone: 'green' as FeatureTone },
              { label: 'কেনার খাতা', icon: 'book-purchase' as AppIconName, route: 'purchases' as const, tone: 'blue' as FeatureTone },
              { label: 'বাকির খাতা', icon: 'book-due' as AppIconName, route: 'dues' as const, tone: 'orange' as FeatureTone },
              { label: 'খরচের খাতা', icon: 'book-expense' as AppIconName, route: 'cash' as const, tone: 'red' as FeatureTone },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => navigate(b.route)}
                className="flex min-h-[84px] flex-col items-center justify-start gap-1.5 rounded-2xl p-1.5 text-center transition-colors hover:bg-canvas active:scale-[0.97]"
              >
                <FeatureIcon tone={b.tone}>
                  <AppIcon name={b.icon} />
                </FeatureIcon>
                <span className="text-xs font-semibold text-ink leading-tight">{b.label}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* RIGHT on desktop; last on mobile: 5. recent transactions */}
      <div className="mt-4 lg:col-span-5 lg:mt-0">
        <section className="rounded-3xl bg-white p-4 shadow-card lg:p-5">
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
                    <FeatureIcon
                      size="sm"
                      tone={
                        isPositive
                          ? 'green'
                          : item.sourceType === 'expense'
                            ? 'red'
                            : item.sourceType === 'purchase'
                              ? 'blue'
                              : item.sourceType === 'supplier_payment'
                                ? 'teal'
                                : 'orange'
                      }
                    >
                      <AppIcon
                        name={
                          isPositive ? 'money-in' : item.sourceType === 'expense' ? 'expense' : 'money-out'
                        }
                      />
                    </FeatureIcon>

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
                          isPositive ? 'text-success' : 'text-ink'
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
