import { describe, expect, it } from 'vitest';
import {
  computeCurrentBalances,
  computeHonestProfit,
  computePartyRunningTimeline,
  computePeriodFlows,
  getPeriodBounds,
  isWithinRange,
} from '@/services/financeCalculator';
import type {
  DueTransaction,
  ExpenseRecord,
  MoneyMovement,
  Party,
  Product,
  SaleRecord,
} from '@/types/domain';
import { makeProfile } from './helpers/app';

const NOW = new Date('2026-11-22T10:00:00');
const iso = (d: string) => new Date(d).toISOString();

function mm(p: Partial<MoneyMovement>): MoneyMovement {
  return {
    id: p.id ?? Math.random().toString(36),
    direction: 'in',
    channel: 'cash',
    sourceType: 'sale_payment',
    sourceId: 's',
    amount: 0,
    status: 'active',
    date: iso('2026-11-22T09:00:00'),
    createdAt: iso('2026-11-22T09:00:00'),
    updatedAt: iso('2026-11-22T09:00:00'),
    ...p,
  };
}

function sale(p: Partial<SaleRecord>): SaleRecord {
  return {
    id: p.id ?? Math.random().toString(36),
    invoiceNo: 'INV-1',
    mode: 'quick',
    status: 'active',
    partyName: 'x',
    items: [],
    subtotal: p.total ?? 0,
    discount: 0,
    total: 0,
    paidAmount: p.total ?? 0,
    dueAmount: 0,
    paymentMethod: 'cash',
    date: iso('2026-11-22T09:00:00'),
    revision: 1,
    createdAt: iso('2026-11-22T09:00:00'),
    updatedAt: iso('2026-11-22T09:00:00'),
    ...p,
  };
}

function due(p: Partial<DueTransaction>): DueTransaction {
  return {
    id: p.id ?? Math.random().toString(36),
    partyId: 'p1',
    partyRole: 'customer',
    direction: 'given',
    source: 'manual_due',
    amount: 0,
    runningBalance: 0,
    status: 'active',
    date: iso('2026-11-22T09:00:00'),
    revision: 1,
    createdAt: iso('2026-11-22T09:00:00'),
    updatedAt: iso('2026-11-22T09:00:00'),
    ...p,
  };
}

describe('getPeriodBounds / isWithinRange', () => {
  it('today spans local midnight to 23:59:59.999', () => {
    const r = getPeriodBounds('today', NOW);
    expect(r.start!.getHours()).toBe(0);
    expect(r.end!.getHours()).toBe(23);
    expect(isWithinRange(iso('2026-11-22T00:00:01'), r)).toBe(true);
    expect(isWithinRange(iso('2026-11-21T23:59:59'), r)).toBe(false);
  });

  it('month starts on the 1st, year on 1 January, all is unbounded', () => {
    expect(getPeriodBounds('month', NOW).start!.getDate()).toBe(1);
    const y = getPeriodBounds('year', NOW).start!;
    expect([y.getMonth(), y.getDate()]).toEqual([0, 1]);
    expect(getPeriodBounds('all', NOW)).toEqual({ start: null, end: null });
    expect(isWithinRange('not-a-date', getPeriodBounds('today', NOW))).toBe(false);
  });

  it('week covers today plus the previous 6 days', () => {
    const r = getPeriodBounds('week', NOW);
    expect(isWithinRange(iso('2026-11-16T08:00:00'), r)).toBe(true);
    expect(isWithinRange(iso('2026-11-15T23:00:00'), r)).toBe(false);
  });
});

describe('computeCurrentBalances (all-time, invariant #1/#4)', () => {
  it('opening + active in − active out per channel; voided movements ignored', () => {
    const profile = makeProfile({ openingBalances: { cash: 1000, bkash: 200, nagad: 50, bank: 0 } });
    const movements = [
      mm({ amount: 500, channel: 'cash', direction: 'in' }),
      mm({ amount: 300, channel: 'cash', direction: 'out', sourceType: 'expense' }),
      mm({ amount: 100, channel: 'bkash', direction: 'in' }),
      mm({ amount: 9999, channel: 'cash', direction: 'in', status: 'voided' }),
    ];
    const b = computeCurrentBalances(profile, [], movements, []);
    expect(b.channelBalances).toEqual({ cash: 1200, bkash: 300, nagad: 50, bank: 0 });
    expect(b.cashInHand).toBe(1200);
    expect(b.digitalAndBankTotal).toBe(350);
    expect(b.totalLiquidBalance).toBe(1550);
  });

  it('receivables = positive party balances, payables = |negative|, stock valued at purchase price', () => {
    const parties = [
      { id: 'a', balance: 700 },
      { id: 'b', balance: -400 },
      { id: 'c', balance: 0 },
    ] as Party[];
    const products = [
      { id: 'x', isActive: true, stockQty: 10, purchasePrice: 20, lowStockThreshold: 5 },
      { id: 'y', isActive: true, stockQty: 2, purchasePrice: 50, lowStockThreshold: 5 },
      { id: 'z', isActive: false, stockQty: 99, purchasePrice: 1, lowStockThreshold: 5 },
    ] as Product[];
    const b = computeCurrentBalances(null, parties, [], products);
    expect([b.totalReceivables, b.totalPayables, b.netDuePosition]).toEqual([700, 400, 300]);
    expect([b.totalStockQty, b.totalStockValue, b.lowStockCount]).toEqual([12, 300, 1]);
  });
});

describe('computePeriodFlows (period-scoped, invariant #4)', () => {
  it('only active records inside the range are counted; collections come from money movements', () => {
    const range = getPeriodBounds('today', NOW);
    const sales = [
      sale({ total: 1000 }),
      sale({ total: 500, status: 'voided' }),
      sale({ total: 800, date: iso('2026-10-01T09:00:00') }),
    ];
    const movements = [
      mm({ amount: 600, sourceType: 'sale_payment' }),
      mm({ amount: 200, sourceType: 'customer_collection', channel: 'bkash' }),
      mm({ amount: 150, direction: 'out', sourceType: 'supplier_payment' }),
      mm({ amount: 50, direction: 'out', sourceType: 'expense' }),
    ];
    const expenses = [{ id: 'e', amount: 50, status: 'active', date: iso('2026-11-22T09:00:00') }] as ExpenseRecord[];
    const dues = [
      due({ amount: 400, source: 'sale' }),
      due({ amount: 90, source: 'manual_due', direction: 'received' }),
    ];
    const f = computePeriodFlows(range, sales, [], movements, expenses, dues);
    expect(f.salesRevenue).toBe(1000);
    expect(f.salesCount).toBe(1);
    expect(f.totalCollected).toBe(800);
    expect(f.customerDueCollected).toBe(200);
    expect(f.cashInflow).toBe(600);
    expect(f.cashOutflow).toBe(200);
    expect(f.purchaseAndSupplierPaid).toBe(150);
    expect(f.expensesTotal).toBe(50);
    expect(f.newReceivablesAdded).toBe(400);
    expect(f.newPayablesAdded).toBe(90);
  });
});

describe('computeHonestProfit (invariant #3: unknown cost is never 0)', () => {
  const range = getPeriodBounds('all');
  const costed = (total: number, cost: number) =>
    sale({ total, items: [{ name: 'a', qty: 1, unitPrice: total, unitCostSnapshot: cost, lineTotal: total }] });
  const uncosted = (total: number) =>
    sale({ total, items: [{ name: 'b', qty: 1, unitPrice: total, unitCostSnapshot: null, lineTotal: total }] });

  it('no_sales when nothing sold', () => {
    expect(computeHonestProfit(range, [], []).completeness).toBe('no_sales');
  });

  it('unavailable when no sale has a known cost — profit is null, not total revenue', () => {
    const p = computeHonestProfit(range, [uncosted(500)], []);
    expect(p.completeness).toBe('unavailable');
    expect(p.grossProfitOnCostedSales).toBeNull();
    expect(p.netProfitEstimate).toBeNull();
  });

  it('partial: profit computed from costed sales only, uncosted revenue reported separately', () => {
    const expenses = [{ id: 'e', amount: 50, status: 'active', date: iso('2026-11-22T09:00:00') }] as ExpenseRecord[];
    const p = computeHonestProfit(range, [costed(1000, 700), uncosted(400)], expenses);
    expect(p.completeness).toBe('partial');
    expect(p.knownCOGS).toBe(700);
    expect(p.grossProfitOnCostedSales).toBe(300);
    expect(p.netProfitEstimate).toBe(250);
    expect(p.uncostedSalesCount).toBe(1);
    expect(p.uncostedSalesRevenue).toBe(400);
    expect(p.costCoveragePercent).toBe(71);
  });

  it('complete when every sale line has a cost (cost 0 is a valid known cost)', () => {
    const p = computeHonestProfit(range, [costed(100, 0)], []);
    expect(p.completeness).toBe('complete');
    expect(p.grossProfitOnCostedSales).toBe(100);
  });
});

describe('computePartyRunningTimeline', () => {
  it('orders by date then createdAt; voided rows keep the running total but do not change it', () => {
    const t = computePartyRunningTimeline([
      due({ id: 'c', amount: 100, direction: 'received', date: iso('2026-11-03T10:00:00') }),
      due({ id: 'a', amount: 500, direction: 'given', date: iso('2026-11-01T10:00:00') }),
      due({ id: 'b', amount: 999, direction: 'given', status: 'voided', date: iso('2026-11-02T10:00:00') }),
    ]);
    expect(t.updatedTxns.map((x) => [x.id, x.runningBalance])).toEqual([
      ['a', 500],
      ['b', 500],
      ['c', 400],
    ]);
    expect(t.finalBalance).toBe(400);
    expect(t.lastTransactionAt).toBe(iso('2026-11-03T10:00:00'));
  });
});
