/**
 * S13 (plan 8.2/8.3): large-data fixtures and timing of the pure calculations every screen runs.
 * Uses a TEST-ONLY generated khata restored into an isolated fake IndexedDB (never real data).
 * Node timings are a regression guard; real-phone budgets are measured in the browser (CHANGELOG).
 *
 * Set WRITE_FIXTURE=<path> to also write the 20k-transaction khata as a backup file for the
 * browser performance check.
 */
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bootApp } from './helpers/app';
import { buildLargeKhata } from './helpers/fixtures';
import { assertLedgerInvariants } from './helpers/invariants';
import { buildBackupFile } from '@/lib/backup';
import { partyMatches } from '@/lib/dues';
import {
  buildUnifiedLedger,
  computeCurrentBalances,
  computeHonestProfit,
  computePeriodFlows,
  getPeriodBounds,
} from '@/services/financeCalculator';

const time = (fn: () => unknown) => {
  const t0 = performance.now();
  fn();
  return performance.now() - t0;
};

describe('large khata: 5,000 parties, 20,000 sales, 2,000-row party ledger', () => {
  const data = buildLargeKhata({ parties: 5000, sales: 20000, expenses: 3000, bigPartyRows: 2000 });

  it('the generated books are consistent and restore through the validated path', async () => {
    const file = await buildBackupFile(data, 3);
    if (process.env.WRITE_FIXTURE) fs.writeFileSync(process.env.WRITE_FIXTURE, file);
    if (process.env.WRITE_FIXTURE_TYPICAL) {
      // A typical shop: about a year of a busy small shop.
      const typical = buildLargeKhata({ parties: 500, sales: 2000, expenses: 300, bigPartyRows: 200 }, 7);
      fs.writeFileSync(process.env.WRITE_FIXTURE_TYPICAL, await buildBackupFile(typical, 3));
    }
    const app = await bootApp();
    await app.service.restoreBackup(file);
    expect(await app.db.sales.count()).toBe(20000);
    expect(await app.db.parties.count()).toBe(5000);
    await assertLedgerInvariants(app); // balances, links, and stock = Σ movements
  }, 120_000);

  it('dashboard / reports / ledger calculations stay fast (regression budget)', () => {
    const s = data as unknown as {
      businessProfile: Parameters<typeof computeCurrentBalances>[0];
      parties: Parameters<typeof computeCurrentBalances>[1];
      moneyMovements: Parameters<typeof computeCurrentBalances>[2];
      products: Parameters<typeof computeCurrentBalances>[3];
      sales: Parameters<typeof computePeriodFlows>[1];
      purchases: Parameters<typeof computePeriodFlows>[2];
      expenses: Parameters<typeof computePeriodFlows>[4];
      dueTransactions: Parameters<typeof computePeriodFlows>[5];
    };
    const timings = {
      balances: time(() => computeCurrentBalances(s.businessProfile, s.parties, s.moneyMovements, s.products)),
      periodToday: time(() => computePeriodFlows(getPeriodBounds('today'), s.sales, s.purchases, s.moneyMovements, s.expenses, s.dueTransactions)),
      periodAll: time(() => computePeriodFlows(getPeriodBounds('all'), s.sales, s.purchases, s.moneyMovements, s.expenses, s.dueTransactions)),
      profitYear: time(() => computeHonestProfit(getPeriodBounds('year'), s.sales, s.expenses)),
      unifiedLedger: time(() => buildUnifiedLedger(s.sales, s.purchases, s.dueTransactions, s.expenses, s.parties)),
      partySearch: time(() => s.parties.filter((p) => partyMatches(p, '০১৭১০০০৪'))),
    };
    console.log('S13 timings (ms, Node):', Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v)])));
    // Generous CI-safe ceilings; the phone budget (save ≤ 300 ms, search ≤ 100 ms) is checked in the browser.
    expect(timings.balances).toBeLessThan(300);
    expect(timings.periodAll).toBeLessThan(500);
    expect(timings.unifiedLedger).toBeLessThan(1500);
    expect(timings.partySearch).toBeLessThan(100);
  });
});

describe('fixes kept by measurement (S13)', () => {
  const read = (p: string) => fs.readFileSync(`${__dirname}/../${p}`, 'utf8');
  it('long lists render in pages (party list, party ledger, ledger, sales, purchases, expenses, stock)', () => {
    for (const f of ['DuesView', 'LedgerView', 'SalesView', 'PurchasesView', 'CashExpenseView', 'StockView']) {
      expect(read(`components/views/${f}.tsx`), f).toMatch(/usePaged\(/);
      expect(read(`components/views/${f}.tsx`), f).toMatch(/<ShowMore /);
    }
  });
  it("Dexie's query cache stays disabled (bulk restore was ~10x slower with it)", () => {
    expect(read('db/jomarkhataDb.ts')).toMatch(/super\(name, \{ cache: 'disabled' \}\)/);
  });
});
