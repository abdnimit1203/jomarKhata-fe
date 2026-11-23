/**
 * S7: corrections & history — before → after diff, optional edit reason (AP-6), plain wording,
 * void error handling, return to the detail after an edit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { diffAudit } from '@/lib/audit-diff';
import { bootEmptyShop } from './helpers/app';
import { assertLedgerInvariants } from './helpers/invariants';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const quick = (amount: number, paid = amount) => ({
  mode: 'quick' as const,
  paymentMethod: 'cash' as const,
  paidAmount: paid,
  items: [{ productId: null, name: 'চাল', qty: 1, unitPrice: amount, unitCostSnapshot: null, lineTotal: amount }],
});

describe('diffAudit (pure)', () => {
  it('lists only changed, shopkeeper-relevant fields with Bangla labels', () => {
    const before = { total: 500, paidAmount: 500, dueAmount: 0, paymentMethod: 'cash', note: '', revision: 1, updatedAt: 'x' };
    const after = { total: 650, paidAmount: 500, dueAmount: 150, paymentMethod: 'bkash', note: 'দাম ঠিক', revision: 2, updatedAt: 'y' };
    const d = diffAudit({ beforeSnapshot: JSON.stringify(before), afterSnapshot: JSON.stringify(after) });
    expect(d.map((c) => c.label)).toEqual(['মোট', 'বাকি', 'মাধ্যম', 'নোট']);
    expect(d[0]).toEqual({ label: 'মোট', before: '৫০০ ৳', after: '৬৫০ ৳' });
    expect(d[2]).toMatchObject({ before: 'ক্যাশ', after: 'বিকাশ' });
  });

  it('missing or broken snapshots give no rows instead of crashing', () => {
    expect(diffAudit({ beforeSnapshot: null, afterSnapshot: '{"total":1}' })).toEqual([]);
    expect(diffAudit({ beforeSnapshot: '{bad', afterSnapshot: '{}' })).toEqual([]);
  });
});

describe('AP-6: optional reason on edit (service)', () => {
  it('editSale/editPurchase/editDueEntry/editExpense store the reason on the edit audit entry', async () => {
    const app = await bootEmptyShop();
    const sale = await app.service.createSale(quick(500));
    await app.service.editSale(sale.id, quick(650), 'দাম ভুল ছিল');
    const pur = await app.service.createPurchase({ mode: 'quick', paymentMethod: 'cash', paidAmount: 100, items: [{ productId: null, name: 'x', qty: 1, unitPrice: 100, lineTotal: 100 }] });
    await app.service.editPurchase(pur.id, { mode: 'quick', paymentMethod: 'cash', paidAmount: 120, items: [{ productId: null, name: 'x', qty: 1, unitPrice: 120, lineTotal: 120 }] }, 'বিল দেখে ঠিক');
    const cust = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer' });
    const due = await app.service.recordDueEntry({ partyId: cust.id, entryType: 'manual_due_given', amount: 300 });
    await app.service.editDueEntry(due.id, { amount: 350 }, '  টাইপো  ');
    const exp = await app.service.createExpense({ category: 'ভাড়া', title: 'ভাড়া', amount: 1000, paymentMethod: 'cash' });
    await app.service.editExpense(exp.id, { category: 'ভাড়া', title: 'ভাড়া', amount: 1200, paymentMethod: 'cash' });

    const edits = (await app.db.auditLogs.where('action').equals('edit').toArray()).filter((l) => l.entityType !== 'party');
    const byId = Object.fromEntries(edits.map((l) => [l.entityId, l.reason]));
    expect(byId[sale.id]).toBe('দাম ভুল ছিল');
    expect(byId[pur.id]).toBe('বিল দেখে ঠিক');
    expect(byId[due.id]).toBe('টাইপো'); // trimmed
    expect(byId[exp.id]).toBeNull(); // no reason given → null, same as before AP-6
    await assertLedgerInvariants(app);
  });

  it('the real edit audit entry produces a readable before → after diff', async () => {
    const app = await bootEmptyShop();
    const sale = await app.service.createSale(quick(500));
    await app.service.editSale(sale.id, { ...quick(650), paymentMethod: 'bkash' });
    const log = (await app.db.auditLogs.where('entityId').equals(sale.id).toArray()).find((l) => l.action === 'edit')!;
    const labels = diffAudit(log).map((c) => c.label);
    expect(labels).toEqual(expect.arrayContaining(['মোট', 'জমা', 'মাধ্যম']));
  });
});

describe('detail sheet wiring (static)', () => {
  const detail = read('components/sheets/TransactionDetailSheet.tsx');
  it('plain Bangla: বাতিল / পরিবর্তনের ইতিহাস (no "Void", no "অডিট") anywhere in the UI', () => {
    expect(detail).toMatch(/পরিবর্তনের ইতিহাস/);
    for (const f of ['components/views/LedgerView.tsx', 'components/views/SettingsView.tsx']) expect(read(f), f).not.toMatch(/\(Void\)|অডিট ইতিহাস/);
    expect(detail).not.toMatch(/\(Void\)|অডিট ইতিহাস|বিস্তারিত ও অডিট/);
  });
  it('a failed void shows an error toast (never silent)', () => {
    expect(detail).toMatch(/catch \(err\)[\s\S]{0,200}showToast\([^)]*বাতিল করা যায়নি/);
  });
  it('edits opened from the detail return to it afterwards', () => {
    expect((detail.match(/returnTo: self/g) ?? []).length).toBe(4);
    expect(read('context/JomarkhataContext.tsx')).toMatch(/returnTo;\s*\n\s*if \(back\)/);
  });
  it('every edit form offers the optional reason', () => {
    for (const f of ['SaleFormSheet', 'PurchaseFormSheet', 'ExpenseFormSheet', 'DueEntrySheet']) {
      expect(read(`components/sheets/${f}.tsx`), f).toMatch(/সংশোধনের কারণ \(ঐচ্ছিক\)/);
    }
  });
});
