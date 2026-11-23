/**
 * AP-8: after a save, the app re-reads only the written rows (`loadChanges`). The result must equal
 * a full `loadAllData()` after EVERY kind of write, including back-dated entries (order), edits,
 * voids and switching khata.
 */
import { describe, expect, it } from 'vitest';
import { mergeRows } from '@/lib/snapshot-merge';
import { bootApp, bootEmptyShop, type App } from './helpers/app';

/** Every service write the app makes, in a realistic order. Each step is checked on its own. */
function steps(app: App) {
  const s = app.service;
  const ids: Record<string, string> = {};
  const item = (qty: number, price: number) => ({
    productId: ids.prod, name: 'তেল', unit: 'বোতল', qty, unitPrice: price, unitCostSnapshot: 170, lineTotal: qty * price,
  });
  const backDated = new Date(2026, 0, 15, 10, 0).toISOString();
  return [
    ['create customer', async () => { ids.cust = (await s.createParty({ name: 'করিম', phone: '01711000000', role: 'customer', openingDue: 500 })).id; }],
    ['create supplier', async () => { ids.sup = (await s.createParty({ name: 'ঢাকা ট্রেডার্স', phone: '01811000000', role: 'supplier' })).id; }],
    ['create product', async () => {
      ids.prod = (await s.createProduct({ name: 'তেল', category: 'মুদি', unit: 'বোতল', purchasePrice: 170, sellingPrice: 190, stockQty: 5, lowStockThreshold: 4 })).id;
    }],
    ['purchase', async () => {
      ids.pur = (await s.createPurchase({ mode: 'product', partyId: ids.sup, paymentMethod: 'cash', paidAmount: 1000, items: [{ ...item(12, 170), unitCostSnapshot: undefined } as never] })).id;
    }],
    ['sale on due', async () => { ids.sale = (await s.createSale({ mode: 'product', partyId: ids.cust, paymentMethod: 'bkash', paidAmount: 200, items: [item(3, 190)] })).id; }],
    ['back-dated sale', async () => {
      ids.old = (await s.createSale({ mode: 'quick', paymentMethod: 'cash', paidAmount: 120, date: backDated, items: [{ productId: null, name: 'বিস্কুট', qty: 1, unitPrice: 120, unitCostSnapshot: null, lineTotal: 120 }] } as never)).id;
    }],
    ['collect due', async () => { ids.due = (await s.recordDueEntry({ partyId: ids.cust, entryType: 'customer_collection', amount: 300, paymentMethod: 'cash' })).id; }],
    ['pay supplier', async () => { await s.recordDueEntry({ partyId: ids.sup, entryType: 'supplier_payment', amount: 500 }); }],
    ['edit due', async () => { await s.editDueEntry(ids.due, { amount: 250, paymentMethod: 'cash' }, 'ভুল'); }],
    ['expense', async () => { ids.exp = (await s.createExpense({ category: 'ভাড়া', title: 'ভাড়া', amount: 3000, paymentMethod: 'cash' })).id; }],
    ['stock adjust', async () => { await s.adjustProductStock(ids.prod, -1, 'ভাঙা'); }],
    ['edit sale', async () => { await s.editSale(ids.sale, { mode: 'product', partyId: ids.cust, paymentMethod: 'cash', paidAmount: 100, items: [item(2, 190)] }); }],
    ['edit purchase', async () => {
      await s.editPurchase(ids.pur, { mode: 'product', partyId: ids.sup, paymentMethod: 'cash', paidAmount: 500, items: [{ ...item(10, 170), unitCostSnapshot: undefined } as never] });
    }],
    ['update party', async () => { await s.updateParty(ids.cust, { name: 'করিম স্টোর', phone: '01711000001' }); }],
    ['due reminder', async () => { await s.setPartyDueReminder(ids.cust, new Date(2026, 11, 1).toISOString()); }],
    ['update product', async () => {
      await s.updateProduct(ids.prod, { name: 'সয়াবিন তেল', category: 'মুদি', unit: 'বোতল', purchasePrice: 175, sellingPrice: 195, lowStockThreshold: 3 } as never);
    }],
    ['void due', async () => { await s.voidDueEntry(ids.due, 'বাতিল'); }],
    ['void sale', async () => { await s.voidSale(ids.old, 'বাতিল'); }],
    ['void purchase', async () => { await s.voidPurchase(ids.pur, 'বাতিল'); }],
    ['void expense', async () => { await s.voidExpense(ids.exp, 'বাতিল'); }],
    ['profile', async () => {
      const p = (await app.db.businessProfile.get('default'))!;
      await s.updateBusinessProfile({ shopName: 'নতুন নাম', ownerName: p.ownerName, phone: p.phone, address: p.address, businessType: p.businessType, openingBalances: p.openingBalances } as never);
    }],
  ] as const;
}

describe('loadChanges equals a full read', () => {
  it('after every single kind of write', async () => {
    const app = await bootEmptyShop();
    await app.service.loadAllData();
    for (const [name, run] of steps(app)) {
      await run();
      const inc = await app.service.loadChanges();
      const full = await app.service.loadAllData();
      expect(inc, name).toEqual(full);
    }
  });

  it('when many incremental refreshes chain without a full read in between', async () => {
    const app = await bootEmptyShop();
    await app.service.loadAllData();
    let snap = await app.service.loadChanges();
    for (const [, run] of steps(app)) {
      await run();
      snap = await app.service.loadChanges();
    }
    expect(snap).toEqual(await app.service.loadAllData());
  });

  it('keeps the same array for tables the save did not touch', async () => {
    const app = await bootEmptyShop();
    const before = await app.service.loadAllData();
    await app.service.createExpense({ category: 'ভাড়া', title: 'ভাড়া', amount: 100, paymentMethod: 'cash' });
    const after = await app.service.loadChanges();
    expect(after.sales).toBe(before.sales);
    expect(after.parties).toBe(before.parties);
    expect(after.expenses).not.toBe(before.expenses);
    expect(after.expenses).toHaveLength(1);
  });

  it('falls back to a full read after a clear or a switch to the demo khata', async () => {
    const app = await bootEmptyShop();
    await app.service.createExpense({ category: 'ভাড়া', title: 'ভাড়া', amount: 100, paymentMethod: 'cash' });
    await app.service.loadAllData();
    await app.db.expenses.clear(); // a range delete: keys unknown → whole table
    expect(await app.service.loadChanges()).toEqual(await app.service.loadAllData());

    await app.service.enterDemo();
    const demo = await app.service.loadChanges();
    expect(demo).toEqual(await app.service.loadAllData());
    expect(demo.sales.length).toBeGreaterThan(0);
  });

  it('with no cached snapshot (fresh start) it is just a full read', async () => {
    const app = await bootApp();
    await app.db.businessProfile.put((await import('./helpers/app')).makeProfile());
    expect(await app.service.loadChanges()).toEqual(await app.service.loadAllData());
  });
});

describe('mergeRows (order identical to IndexedDB)', () => {
  const r = (id: string, date?: string) => ({ id, date }) as { id: string; date?: string };
  it('date desc, ties by id desc; deleted rows removed; rows without a date left out', () => {
    const rows = [r('c', '2026-03'), r('b', '2026-02'), r('a', '2026-02')];
    const out = mergeRows(rows, ['a', 'd', 'e', 'x'], [undefined, r('d', '2026-02'), r('e'), r('x', '2026-04')], 'date')!;
    expect(out.map((x) => x.id)).toEqual(['x', 'c', 'd', 'b']);
  });
  it('id order for plain tables, and the bulk (sorted) path matches the insert path', () => {
    const rows = Array.from({ length: 10 }, (_, i) => r(`p${i}`));
    const ids = Array.from({ length: 80 }, (_, i) => `q${String(i).padStart(2, '0')}`);
    const out = mergeRows(rows, ['p3', ...ids], [undefined, ...ids.map((id) => r(id))], null)!;
    expect(out.map((x) => x.id)).toEqual([...rows.map((x) => x.id).filter((id) => id !== 'p3'), ...ids].sort());
  });
  it('gives up (null) on a non-string sort key so the caller does a full read', () => {
    expect(mergeRows([], ['a'], [{ id: 'a', date: 5 } as never], 'date')).toBeNull();
  });
});
