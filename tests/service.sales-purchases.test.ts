import { beforeEach, describe, expect, it } from 'vitest';
import type { CreatePurchaseInput, CreateSaleInput } from '@/services/jomarkhataService';
import { bootEmptyShop, type App } from './helpers/app';
import { assertLedgerInvariants } from './helpers/invariants';

let app: App;
beforeEach(async () => {
  app = await bootEmptyShop();
});

const quickSale = (total: number, extra: Partial<CreateSaleInput> = {}): CreateSaleInput => ({
  mode: 'quick',
  items: [{ productId: null, name: 'সহজ বিক্রি', qty: 1, unitPrice: total, unitCostSnapshot: null, lineTotal: total }],
  paidAmount: total,
  paymentMethod: 'cash',
  ...extra,
});

async function addCustomer(name = 'করিম') {
  return app.service.createParty({ name, phone: '01711111111', role: 'customer' });
}
async function addSupplier(name = 'ঢাকা ট্রেডার্স') {
  return app.service.createParty({ name, phone: '01811111111', role: 'supplier' });
}
async function addProduct(stockQty = 10) {
  return app.service.createProduct({
    name: 'চাল ১ কেজি',
    category: 'মুদি',
    unit: 'কেজি',
    purchasePrice: 60,
    sellingPrice: 75,
    stockQty,
    lowStockThreshold: 3,
  });
}

describe('sales — create', () => {
  it('fully paid walk-in sale: one IN money movement, no due, audit + outbox entries', async () => {
    const created = await app.service.createSale(quickSale(500));
    const s = await assertLedgerInvariants(app);

    expect(created.invoiceNo).toBe('INV-1001');
    expect(created.partyName).toBe('নগদ ক্রেতা'); // current wording; AP-12 proposes "ক্যাশ ক্রেতা"
    expect([created.paidAmount, created.dueAmount]).toEqual([500, 0]);
    expect(s.moneyMovements).toHaveLength(1);
    expect(s.dueTransactions).toHaveLength(0);
    expect(app.calc.computeCurrentBalances(s.businessProfile, s.parties, s.moneyMovements, s.products).cashInHand).toBe(1500);
    expect(s.auditLogs.filter((a) => a.entityId === created.id && a.action === 'create')).toHaveLength(1);
    const outbox = await app.db.syncQueue.toArray();
    expect(outbox.map((o) => o.entityType).sort()).toEqual(['money_movement', 'sale']);
  });

  it('partial sale to a customer: paid part to the chosen channel, rest becomes পাবো', async () => {
    const c = await addCustomer();
    await app.service.createSale(quickSale(1000, { partyId: c.id, paidAmount: 300, paymentMethod: 'bkash' }));
    const s = await assertLedgerInvariants(app);
    expect(s.parties.find((p) => p.id === c.id)!.balance).toBe(700);
    expect(s.moneyMovements[0].channel).toBe('bkash');
  });

  it('credit without a customer is rejected and writes nothing (atomic)', async () => {
    await expect(app.service.createSale(quickSale(800, { paidAmount: 0 }))).rejects.toThrow();
    for (const t of ['sales', 'moneyMovements', 'dueTransactions', 'auditLogs', 'syncQueue'] as const) {
      expect(await app.db[t].count(), t).toBe(0);
    }
  });

  it('zero total and empty items are rejected', async () => {
    await expect(app.service.createSale(quickSale(0))).rejects.toThrow();
    await expect(app.service.createSale({ ...quickSale(10), items: [] })).rejects.toThrow();
  });

  it('discount reduces the total; paid is capped at total', async () => {
    const created = await app.service.createSale(quickSale(1000, { discount: 100, paidAmount: 5000 }));
    expect([created.subtotal, created.discount, created.total, created.paidAmount]).toEqual([1000, 100, 900, 900]);
  });

  it('product sale deducts stock, records a stock movement, keeps the cost snapshot for profit', async () => {
    const prod = await addProduct(10);
    await app.service.createSale({
      mode: 'product',
      items: [{ productId: prod.id, name: prod.name, unit: 'কেজি', qty: 3, unitPrice: 75, unitCostSnapshot: 60, lineTotal: 225 }],
      paidAmount: 225,
      paymentMethod: 'cash',
    });
    const s = await assertLedgerInvariants(app, { checkStock: true });
    expect(s.products[0].stockQty).toBe(7);
    const profit = app.calc.computeHonestProfit(app.calc.getPeriodBounds('all'), s.sales, s.expenses);
    expect(profit.completeness).toBe('complete');
    expect(profit.grossProfitOnCostedSales).toBe(45);
  });

  it('invoice numbers are sequential per book', async () => {
    const a = await app.service.createSale(quickSale(10));
    const b = await app.service.createSale(quickSale(20));
    expect([a.invoiceNo, b.invoiceNo]).toEqual(['INV-1001', 'INV-1002']);
  });
});

describe('sales — edit & void (correction history)', () => {
  it('editing a paid sale into a partial credit sale updates the money movement and creates the due', async () => {
    const c = await addCustomer();
    const sale = await app.service.createSale(quickSale(1000, { partyId: c.id }));
    const edited = await app.service.editSale(sale.id, quickSale(1000, { partyId: c.id, paidAmount: 400 }));
    const s = await assertLedgerInvariants(app);

    expect(edited.revision).toBe(2);
    expect(s.parties.find((p) => p.id === c.id)!.balance).toBe(600);
    const audit = s.auditLogs.find((a) => a.entityId === sale.id && a.action === 'edit')!;
    expect(JSON.parse(audit.beforeSnapshot!).paidAmount).toBe(1000);
    expect(JSON.parse(audit.afterSnapshot!).paidAmount).toBe(400);
  });

  it('editing a product sale quantity adjusts stock by the difference', async () => {
    const prod = await addProduct(10);
    const line = (qty: number) => ({ productId: prod.id, name: prod.name, unit: 'কেজি', qty, unitPrice: 75, unitCostSnapshot: 60, lineTotal: qty * 75 });
    const sale = await app.service.createSale({ mode: 'product', items: [line(2)], paidAmount: 150, paymentMethod: 'cash' });
    await app.service.editSale(sale.id, { mode: 'product', items: [line(5)], paidAmount: 375, paymentMethod: 'cash' });
    const s = await assertLedgerInvariants(app, { checkStock: true });
    expect(s.products[0].stockQty).toBe(5);
  });

  it('void reverses money, due and stock, keeps the record as voided, and is idempotent', async () => {
    const c = await addCustomer();
    const prod = await addProduct(10);
    const sale = await app.service.createSale({
      mode: 'product',
      partyId: c.id,
      items: [{ productId: prod.id, name: prod.name, qty: 4, unitPrice: 75, unitCostSnapshot: 60, lineTotal: 300 }],
      paidAmount: 100,
      paymentMethod: 'cash',
    });
    await app.service.voidSale(sale.id, 'ভুল এন্ট্রি');
    await app.service.voidSale(sale.id, 'আবার'); // second void is a no-op
    const s = await assertLedgerInvariants(app, { checkStock: true });

    const stored = s.sales.find((x) => x.id === sale.id)!;
    expect(stored.status).toBe('voided');
    expect(stored.voidReason).toBe('ভুল এন্ট্রি');
    expect(s.parties.find((p) => p.id === c.id)!.balance).toBe(0);
    expect(s.products[0].stockQty).toBe(10);
    expect(s.auditLogs.filter((a) => a.entityId === sale.id && a.action === 'void')).toHaveLength(1);
    await expect(app.service.editSale(sale.id, quickSale(10))).rejects.toThrow();
  });
});

describe('purchases', () => {
  const quickPurchase = (total: number, extra: Partial<CreatePurchaseInput> = {}): CreatePurchaseInput => ({
    mode: 'quick',
    items: [{ productId: null, name: 'মালামাল', qty: 1, unitPrice: total, lineTotal: total }],
    paidAmount: total,
    paymentMethod: 'cash',
    ...extra,
  });

  it('paid purchase: OUT money movement; credit purchase: supplier becomes দিবো (negative balance)', async () => {
    const sup = await addSupplier();
    const paid = await app.service.createPurchase(quickPurchase(400));
    await app.service.createPurchase(quickPurchase(1000, { partyId: sup.id, paidAmount: 200 }));
    const s = await assertLedgerInvariants(app);
    expect(paid.billNo).toBe('BILL-1001');
    expect(s.parties.find((p) => p.id === sup.id)!.balance).toBe(-800);
    const bal = app.calc.computeCurrentBalances(s.businessProfile, s.parties, s.moneyMovements, s.products);
    expect(bal.cashInHand).toBe(1000 - 400 - 200);
    expect(bal.totalPayables).toBe(800);
  });

  it('credit purchase without a supplier is rejected', async () => {
    await expect(app.service.createPurchase(quickPurchase(500, { paidAmount: 0 }))).rejects.toThrow();
    expect(await app.db.purchases.count()).toBe(0);
  });

  it('product purchase adds stock; edit and void keep stock and supplier balance consistent', async () => {
    const sup = await addSupplier();
    const prod = await addProduct(0);
    const line = (qty: number) => ({ productId: prod.id, name: prod.name, unit: 'কেজি', qty, unitPrice: 60, lineTotal: qty * 60 });
    const pur = await app.service.createPurchase({ mode: 'product', partyId: sup.id, items: [line(10)], paidAmount: 0, paymentMethod: 'cash' });
    await assertLedgerInvariants(app, { checkStock: true });
    await app.service.editPurchase(pur.id, { mode: 'product', partyId: sup.id, items: [line(8)], paidAmount: 100, paymentMethod: 'cash' });
    let s = await assertLedgerInvariants(app, { checkStock: true });
    expect(s.products[0].stockQty).toBe(8);
    expect(s.parties.find((p) => p.id === sup.id)!.balance).toBe(-380);
    await app.service.voidPurchase(pur.id, 'বাতিল');
    s = await assertLedgerInvariants(app, { checkStock: true });
    expect(s.products[0].stockQty).toBe(0);
    expect(s.parties.find((p) => p.id === sup.id)!.balance).toBe(0);
  });
});

describe('known issue AP-9 (documented, not fixed): stock clamp on oversell', () => {
  it('overselling clamps stockQty at 0 while the movement records the full quantity, so they diverge', async () => {
    const prod = await addProduct(2);
    await app.service.createSale({
      mode: 'product',
      items: [{ productId: prod.id, name: prod.name, qty: 5, unitPrice: 75, unitCostSnapshot: 60, lineTotal: 375 }],
      paidAmount: 375,
      paymentMethod: 'cash',
    });
    const s = await app.service.loadAllData();
    const movementSum = s.stockMovements.reduce((acc, m) => acc + m.deltaQty, 0);
    expect(s.products[0].stockQty).toBe(0);
    expect(movementSum).toBe(-3); // 2 opening − 5 sold: CURRENT behaviour, pending owner decision AP-9
  });
});
