/**
 * Every date-filtered screen offers the same period filter, including any month + year
 * ("অন্য মাস" → MonthYearPicker). The dashboard and the party screen already have their own picker.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { monthRange } from '@/lib/months';
import { isWithinRange } from '@/services/financeCalculator';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

describe('period filter with month/year choice', () => {
  it('sales, purchases, expenses, all transactions and reports use the shared PeriodFilter', () => {
    for (const v of ['SalesView', 'PurchasesView', 'CashExpenseView', 'LedgerView', 'ReportsView']) {
      const src = read(`components/views/${v}.tsx`);
      expect(src, v).toMatch(/usePeriodFilter\(/);
      expect(src, v).toMatch(/<PeriodFilter state=\{pf\}/);
    }
    for (const v of ['DashboardView', 'DuesView']) expect(read(`components/views/${v}.tsx`), v).toContain('<MonthYearPicker');
  });

  it('"অন্য মাস" opens the month + year picker', () => {
    const src = read('components/ui/PeriodFilter.tsx');
    expect(src).toMatch(/pick: 'অন্য মাস'/);
    expect(src).toMatch(/state\.period === 'pick' && <MonthYearPicker/);
  });

  it('the all-transactions list still shows everything by default', () => {
    expect(read('components/views/LedgerView.tsx')).toMatch(/usePeriodFilter\(saleDates, 'all'\)/);
  });

  it('a picked month covers exactly that calendar month', () => {
    const r = monthRange({ year: 2025, month: 1 }); // February 2025
    expect(isWithinRange(new Date(2025, 1, 1, 0, 0).toISOString(), r)).toBe(true);
    expect(isWithinRange(new Date(2025, 1, 28, 23, 59).toISOString(), r)).toBe(true);
    expect(isWithinRange(new Date(2025, 2, 1, 0, 0).toISOString(), r)).toBe(false);
    expect(isWithinRange(new Date(2025, 0, 31, 23, 59).toISOString(), r)).toBe(false);
  });
});
