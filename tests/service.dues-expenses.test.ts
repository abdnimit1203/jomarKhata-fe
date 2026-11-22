import { beforeEach, describe, expect, it } from 'vitest';
import { bootEmptyShop, type App } from './helpers/app';
import { assertLedgerInvariants } from './helpers/invariants';

let app: App;
beforeEach(async () => {
  app = await bootEmptyShop();
});

const balanceOf = async (id: string) => (await app.db.parties.get(id))!.balance;

describe('parties', () => {
  it('opening due: customer → পাবো (+), supplier → দিবো (−), recorded as a manual due with audit + outbox', async () => {
    const c = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer', openingDue: 1200 });
    const s = await app.service.createParty({ name: 'আলম এন্টারপ্রাইজ', phone: '', role: 'supplier', openingDue: 900 });
    expect(c.balance).toBe(1200);
    expect(s.balance).toBe(-900);
    const snap = await assertLedgerInvariants(app);
    expect(snap.dueTransactions.every((d) => d.source === 'manual_due' && !d.moneyMovementId)).toBe(true);
    expect(snap.auditLogs.filter((a) => a.entityType === 'party' && a.action === 'create')).toHaveLength(2);
  });

  it('name is required; update and payment-date reminder persist', async () => {
    await expect(app.service.createParty({ name: '  ', phone: '', role: 'customer' })).rejects.toThrow();
    const c = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer' });
    await app.service.updateParty(c.id, { name: 'রহিম মিয়া', phone: '01900000000' });
    await app.service.setPartyDueReminder(c.id, '2026-12-01');
    const stored = (await app.db.parties.get(c.id))!;
    expect([stored.name, stored.phone, stored.dueReminderDate]).toEqual(['রহিম মিয়া', '01900000000', '2026-12-01']);
  });
});

describe('due entries — all four entry types', () => {
  it('customer_collection: IN money movement, reduces পাবো', async () => {
    const c = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer', openingDue: 1000 });
    const d = await app.service.recordDueEntry({ partyId: c.id, entryType: 'customer_collection', amount: 400, paymentMethod: 'nagad' });
    expect(await balanceOf(c.id)).toBe(600);
    const mm = (await app.db.moneyMovements.get(d.moneyMovementId!))!;
    expect([mm.direction, mm.channel, mm.amount, mm.sourceType]).toEqual(['in', 'nagad', 400, 'customer_collection']);
    await assertLedgerInvariants(app);
  });

  it('supplier_payment: OUT money movement, reduces দিবো', async () => {
    const s = await app.service.createParty({ name: 'আলম', phone: '', role: 'supplier', openingDue: 1000 });
    const d = await app.service.recordDueEntry({ partyId: s.id, entryType: 'supplier_payment', amount: 300 });
    expect(await balanceOf(s.id)).toBe(-700);
    const mm = (await app.db.moneyMovements.get(d.moneyMovementId!))!;
    expect([mm.direction, mm.channel]).toEqual(['out', 'cash']);
    await assertLedgerInvariants(app);
  });

  it('manual_due_given / manual_due_received: change the balance without moving money', async () => {
    const c = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer' });
    await app.service.recordDueEntry({ partyId: c.id, entryType: 'manual_due_given', amount: 500 });
    await app.service.recordDueEntry({ partyId: c.id, entryType: 'manual_due_received', amount: 200 });
    expect(await balanceOf(c.id)).toBe(300);
    expect(await app.db.moneyMovements.count()).toBe(0);
    await assertLedgerInvariants(app);
  });

  it('running balances are chronological, including back-dated entries', async () => {
    const c = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer' });
    await app.service.recordDueEntry({ partyId: c.id, entryType: 'manual_due_given', amount: 1000, date: '2026-11-10T10:00:00.000Z' });
    await app.service.recordDueEntry({ partyId: c.id, entryType: 'customer_collection', amount: 300, date: '2026-11-12T10:00:00.000Z' });
    await app.service.recordDueEntry({ partyId: c.id, entryType: 'manual_due_given', amount: 50, date: '2026-11-11T10:00:00.000Z' });
    const rows = (await app.db.dueTransactions.where('partyId').equals(c.id).sortBy('date')).map((d) => d.runningBalance);
    expect(rows).toEqual([1000, 1050, 750]);
  });

  it('amount must be positive and a party is required', async () => {
    const c = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer' });
    await expect(app.service.recordDueEntry({ partyId: c.id, entryType: 'manual_due_given', amount: 0 })).rejects.toThrow();
    await expect(app.service.recordDueEntry({ partyId: '', entryType: 'manual_due_given', amount: 10 })).rejects.toThrow();
  });
});

describe('due entries — edit & void', () => {
  it('editing a collection updates its money movement; voiding reverses it and is audited', async () => {
    const c = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer', openingDue: 1000 });
    const d = await app.service.recordDueEntry({ partyId: c.id, entryType: 'customer_collection', amount: 400 });
    await app.service.editDueEntry(d.id, { amount: 250, paymentMethod: 'bkash' });
    expect(await balanceOf(c.id)).toBe(750);
    expect((await app.db.moneyMovements.get(d.moneyMovementId!))!.channel).toBe('bkash');
    await assertLedgerInvariants(app);

    await app.service.voidDueEntry(d.id, 'ভুল');
    expect(await balanceOf(c.id)).toBe(1000);
    expect((await app.db.dueTransactions.get(d.id))!.status).toBe('voided');
    const s = await assertLedgerInvariants(app);
    expect(s.auditLogs.filter((a) => a.entityId === d.id).map((a) => a.action).sort()).toEqual(['create', 'edit', 'void']);
  });

  it('a due created by a sale can only be corrected from the sale, not directly', async () => {
    const c = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer' });
    const sale = await app.service.createSale({
      mode: 'quick',
      partyId: c.id,
      items: [{ productId: null, name: 'x', qty: 1, unitPrice: 500, unitCostSnapshot: null, lineTotal: 500 }],
      paidAmount: 0,
      paymentMethod: 'cash',
    });
    await expect(app.service.editDueEntry(sale.dueTransactionId!, { amount: 100 })).rejects.toThrow();
    await expect(app.service.voidDueEntry(sale.dueTransactionId!)).rejects.toThrow();
  });
});

describe('expenses', () => {
  it('create, edit and void keep exactly one matching OUT money movement', async () => {
    const e = await app.service.createExpense({ category: 'বিদ্যুৎ বিল', title: 'নভেম্বর বিল', amount: 800, paymentMethod: 'cash' });
    let s = await assertLedgerInvariants(app);
    expect(app.calc.computeCurrentBalances(s.businessProfile, s.parties, s.moneyMovements, s.products).cashInHand).toBe(200);

    await app.service.editExpense(e.id, { category: 'বিদ্যুৎ বিল', title: 'নভেম্বর বিল', amount: 650, paymentMethod: 'bkash' });
    s = await assertLedgerInvariants(app);
    expect(s.moneyMovements.find((m) => m.id === e.moneyMovementId)!.channel).toBe('bkash');

    await app.service.voidExpense(e.id, 'ডুপ্লিকেট');
    s = await assertLedgerInvariants(app);
    const bal = app.calc.computeCurrentBalances(s.businessProfile, s.parties, s.moneyMovements, s.products);
    expect([bal.cashInHand, bal.channelBalances.bkash]).toEqual([1000, 500]);
    await expect(app.service.editExpense(e.id, { category: 'x', title: 'y', amount: 1, paymentMethod: 'cash' })).rejects.toThrow();
  });

  it('non-positive amount is rejected', async () => {
    await expect(app.service.createExpense({ category: 'x', title: 'y', amount: 0, paymentMethod: 'cash' })).rejects.toThrow();
  });
});
