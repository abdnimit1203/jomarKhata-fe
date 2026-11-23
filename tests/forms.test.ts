/**
 * S6: entry forms — shared date input, discount on fully paid sales, typed qty/price, over-stock warning.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dateInputToIso, toDateInputValue } from '@/lib/format';
import { bootEmptyShop } from './helpers/app';
import { assertLedgerInvariants } from './helpers/invariants';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

describe('dateInputToIso (shared by every form)', () => {
  it('new entry dated today → undefined (service stamps now)', () => {
    expect(dateInputToIso(toDateInputValue(new Date()))).toBeUndefined();
  });
  it('another day → that calendar day', () => {
    const iso = dateInputToIso('2026-10-05')!;
    expect(toDateInputValue(iso)).toBe('2026-10-05');
  });
  it('editing with the same day keeps the original timestamp; a new day changes it', () => {
    const original = new Date(2026, 9, 5, 9, 15).toISOString();
    expect(dateInputToIso('2026-10-05', original)).toBe(original);
    expect(toDateInputValue(dateInputToIso('2026-10-07', original)!)).toBe('2026-10-07');
  });
});

describe('forms wiring (static)', () => {
  it('sale, purchase, expense and due forms all have the dd/MM/yyyy DateInput and send the date', () => {
    for (const f of ['SaleFormSheet', 'PurchaseFormSheet', 'ExpenseFormSheet', 'DueEntrySheet']) {
      const src = read(`components/sheets/${f}.tsx`);
      expect(src, f).toMatch(/<DateInput /);
      expect(src, f).toMatch(/dateInputToIso\(dateValue/);
    }
  });

  it('sale: discount is available for fully paid sales too (not hidden behind বাকি)', () => {
    const sale = read('components/sheets/SaleFormSheet.tsx');
    const discountAt = sale.indexOf('ছাড় (ঐচ্ছিক)');
    const dueBlockAt = sale.indexOf('{!isFullyPaid && (');
    expect(discountAt).toBeGreaterThan(-1);
    expect(discountAt).toBeLessThan(dueBlockAt);
  });

  it('product mode: quantity and unit price are typed; over-stock shows a warning but does not block', () => {
    for (const f of ['SaleFormSheet', 'PurchaseFormSheet']) expect(read(`components/sheets/${f}.tsx`), f).toMatch(/updateItem\(item\.productId, \{ qty: n \}\)/);
    const sale = read('components/sheets/SaleFormSheet.tsx');
    expect(sale).toMatch(/overStock\.length > 0/);
    expect(sale).toMatch(/তবুও বিক্রি করা যাবে/);
    expect(sale).not.toMatch(/overStock[^\n]*setFormError/);
  });
});

describe('service behaviour the forms rely on', () => {
  it('fully paid sale with a discount: total = subtotal − discount, no due, cash = total', async () => {
    const app = await bootEmptyShop();
    const before = await app.service.loadAllData();
    const sale = await app.service.createSale({
      mode: 'quick', paymentMethod: 'cash', paidAmount: 450, discount: 50,
      items: [{ productId: null, name: 'চাল', qty: 1, unitPrice: 500, unitCostSnapshot: null, lineTotal: 500 }],
    });
    expect(sale).toMatchObject({ subtotal: 500, discount: 50, total: 450, paidAmount: 450, dueAmount: 0 });
    const after = await app.service.loadAllData();
    const cash = (s: typeof before) => app.calc.computeCurrentBalances(s.businessProfile, s.parties, s.moneyMovements, s.products).cashInHand;
    expect(cash(after) - cash(before)).toBe(450);
    await assertLedgerInvariants(app);
  });

  it('backdated sale, purchase and expense keep their dates (reports count them on that day)', async () => {
    const app = await bootEmptyShop();
    const day = new Date(2026, 8, 1, 11, 0).toISOString();
    const s = await app.service.createSale({ mode: 'quick', paymentMethod: 'cash', paidAmount: 100, date: day, items: [{ productId: null, name: 'x', qty: 1, unitPrice: 100, unitCostSnapshot: null, lineTotal: 100 }] });
    const p = await app.service.createPurchase({ mode: 'quick', paymentMethod: 'cash', paidAmount: 80, date: day, items: [{ productId: null, name: 'y', qty: 1, unitPrice: 80, lineTotal: 80 }] });
    const e = await app.service.createExpense({ category: 'ভাড়া', title: 'ভাড়া', amount: 30, paymentMethod: 'cash', date: day });
    expect([s.date, p.date, e.date]).toEqual([day, day, day]);
    const snap = await app.service.loadAllData();
    const range = { start: new Date(2026, 8, 1), end: new Date(2026, 8, 1, 23, 59, 59) };
    const flows = app.calc.computePeriodFlows(range, snap.sales, snap.purchases, snap.moneyMovements, snap.expenses, snap.dueTransactions);
    expect(flows.salesRevenue).toBe(100);
    expect(flows.expensesTotal).toBe(30);
  });

  it('typed decimal quantity (e.g. 2.5 kg) is saved with the right line total', async () => {
    const app = await bootEmptyShop();
    const prod = await app.service.createProduct({ name: 'চিনি', category: 'মুদি', unit: 'কেজি', purchasePrice: 110, sellingPrice: 130, stockQty: 10, lowStockThreshold: 2 });
    const sale = await app.service.createSale({
      mode: 'product', paymentMethod: 'cash', paidAmount: 325,
      items: [{ productId: prod.id, name: 'চিনি', unit: 'কেজি', qty: 2.5, unitPrice: 130, unitCostSnapshot: 110, lineTotal: 325 }],
    });
    expect(sale.total).toBe(325);
    expect((await app.db.products.get(prod.id))!.stockQty).toBe(7.5);
  });
});
