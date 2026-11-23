/**
 * TEST-ONLY large-data generator (S13, plan 8.2). Never used by the app and never mixed with real
 * data: it builds a backup-format khata that tests restore into an isolated fake IndexedDB, or that
 * the browser performance check restores into a throw-away browser profile.
 *
 * The books are consistent: party balances and running balances match their due rows, cash comes
 * only from money movements, and every product's stock equals the sum of its stock movements.
 */
import type { BackupData } from '@/lib/backup';
import type { DueTransaction, ExpenseRecord, MoneyMovement, Party, Product, SaleRecord, StockMovement } from '@/types/domain';

export interface FixtureSize {
  parties: number;
  sales: number;
  expenses: number;
  /** Extra due rows on one "big" customer (plan: 2,000+ ledger rows on a single party). */
  bigPartyRows: number;
  products?: number;
}

/** Deterministic pseudo-random numbers so every run builds the same khata. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export function buildLargeKhata(size: FixtureSize, seed = 42): BackupData {
  const rand = rng(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const start = Date.parse('2026-01-01T09:00:00Z');
  const span = Date.parse('2026-11-20T18:00:00Z') - start;
  const at = (i: number, n: number) => new Date(start + Math.floor((span * i) / Math.max(1, n))).toISOString();
  const id = (p: string, i: number) => `${p}-${String(i).padStart(6, '0')}`;
  const channels = ['cash', 'cash', 'cash', 'bkash', 'nagad', 'bank'] as const;

  const parties: Party[] = Array.from({ length: size.parties }, (_, i) => ({
    id: id('party', i),
    name: `${i % 2 ? 'মহাজন' : 'কাস্টমার'} ${i + 1}`,
    phone: `017${String(10000000 + i).slice(-8)}`,
    role: i % 2 ? 'supplier' : 'customer',
    balance: 0,
    lastTransactionAt: null,
    createdAt: at(0, 1),
    updatedAt: at(0, 1),
  }));
  const customers = parties.filter((p) => p.role === 'customer');
  const big = customers[0];

  const nProducts = size.products ?? 200;
  const products: Product[] = [];
  const stockMovements: StockMovement[] = [];
  for (let i = 0; i < nProducts; i++) {
    const p: Product = {
      id: id('prod', i), name: `পণ্য ${i + 1}`, category: 'মুদি', unit: 'পিস',
      purchasePrice: 50 + (i % 40), sellingPrice: 60 + (i % 40), stockQty: 0, lowStockThreshold: 5,
      isActive: true, createdAt: at(0, 1), updatedAt: at(0, 1),
    };
    products.push(p);
    stockMovements.push({ id: id('sm-open', i), productId: p.id, productName: p.name, deltaQty: 10_000, reason: 'manual_add', sourceType: 'manual', sourceId: null, date: at(0, 1), createdAt: at(0, 1) });
    p.stockQty = 10_000;
  }

  const sales: SaleRecord[] = [];
  const moneyMovements: MoneyMovement[] = [];
  const dueTransactions: DueTransaction[] = [];
  for (let i = 0; i < size.sales; i++) {
    const date = at(i, size.sales);
    const prod = pick(products);
    const qty = 1 + Math.floor(rand() * 5);
    const total = qty * prod.sellingPrice;
    const onCredit = rand() < 0.3;
    const party = onCredit ? pick(customers) : null;
    const saleId = id('sale', i);
    const sale: SaleRecord = {
      id: saleId, invoiceNo: `INV-${1001 + i}`, mode: 'product', status: 'active',
      partyId: party?.id ?? null, partyName: party?.name ?? 'নগদ ক্রেতা',
      items: [{ productId: prod.id, name: prod.name, unit: prod.unit, qty, unitPrice: prod.sellingPrice, unitCostSnapshot: prod.purchasePrice, lineTotal: total }],
      subtotal: total, discount: 0, total, paidAmount: onCredit ? 0 : total, dueAmount: onCredit ? total : 0,
      paymentMethod: pick([...channels]), moneyMovementId: null, dueTransactionId: null,
      date, revision: 1, createdAt: date, updatedAt: date,
    };
    if (onCredit && party) {
      const d: DueTransaction = { id: id('due-sale', i), partyId: party.id, partyRole: 'customer', direction: 'given', source: 'sale', sourceId: saleId, moneyMovementId: null, paymentMethod: null, amount: total, runningBalance: 0, note: `বিক্রি ${sale.invoiceNo}`, status: 'active', date, revision: 1, createdAt: date, updatedAt: date };
      dueTransactions.push(d);
      sale.dueTransactionId = d.id;
    } else {
      const mm: MoneyMovement = { id: id('mm-sale', i), direction: 'in', channel: sale.paymentMethod, sourceType: 'sale_payment', sourceId: saleId, partyId: null, partyName: sale.partyName, amount: total, status: 'active', date, createdAt: date, updatedAt: date };
      moneyMovements.push(mm);
      sale.moneyMovementId = mm.id;
    }
    stockMovements.push({ id: id('sm-sale', i), productId: prod.id, productName: prod.name, deltaQty: -qty, reason: 'sale', sourceType: 'sale', sourceId: saleId, date, createdAt: date });
    prod.stockQty -= qty;
    sales.push(sale);
  }

  // One big customer with a long ledger (manual dues and collections).
  for (let i = 0; i < size.bigPartyRows; i++) {
    const date = at(i, size.bigPartyRows);
    const collect = i % 3 === 2;
    const amount = 100 + Math.floor(rand() * 900);
    const dueId = id('due-big', i);
    let mmId: string | null = null;
    if (collect) {
      mmId = id('mm-coll', i);
      moneyMovements.push({ id: mmId, direction: 'in', channel: 'cash', sourceType: 'customer_collection', sourceId: dueId, partyId: big.id, partyName: big.name, amount, status: 'active', date, createdAt: date, updatedAt: date });
    }
    dueTransactions.push({ id: dueId, partyId: big.id, partyRole: 'customer', direction: collect ? 'received' : 'given', source: collect ? 'customer_collection' : 'manual_due', sourceId: null, moneyMovementId: mmId, paymentMethod: collect ? 'cash' : null, amount, runningBalance: 0, status: 'active', date, revision: 1, createdAt: date, updatedAt: date });
  }

  const expenses: ExpenseRecord[] = [];
  for (let i = 0; i < size.expenses; i++) {
    const date = at(i, size.expenses);
    const amount = 50 + Math.floor(rand() * 500);
    const mmId = id('mm-exp', i);
    expenses.push({ id: id('exp', i), category: pick(['চা-নাস্তা', 'ভাড়া', 'বিদ্যুৎ বিল', 'পরিবহন']), title: 'খরচ', amount, paymentMethod: 'cash', moneyMovementId: mmId, status: 'active', date, revision: 1, createdAt: date, updatedAt: date });
    moneyMovements.push({ id: mmId, direction: 'out', channel: 'cash', sourceType: 'expense', sourceId: id('exp', i), amount, status: 'active', date, createdAt: date, updatedAt: date });
  }

  // Party balances + running balances from their due rows (oldest first).
  const byParty = new Map<string, DueTransaction[]>();
  for (const d of dueTransactions) byParty.set(d.partyId, [...(byParty.get(d.partyId) ?? []), d]);
  for (const p of parties) {
    const rows = (byParty.get(p.id) ?? []).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let bal = 0;
    for (const r of rows) {
      bal += r.direction === 'given' ? r.amount : -r.amount;
      r.runningBalance = bal;
    }
    p.balance = bal;
    p.lastTransactionAt = rows.at(-1)?.date ?? null;
  }

  const now = new Date().toISOString();
  return {
    businessProfile: {
      id: 'default', shopName: 'বড় খাতা (পরীক্ষা)', ownerName: 'টেস্ট', phone: '', address: '', businessType: 'মুদি দোকান',
      openingBalances: { cash: 100_000, bkash: 0, nagad: 0, bank: 0 }, defaultLowStockThreshold: 5, createdAt: now, updatedAt: now,
    },
    parties, products, sales, purchases: [], moneyMovements, dueTransactions, expenses, stockMovements, auditLogs: [], syncQueue: [],
  };
}
