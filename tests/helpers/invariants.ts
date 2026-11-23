/**
 * Cross-table accounting invariants (see jomarKhata-fe/ARCHITECTURE.md §2).
 * Run after any scenario to prove the ledger is internally consistent.
 */
import { expect } from 'vitest';
import type { App } from './app';

export async function assertLedgerInvariants(app: App, options: { checkStock?: boolean } = {}) {
  const s = await app.service.loadAllData();

  // Party balance == signed sum of its ACTIVE due transactions; last running balance agrees.
  for (const p of s.parties) {
    const dues = s.dueTransactions.filter((d) => d.partyId === p.id);
    const sum = dues
      .filter((d) => d.status === 'active')
      .reduce((acc, d) => acc + (d.direction === 'given' ? d.amount : -d.amount), 0);
    expect(p.balance, `balance of ${p.name}`).toBe(sum);
  }

  // Sales: one active money movement iff paid > 0, one active credit due iff due > 0.
  for (const sale of s.sales) {
    expect(sale.total, `sale ${sale.invoiceNo} total`).toBe(sale.paidAmount + sale.dueAmount);
    const mms = s.moneyMovements.filter((m) => m.sourceId === sale.id && m.status === 'active');
    const dues = s.dueTransactions.filter((d) => d.sourceId === sale.id && d.status === 'active');
    if (sale.status === 'active' && sale.paidAmount > 0) {
      expect(mms, `sale ${sale.invoiceNo} money movement`).toHaveLength(1);
      expect(mms[0].direction).toBe('in');
      expect(mms[0].amount).toBe(sale.paidAmount);
      expect(mms[0].id).toBe(sale.moneyMovementId);
    } else {
      expect(mms, `sale ${sale.invoiceNo} must have no active money movement`).toHaveLength(0);
    }
    if (sale.status === 'active' && sale.dueAmount > 0) {
      expect(sale.partyId, `credit sale ${sale.invoiceNo} needs a party`).toBeTruthy();
      expect(dues).toHaveLength(1);
      expect(dues[0].amount).toBe(sale.dueAmount);
      expect(dues[0].direction).toBe('given');
    } else {
      expect(dues, `sale ${sale.invoiceNo} must have no active due`).toHaveLength(0);
    }
  }

  // Purchases: mirror of sales with money OUT and due RECEIVED.
  for (const pur of s.purchases) {
    expect(pur.total, `purchase ${pur.billNo} total`).toBe(pur.paidAmount + pur.dueAmount);
    const mms = s.moneyMovements.filter((m) => m.sourceId === pur.id && m.status === 'active');
    const dues = s.dueTransactions.filter((d) => d.sourceId === pur.id && d.status === 'active');
    if (pur.status === 'active' && pur.paidAmount > 0) {
      expect(mms).toHaveLength(1);
      expect(mms[0].direction).toBe('out');
      expect(mms[0].amount).toBe(pur.paidAmount);
    } else {
      expect(mms).toHaveLength(0);
    }
    if (pur.status === 'active' && pur.dueAmount > 0) {
      expect(pur.partyId).toBeTruthy();
      expect(dues).toHaveLength(1);
      expect(dues[0].amount).toBe(pur.dueAmount);
      expect(dues[0].direction).toBe('received');
    } else {
      expect(dues).toHaveLength(0);
    }
  }

  // Expenses: exactly one OUT money movement whose status follows the expense.
  for (const exp of s.expenses) {
    const mm = s.moneyMovements.find((m) => m.id === exp.moneyMovementId);
    expect(mm, `expense ${exp.title} money movement`).toBeDefined();
    expect(mm!.direction).toBe('out');
    expect(mm!.amount).toBe(exp.amount);
    expect(mm!.status).toBe(exp.status);
  }

  // Money-bearing due entries (collections / supplier payments) mirror their money movement.
  for (const d of s.dueTransactions) {
    if (!d.moneyMovementId) continue;
    const mm = s.moneyMovements.find((m) => m.id === d.moneyMovementId);
    expect(mm, `due ${d.id} money movement`).toBeDefined();
    expect(mm!.amount).toBe(d.amount);
    expect(mm!.status).toBe(d.status);
  }

  // Every active money movement has a live source record (no orphan cash).
  for (const mm of s.moneyMovements.filter((m) => m.status === 'active')) {
    const exists =
      s.sales.some((x) => x.id === mm.sourceId && x.status === 'active') ||
      s.purchases.some((x) => x.id === mm.sourceId && x.status === 'active') ||
      s.expenses.some((x) => x.id === mm.sourceId && x.status === 'active') ||
      s.dueTransactions.some((x) => x.id === mm.sourceId && x.status === 'active');
    expect(exists, `money movement ${mm.id} (${mm.sourceType}) has an active source`).toBe(true);
  }

  // Stock quantity == sum of its stock movements. Always on since AP-9 (no clamping at 0).
  if (options.checkStock !== false) {
    for (const prod of s.products) {
      const sum = s.stockMovements
        .filter((m) => m.productId === prod.id)
        .reduce((acc, m) => acc + m.deltaQty, 0);
      expect(prod.stockQty, `stock of ${prod.name}`).toBe(sum);
    }
  }

  return s;
}
