import type {
  BusinessProfile,
  CurrentBalancesSummary,
  DailyFlowPoint,
  DueTransaction,
  ExpenseRecord,
  HonestProfitSummary,
  MoneyMovement,
  Party,
  PaymentChannel,
  PeriodFlowsSummary,
  PeriodPreset,
  Product,
  PurchaseRecord,
  SaleRecord,
  UnifiedLedgerItem,
} from '@/types/domain';
import { formatBanglaShortDate, getChannelShortLabel, getLocalDateKey } from '@/lib/format';

export interface DateRange {
  start: Date | null;
  end: Date | null;
}

export function getPeriodBounds(preset: PeriodPreset, referenceDate = new Date()): DateRange {
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  if (preset === 'all') {
    return { start: null, end: null };
  }

  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  if (preset === 'today') {
    return { start, end };
  }
  if (preset === 'week') {
    start.setDate(start.getDate() - 6);
    return { start, end };
  }
  if (preset === 'month') {
    start.setDate(1);
    return { start, end };
  }
  if (preset === 'year') {
    start.setMonth(0, 1);
    return { start, end };
  }

  return { start: null, end: null };
}

export function isWithinRange(iso: string, range: DateRange): boolean {
  if (!range.start && !range.end) return true;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (range.start && t < range.start.getTime()) return false;
  if (range.end && t > range.end.getTime()) return false;
  return true;
}

/**
 * ACCOUNTING INVARIANT #1 & #4:
 * Current cumulative balances are ALWAYS computed across ALL TIME from:
 * openingBalances + ALL active moneyMovements (never filtered by period, never double-counted).
 */
export function computeCurrentBalances(
  profile: BusinessProfile | null,
  parties: Party[],
  moneyMovements: MoneyMovement[],
  products: Product[]
): CurrentBalancesSummary {
  const opening = profile?.openingBalances ?? {
    cash: 0,
    bkash: 0,
    nagad: 0,
    bank: 0,
  };

  const channelBalances: Record<PaymentChannel, number> = {
    cash: opening.cash,
    bkash: opening.bkash,
    nagad: opening.nagad,
    bank: opening.bank,
  };

  for (const mm of moneyMovements) {
    if (mm.status !== 'active') continue;
    if (mm.direction === 'in') {
      channelBalances[mm.channel] += mm.amount;
    } else {
      channelBalances[mm.channel] -= mm.amount;
    }
  }

  const cashInHand = channelBalances.cash;
  const digitalAndBankTotal = channelBalances.bkash + channelBalances.nagad + channelBalances.bank;
  const totalLiquidBalance = cashInHand + digitalAndBankTotal;

  let totalReceivables = 0;
  let totalPayables = 0;
  for (const p of parties) {
    if (p.balance > 0) totalReceivables += p.balance;
    else if (p.balance < 0) totalPayables += Math.abs(p.balance);
  }

  let totalStockQty = 0;
  let totalStockValue = 0;
  let lowStockCount = 0;
  for (const prod of products) {
    if (!prod.isActive) continue;
    totalStockQty += prod.stockQty;
    totalStockValue += prod.stockQty * prod.purchasePrice;
    if (prod.stockQty <= prod.lowStockThreshold) {
      lowStockCount += 1;
    }
  }

  return {
    channelBalances,
    cashInHand,
    digitalAndBankTotal,
    totalLiquidBalance,
    totalReceivables,
    totalPayables,
    netDuePosition: totalReceivables - totalPayables,
    totalStockQty,
    totalStockValue,
    lowStockCount,
  };
}

/**
 * ACCOUNTING INVARIANT #1 & #4:
 * Strictly period-scoped flows. All actual money collected/paid reads exclusively from active moneyMovements.
 */
export function computePeriodFlows(
  range: DateRange,
  sales: SaleRecord[],
  purchases: PurchaseRecord[],
  moneyMovements: MoneyMovement[],
  expenses: ExpenseRecord[],
  dueTransactions: DueTransaction[]
): PeriodFlowsSummary {
  let salesRevenue = 0;
  let salesCount = 0;
  for (const s of sales) {
    if (s.status !== 'active' || !isWithinRange(s.date, range)) continue;
    salesRevenue += s.total;
    salesCount += 1;
  }

  let purchasesTotal = 0;
  for (const p of purchases) {
    if (p.status !== 'active' || !isWithinRange(p.date, range)) continue;
    purchasesTotal += p.total;
  }

  let expensesTotal = 0;
  for (const e of expenses) {
    if (e.status !== 'active' || !isWithinRange(e.date, range)) continue;
    expensesTotal += e.amount;
  }

  let salePaymentCollected = 0;
  let customerDueCollected = 0;
  let purchaseAndSupplierPaid = 0;
  let cashInflow = 0;
  let cashOutflow = 0;

  for (const mm of moneyMovements) {
    if (mm.status !== 'active' || !isWithinRange(mm.date, range)) continue;
    if (mm.direction === 'in') {
      if (mm.sourceType === 'sale_payment') salePaymentCollected += mm.amount;
      if (mm.sourceType === 'customer_collection') customerDueCollected += mm.amount;
      if (mm.channel === 'cash') cashInflow += mm.amount;
    } else {
      if (mm.sourceType === 'purchase_payment' || mm.sourceType === 'supplier_payment') {
        purchaseAndSupplierPaid += mm.amount;
      }
      if (mm.channel === 'cash') cashOutflow += mm.amount;
    }
  }

  let newReceivablesAdded = 0;
  let newPayablesAdded = 0;
  for (const d of dueTransactions) {
    if (d.status !== 'active' || !isWithinRange(d.date, range)) continue;
    if (d.source === 'sale' || (d.source === 'manual_due' && d.direction === 'given')) {
      newReceivablesAdded += d.amount;
    } else if (d.source === 'purchase' || (d.source === 'manual_due' && d.direction === 'received')) {
      newPayablesAdded += d.amount;
    }
  }

  return {
    salesRevenue,
    salesCount,
    totalCollected: salePaymentCollected + customerDueCollected,
    salePaymentCollected,
    customerDueCollected,
    cashInflow,
    cashOutflow,
    purchasesTotal,
    purchaseAndSupplierPaid,
    expensesTotal,
    newReceivablesAdded,
    newPayablesAdded,
  };
}

/**
 * ACCOUNTING INVARIANT #3 — HONEST PROFIT CALCULATION:
 * NEVER treat missing item cost (`unitCostSnapshot == null`) as 0 ৳ cost!
 * Computes gross/net profit strictly from costed sales and reports exact completeness metrics.
 */
export function computeHonestProfit(
  range: DateRange,
  sales: SaleRecord[],
  expenses: ExpenseRecord[]
): HonestProfitSummary {
  const activeSales = sales.filter((s) => s.status === 'active' && isWithinRange(s.date, range));
  const operatingExpenses = expenses
    .filter((e) => e.status === 'active' && isWithinRange(e.date, range))
    .reduce((sum, e) => sum + e.amount, 0);

  if (activeSales.length === 0) {
    return {
      completeness: 'no_sales',
      totalSalesCount: 0,
      totalSalesRevenue: 0,
      costedSalesCount: 0,
      costedSalesRevenue: 0,
      uncostedSalesCount: 0,
      uncostedSalesRevenue: 0,
      costCoveragePercent: 0,
      knownCOGS: 0,
      grossProfitOnCostedSales: null,
      operatingExpenses,
      netProfitEstimate: null,
    };
  }

  let totalSalesRevenue = 0;
  let costedSalesCount = 0;
  let costedSalesRevenue = 0;
  let uncostedSalesCount = 0;
  let uncostedSalesRevenue = 0;
  let knownCOGS = 0;

  for (const sale of activeSales) {
    totalSalesRevenue += sale.total;
    const hasItems = sale.items && sale.items.length > 0;
    const allItemsHaveCost =
      hasItems &&
      sale.items.every(
        (item) => typeof item.unitCostSnapshot === 'number' && Number.isFinite(item.unitCostSnapshot) && item.unitCostSnapshot >= 0
      );

    if (allItemsHaveCost) {
      costedSalesCount += 1;
      costedSalesRevenue += sale.total;
      const saleCogs = sale.items.reduce(
        (acc, item) => acc + item.qty * (item.unitCostSnapshot as number),
        0
      );
      knownCOGS += saleCogs;
    } else {
      // Do NOT treat missing cost as 0 ৳ profit — exclude from costed profit and count explicitly!
      uncostedSalesCount += 1;
      uncostedSalesRevenue += sale.total;
    }
  }

  const costCoveragePercent =
    totalSalesRevenue > 0 ? Math.round((costedSalesRevenue / totalSalesRevenue) * 100) : 0;

  if (costedSalesCount === 0) {
    return {
      completeness: 'unavailable',
      totalSalesCount: activeSales.length,
      totalSalesRevenue,
      costedSalesCount: 0,
      costedSalesRevenue: 0,
      uncostedSalesCount,
      uncostedSalesRevenue,
      costCoveragePercent: 0,
      knownCOGS: 0,
      grossProfitOnCostedSales: null,
      operatingExpenses,
      netProfitEstimate: null,
    };
  }

  const grossProfitOnCostedSales = costedSalesRevenue - knownCOGS;
  const netProfitEstimate = grossProfitOnCostedSales - operatingExpenses;

  return {
    completeness: uncostedSalesCount === 0 ? 'complete' : 'partial',
    totalSalesCount: activeSales.length,
    totalSalesRevenue,
    costedSalesCount,
    costedSalesRevenue,
    uncostedSalesCount,
    uncostedSalesRevenue,
    costCoveragePercent,
    knownCOGS,
    grossProfitOnCostedSales,
    operatingExpenses,
    netProfitEstimate,
  };
}

/**
 * Builds canonical unified ledger without double-counting sale/purchase initial payments.
 * Each business event appears once with its true cash/digital impact (`moneyEffect`).
 */
export function buildUnifiedLedger(
  sales: SaleRecord[],
  purchases: PurchaseRecord[],
  dueTransactions: DueTransaction[],
  expenses: ExpenseRecord[],
  parties: Party[]
): UnifiedLedgerItem[] {
  const partyMap = new Map(parties.map((p) => [p.id, p]));
  const items: UnifiedLedgerItem[] = [];

  for (const s of sales) {
    const modeLabel = s.mode === 'quick' ? 'সহজ বিক্রি' : 'পণ্য বিক্রি';
    const paymentLabel =
      s.dueAmount === 0
        ? getChannelShortLabel(s.paymentMethod)
        : s.paidAmount > 0
          ? `আংশিক (${getChannelShortLabel(s.paymentMethod)})`
          : 'সম্পূর্ণ বাকি';

    items.push({
      id: `ledger-sale-${s.id}`,
      sourceType: 'sale',
      sourceId: s.id,
      title: s.partyName || 'নগদ ক্রেতা',
      subtitle: `${modeLabel} · ${s.invoiceNo}${s.description ? ` · ${s.description}` : ''}`,
      partyId: s.partyId,
      partyName: s.partyName,
      amount: s.total,
      moneyEffect: s.status === 'active' ? s.paidAmount : 0,
      paymentMethod: s.paidAmount > 0 ? s.paymentMethod : null,
      status: s.status,
      date: s.date,
      badgeText: paymentLabel,
    });
  }

  for (const p of purchases) {
    const paymentLabel =
      p.dueAmount === 0
        ? getChannelShortLabel(p.paymentMethod)
        : p.paidAmount > 0
          ? `আংশিক (${getChannelShortLabel(p.paymentMethod)})`
          : 'সম্পূর্ণ বাকি';

    items.push({
      id: `ledger-purchase-${p.id}`,
      sourceType: 'purchase',
      sourceId: p.id,
      title: p.partyName || 'নগদ সরবরাহকারী',
      subtitle: `কেনা · ${p.billNo}${p.description ? ` · ${p.description}` : ''}`,
      partyId: p.partyId,
      partyName: p.partyName,
      amount: p.total,
      moneyEffect: p.status === 'active' ? -p.paidAmount : 0,
      paymentMethod: p.paidAmount > 0 ? p.paymentMethod : null,
      status: p.status,
      date: p.date,
      badgeText: paymentLabel,
    });
  }

  // Only include standalone due entries (customer collections, supplier payments, manual due)
  // Sale/purchase linked dues are already represented by their parent sale/purchase record above!
  for (const d of dueTransactions) {
    if (d.source === 'sale' || d.source === 'purchase') continue;
    const party = partyMap.get(d.partyId);
    const pName = party?.name ?? 'অজানা পার্টি';

    if (d.source === 'customer_collection') {
      items.push({
        id: `ledger-due-${d.id}`,
        sourceType: 'customer_collection',
        sourceId: d.id,
        title: pName,
        subtitle: `বাকি আদায় (নিচ্ছি)${d.note ? ` · ${d.note}` : ''}`,
        partyId: d.partyId,
        partyName: pName,
        amount: d.amount,
        moneyEffect: d.status === 'active' ? d.amount : 0,
        paymentMethod: d.paymentMethod ?? 'cash',
        status: d.status,
        date: d.date,
        badgeText: getChannelShortLabel(d.paymentMethod ?? 'cash'),
      });
    } else if (d.source === 'supplier_payment') {
      items.push({
        id: `ledger-due-${d.id}`,
        sourceType: 'supplier_payment',
        sourceId: d.id,
        title: pName,
        subtitle: `সাপ্লায়ার পরিশোধ (দিচ্ছি)${d.note ? ` · ${d.note}` : ''}`,
        partyId: d.partyId,
        partyName: pName,
        amount: d.amount,
        moneyEffect: d.status === 'active' ? -d.amount : 0,
        paymentMethod: d.paymentMethod ?? 'cash',
        status: d.status,
        date: d.date,
        badgeText: getChannelShortLabel(d.paymentMethod ?? 'cash'),
      });
    } else {
      items.push({
        id: `ledger-due-${d.id}`,
        sourceType: 'manual_due',
        sourceId: d.id,
        title: pName,
        subtitle: `${d.direction === 'given' ? 'বাকি দেওয়া' : 'বাকি নেওয়া'}${d.note ? ` · ${d.note}` : ''}`,
        partyId: d.partyId,
        partyName: pName,
        amount: d.amount,
        moneyEffect: 0,
        paymentMethod: null,
        status: d.status,
        date: d.date,
        badgeText: 'বাকি খাতা',
      });
    }
  }

  for (const e of expenses) {
    items.push({
      id: `ledger-expense-${e.id}`,
      sourceType: 'expense',
      sourceId: e.id,
      title: e.title || e.category,
      subtitle: `খরচ · ${e.category}${e.note ? ` · ${e.note}` : ''}`,
      amount: e.amount,
      moneyEffect: e.status === 'active' ? -e.amount : 0,
      paymentMethod: e.paymentMethod,
      status: e.status,
      date: e.date,
      badgeText: getChannelShortLabel(e.paymentMethod),
    });
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Pure helper to recompute a party's chronological running balances & final balance.
 */
export function computePartyRunningTimeline(txns: DueTransaction[]): {
  updatedTxns: DueTransaction[];
  finalBalance: number;
  lastTransactionAt: string | null;
} {
  const sorted = [...txns].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  let running = 0;
  let lastActiveDate: string | null = null;

  const updatedTxns = sorted.map((t) => {
    if (t.status === 'active') {
      running += t.direction === 'given' ? t.amount : -t.amount;
      lastActiveDate = t.date;
    }
    return {
      ...t,
      runningBalance: running,
    };
  });

  return {
    updatedTxns,
    finalBalance: running,
    lastTransactionAt: lastActiveDate,
  };
}

/**
 * Builds last N days comparison points for the single clean bar chart in Reports.
 */
export function computeDailyBarSeries(
  daysCount: number,
  sales: SaleRecord[],
  expenses: ExpenseRecord[],
  moneyMovements: MoneyMovement[]
): DailyFlowPoint[] {
  const points: DailyFlowPoint[] = [];
  const map = new Map<string, DailyFlowPoint>();

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = getLocalDateKey(d.toISOString());
    const pt: DailyFlowPoint = {
      dateKey: key,
      label: formatBanglaShortDate(d.toISOString()),
      sales: 0,
      expenses: 0,
      collected: 0,
    };
    points.push(pt);
    map.set(key, pt);
  }

  for (const s of sales) {
    if (s.status !== 'active') continue;
    const pt = map.get(getLocalDateKey(s.date));
    if (pt) pt.sales += s.total;
  }

  for (const e of expenses) {
    if (e.status !== 'active') continue;
    const pt = map.get(getLocalDateKey(e.date));
    if (pt) pt.expenses += e.amount;
  }

  for (const m of moneyMovements) {
    if (m.status !== 'active' || m.direction !== 'in') continue;
    const pt = map.get(getLocalDateKey(m.date));
    if (pt) pt.collected += m.amount;
  }

  return points;
}
