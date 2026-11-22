'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, Info } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import {
  computeDailyBarSeries,
  computeHonestProfit,
  computePeriodFlows,
  getPeriodBounds,
  isWithinRange,
} from '@/services/financeCalculator';
import { downloadTextFile, formatBanglaNumber, formatTaka } from '@/lib/format';
import type { PeriodPreset } from '@/types/domain';

export function ReportsView() {
  const { data, currentBalances, showToast } = useJomarkhata();
  const [period, setPeriod] = useState<PeriodPreset>('month');
  const [activeBarIdx, setActiveBarIdx] = useState<number>(6);

  const range = useMemo(() => getPeriodBounds(period), [period]);

  const flows = useMemo(() => {
    if (!data) return null;
    return computePeriodFlows(
      range,
      data.sales,
      data.purchases,
      data.moneyMovements,
      data.expenses,
      data.dueTransactions
    );
  }, [data, range]);

  const profit = useMemo(() => {
    if (!data) return null;
    return computeHonestProfit(range, data.sales, data.expenses);
  }, [data, range]);

  const barSeries = useMemo(() => {
    if (!data) return [];
    return computeDailyBarSeries(7, data.sales, data.expenses, data.moneyMovements);
  }, [data]);

  const expenseBreakdown = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    let total = 0;
    for (const e of data.expenses) {
      if (e.status !== 'active' || !isWithinRange(e.date, range)) continue;
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
      total += e.amount;
    }
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        percent: total > 0 ? Math.round((amount / total) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [data, range]);

  if (!data || !flows || !profit) return null;

  const maxBarValue = Math.max(100, ...barSeries.map((p) => Math.max(p.sales, p.expenses)));
  const selectedBar = barSeries[activeBarIdx] ?? barSeries[barSeries.length - 1];

  const handleExportCsv = () => {
    const rows = [
      ['হিসাবের ধরন', 'পরিমাণ (টাকা)'],
      ['হাতে ক্যাশ (বর্তমান সব সময়ের)', String(currentBalances.cashInHand)],
      ['বিকাশ (বর্তমান)', String(currentBalances.channelBalances.bkash)],
      ['নগদ (বর্তমান)', String(currentBalances.channelBalances.nagad)],
      ['ব্যাংক (বর্তমান)', String(currentBalances.channelBalances.bank)],
      ['বর্তমান মোট পাবো', String(currentBalances.totalReceivables)],
      ['বর্তমান মোট দিবো', String(currentBalances.totalPayables)],
      ['নির্বাচিত সময়ে মোট বিক্রি', String(flows.salesRevenue)],
      ['নির্বাচিত সময়ে মোট আদায়', String(flows.totalCollected)],
      ['নির্বাচিত সময়ে মোট খরচ', String(flows.expensesTotal)],
      ['ক্রয়মূল্যসহ বিক্রি', String(profit.costedSalesRevenue)],
      ['পণ্যের ক্রয়মূল্য (COGS)', String(profit.knownCOGS)],
      [
        'ক্রয়মূল্যহীন বিক্রি সংখ্যা',
        `${profit.uncostedSalesCount}/${profit.totalSalesCount}`,
      ],
      [
        'মোট লাভ (শুধু ক্রয়মূল্যসহ বিক্রি)',
        profit.grossProfitOnCostedSales !== null ? String(profit.grossProfitOnCostedSales) : 'নির্ণয়যোগ্য নয়',
      ],
      [
        'আনুমানিক নিট লাভ',
        profit.netProfitEstimate !== null ? String(profit.netProfitEstimate) : 'নির্ণয়যোগ্য নয়',
      ],
    ];
    const csv = '\uFEFF' + rows.map((r) => r.join(',')).join('\n');
    downloadTextFile(`jomarkhata-report-${period}.csv`, csv, 'text/csv;charset=utf-8;');
    showToast('রিপোর্ট CSV ডাউনলোড হয়েছে।');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">ব্যবসার রিপোর্ট</h1>
          <p className="text-xs text-ink-muted">
            সহজ বাংলায় বর্তমান ব্যালেন্স, আদায়, খরচ এবং সৎ লাভের হিসাব
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-white px-4 text-xs font-semibold text-primary-ink shadow-card hover:bg-secondary"
        >
          <Download className="h-4 w-4" />
          <span>CSV ডাউনলোড</span>
        </button>
      </div>

      {/* Period Segmented Tabs (Reference Image 1 Style) */}
      <div className="flex items-center gap-1 rounded-full bg-surface-muted p-1 w-fit">
        {(
          [
            { id: 'today', label: 'আজ' },
            { id: 'week', label: 'সপ্তাহ' },
            { id: 'month', label: 'মাস' },
            { id: 'all', label: 'সব সময়' },
          ] as Array<{ id: PeriodPreset; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPeriod(t.id)}
            className={`min-h-[40px] rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-colors ${
              period === t.id ? 'bg-primary text-on-primary shadow-xs' : 'text-ink-muted'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. Strictly Separated Period Flows */}
      <section className="rounded-3xl bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink">নির্বাচিত সময়ের লেনদেন</h2>
        <p className="text-xs text-ink-muted">
          মোট বিক্রি এবং হাতে আসা ক্যাশ/ডিজিটাল আদায় আলাদাভাবে দেখানো হয়েছে
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-canvas p-3.5">
            <p className="text-xs text-ink-muted">মোট বিক্রি</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink">
              {formatTaka(flows.salesRevenue)}
            </p>
            <p className="text-xs text-ink-subtle">জমা + বাকি সব বিক্রি</p>
          </div>

          <div className="rounded-2xl bg-secondary p-3.5">
            <p className="text-xs text-primary-ink">মোট টাকা আদায়</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-primary-ink">
              {formatTaka(flows.totalCollected)}
            </p>
            <p className="text-xs text-primary-ink tabular-nums">
              বিক্রি {formatTaka(flows.salePaymentCollected)} · বাকি আদায়{' '}
              {formatTaka(flows.customerDueCollected)}
            </p>
          </div>

          <div className="rounded-2xl bg-danger-soft p-3.5">
            <p className="text-xs text-danger">মোট খরচ</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-danger">
              {formatTaka(flows.expensesTotal)}
            </p>
            <p className="text-xs text-danger">দোকানের পরিচালনা ব্যয়</p>
          </div>

          <div className="rounded-2xl bg-canvas p-3.5">
            <p className="text-xs text-ink-muted">মোট ক্রয়</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink">
              {formatTaka(flows.purchasesTotal)}
            </p>
            <p className="text-xs text-ink-subtle tabular-nums">
              পরিশোধ {formatTaka(flows.purchaseAndSupplierPaid)}
            </p>
          </div>
        </div>
      </section>

      {/* 2. Honest Profit Card with Explicit Completeness Indicator (INVARIANT #3) */}
      <section className="rounded-3xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">লাভ-ক্ষতির হিসাব</h2>
            <p className="text-xs text-ink-muted">
              ক্রয়মূল্য ছাড়া বিক্রিকে কখনোই শূন্য খরচের লাভ হিসেবে ধরা হয় না
            </p>
          </div>

          {/* Explicit Completeness Indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            {profit.completeness === 'complete' ? (
              <span className="inline-flex items-center gap-1 text-primary-ink">
                <CheckCircle2 className="h-4 w-4" />
                <span>সম্পূর্ণ হিসাব (১০০% ক্রয়মূল্য আছে)</span>
              </span>
            ) : profit.completeness === 'partial' ? (
              <span className="inline-flex items-center gap-1 text-warning-ink">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  অসম্পূর্ণ / আনুমানিক ({formatBanglaNumber(profit.costCoveragePercent)}% ক্রয়মূল্য আছে)
                </span>
              </span>
            ) : profit.completeness === 'unavailable' ? (
              <span className="inline-flex items-center gap-1 text-warning-ink">
                <Info className="h-4 w-4" />
                <span>ক্রয়মূল্য নেই — লাভ নির্ণয় অসম্পূর্ণ</span>
              </span>
            ) : (
              <span className="text-ink-subtle">কোনো বিক্রি নেই</span>
            )}
          </div>
        </div>

        {/* Missing Cost Warning Banner when incomplete */}
        {profit.uncostedSalesCount > 0 && (
          <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-warning-soft p-3.5 text-xs text-warning-ink">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-ink" />
            <p className="leading-relaxed">
              এই সময়ে মোট{' '}
              <strong>{formatBanglaNumber(profit.totalSalesCount)}টি</strong> বিক্রির মধ্যে{' '}
              <strong>{formatBanglaNumber(profit.uncostedSalesCount)}টি</strong> সহজ বিক্রিতে ক্রয়মূল্য দেওয়া হয়নি (মোট{' '}
              <strong className="tabular-nums">{formatTaka(profit.uncostedSalesRevenue)}</strong>)।
              সঠিক হিসাবের স্বার্থে ঐ বিক্রিগুলো লাভের হিসাব থেকে বাদ রাখা হয়েছে।
            </p>
          </div>
        )}

        <div className="mt-4 space-y-2.5 text-sm">
          <div className="flex items-center justify-between py-1">
            <span className="text-ink-muted">ক্রয়মূল্যসহ বিক্রি ({formatBanglaNumber(profit.costedSalesCount)}টি)</span>
            <span className="font-semibold tabular-nums text-ink">
              {formatTaka(profit.costedSalesRevenue)}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-ink-muted">পণ্যের ক্রয়মূল্য (COGS)</span>
            <span className="font-semibold tabular-nums text-ink">
              - {formatTaka(profit.knownCOGS)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2.5">
            <span className="font-semibold text-ink">
              মোট লাভ {profit.completeness === 'partial' ? '(শুধু ক্রয়মূল্যসহ বিক্রির)' : ''}
            </span>
            <span className="font-bold tabular-nums text-primary-ink">
              {profit.grossProfitOnCostedSales !== null
                ? formatTaka(profit.grossProfitOnCostedSales)
                : 'নির্ণয়যোগ্য নয়'}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-ink-muted">দোকানের পরিচালনা খরচ</span>
            <span className="font-semibold tabular-nums text-danger">
              - {formatTaka(profit.operatingExpenses)}
            </span>
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3">
            <span className="font-bold text-ink">
              {profit.completeness === 'complete' ? 'নিট লাভ' : 'আনুমানিক নিট লাভ'}
            </span>
            <span
              className={`text-lg font-bold tabular-nums ${
                profit.netProfitEstimate === null
                  ? 'text-ink-subtle'
                  : profit.netProfitEstimate >= 0
                    ? 'text-primary-ink'
                    : 'text-danger'
              }`}
            >
              {profit.netProfitEstimate !== null
                ? formatTaka(profit.netProfitEstimate)
                : 'ক্রয়মূল্য প্রয়োজন'}
            </span>
          </div>
        </div>
      </section>

      {/* 3. Single Clean 7-Day Sales vs Expense Bar Overview + Expense Breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="rounded-3xl bg-white p-5 shadow-card lg:col-span-7">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-ink">গত ৭ দিনের বিক্রি ও খরচ</h2>
              <p className="text-xs text-ink-muted">বার-এ ট্যাপ করে দিনের হিসাব দেখুন</p>
            </div>
            {selectedBar && (
              <div className="rounded-xl bg-primary px-3 py-1.5 text-right text-xs text-on-primary tabular-nums">
                <p className="text-xs text-on-primary/80">{selectedBar.label}</p>
                <p className="font-bold">বিক্রি {formatTaka(selectedBar.sales)}</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex h-44 items-end justify-between gap-2 px-1">
            {barSeries.map((pt, idx) => {
              const saleH = Math.max(8, Math.round((pt.sales / maxBarValue) * 100));
              const expH = pt.expenses > 0 ? Math.max(6, Math.round((pt.expenses / maxBarValue) * 100)) : 0;
              const isSelected = idx === activeBarIdx;

              return (
                <button
                  key={pt.dateKey}
                  type="button"
                  onClick={() => setActiveBarIdx(idx)}
                  className="group flex flex-1 flex-col items-center gap-2 focus:outline-none"
                >
                  <div className="flex h-32 w-full items-end justify-center gap-1">
                    <div
                      style={{ height: `${saleH}%` }}
                      className={`w-4 rounded-t-full transition-all sm:w-5 ${
                        isSelected ? 'bg-primary' : 'bg-primary/45 group-hover:bg-primary/80'
                      }`}
                    />
                    {expH > 0 && (
                      <div
                        style={{ height: `${expH}%` }}
                        className="w-2.5 rounded-t-full bg-danger-border sm:w-3"
                      />
                    )}
                  </div>
                  <span
                    className={`text-xs whitespace-nowrap ${
                      isSelected ? 'font-bold text-primary-ink' : 'text-ink-muted'
                    }`}
                  >
                    {pt.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" />
              বিক্রি
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-danger-border" />
              খরচ
            </span>
          </div>
        </section>

        {/* Expense Breakdown + Current All-Time Balances Snapshot */}
        <section className="space-y-4 lg:col-span-5">
          <div className="rounded-3xl bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-ink">খরচের খাতসমূহ</h2>
            {expenseBreakdown.length === 0 ? (
              <p className="mt-4 text-xs text-ink-muted">এই সময়ে কোনো খরচ নেই।</p>
            ) : (
              <div className="mt-3 space-y-3">
                {expenseBreakdown.map((row) => (
                  <div key={row.category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink">{row.category}</span>
                      <span className="font-semibold tabular-nums text-ink">
                        {formatTaka(row.amount)} · {formatBanglaNumber(row.percent)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
                      <div
                        style={{ width: `${row.percent}%` }}
                        className="h-full rounded-full bg-primary"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-ink">বর্তমান ব্যালেন্স (সব সময়ের)</h2>
            <div className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-muted">হাতে ক্যাশ</span>
                <span className="font-bold tabular-nums text-primary-ink">
                  {formatTaka(currentBalances.cashInHand)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">বিকাশ + নগদ + ব্যাংক</span>
                <span className="font-bold tabular-nums text-ink">
                  {formatTaka(currentBalances.digitalAndBankTotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">মোট পাবো (কাস্টমার)</span>
                <span className="font-bold tabular-nums text-danger">
                  {formatTaka(currentBalances.totalReceivables)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">মোট দিবো (সাপ্লায়ার)</span>
                <span className="font-bold tabular-nums text-primary-ink">
                  {formatTaka(currentBalances.totalPayables)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
