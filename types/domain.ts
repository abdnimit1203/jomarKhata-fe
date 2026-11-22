/**
 * Shared Domain Types for জমারখাতা (Jomarkhata)
 * Kept framework-agnostic so these contracts can be cleanly mirrored
 * between Jomarkhata FE (Next.js + Dexie) and Jomarkhata BE (Node.js + Express + Mongoose).
 */

export type PaymentChannel = 'cash' | 'bkash' | 'nagad' | 'bank';

export type RecordStatus = 'active' | 'voided';

export type PartyRole = 'customer' | 'supplier';

export type EntryMode = 'quick' | 'product';

export type MoneyDirection = 'in' | 'out';

export type MoneySourceType =
  | 'sale_payment'
  | 'purchase_payment'
  | 'customer_collection'
  | 'supplier_payment'
  | 'expense';

export type DueDirection = 'given' | 'received';

export type DueSourceType =
  | 'sale'
  | 'purchase'
  | 'customer_collection'
  | 'supplier_payment'
  | 'manual_due';

export type StockMovementReason =
  | 'sale'
  | 'purchase'
  | 'edit_adjustment'
  | 'void_reversal'
  | 'manual_add'
  | 'manual_remove';

export type AuditAction = 'create' | 'edit' | 'void' | 'reversal';

export type AuditEntityType =
  | 'sale'
  | 'purchase'
  | 'due_transaction'
  | 'expense'
  | 'product'
  | 'party'
  | 'business_profile';

export type PeriodPreset = 'today' | 'week' | 'month' | 'year' | 'all';

export type ChannelOpeningBalances = Record<PaymentChannel, number>;

export interface BusinessProfile {
  id: string; // singleton 'default'
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
  businessType: string;
  openingBalances: ChannelOpeningBalances;
  defaultLowStockThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  address?: string;
  role: PartyRole;
  /**
   * Canonical cumulative balance computed from all active dueTransactions:
   * Positive (> 0) = Shopkeeper will receive (পাবো)
   * Negative (< 0) = Shopkeeper owes / will pay (দিবো)
   */
  balance: number;
  dueReminderDate?: string | null;
  lastTransactionAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SaleLineItem {
  productId?: string | null;
  name: string;
  unit?: string;
  qty: number;
  unitPrice: number;
  /**
   * Explicit cost per unit snapshot at time of sale.
   * null/undefined means cost is UNKNOWN — NEVER treated as 0 ৳ profit!
   */
  unitCostSnapshot?: number | null;
  lineTotal: number;
}

export interface SaleRecord {
  id: string;
  invoiceNo: string;
  mode: EntryMode;
  status: RecordStatus;
  partyId?: string | null;
  partyName: string;
  description?: string;
  items: SaleLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  /** Display summary of initial payment; canonical money calculations read MoneyMovement */
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentChannel;
  /** Linked canonical MoneyMovement ID (null if paidAmount === 0) */
  moneyMovementId?: string | null;
  /** Linked credit DueTransaction ID (null if dueAmount === 0) */
  dueTransactionId?: string | null;
  note?: string;
  date: string; // ISO string
  revision: number;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseLineItem {
  productId?: string | null;
  name: string;
  unit?: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseRecord {
  id: string;
  billNo: string;
  mode: EntryMode;
  status: RecordStatus;
  partyId?: string | null;
  partyName: string;
  description?: string;
  items: PurchaseLineItem[];
  total: number;
  /** Display summary of initial payment; canonical money calculations read MoneyMovement */
  paidAmount: number;
  dueAmount: number;
  paymentMethod: PaymentChannel;
  moneyMovementId?: string | null;
  dueTransactionId?: string | null;
  note?: string;
  date: string;
  revision: number;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * SINGLE SOURCE OF TRUTH FOR ALL ACTUAL MONEY MOVEMENTS.
 * Every Taka entering or leaving cash/bKash/Nagad/bank exists as exactly ONE MoneyMovement.
 */
export interface MoneyMovement {
  id: string;
  direction: MoneyDirection;
  channel: PaymentChannel;
  sourceType: MoneySourceType;
  sourceId: string;
  partyId?: string | null;
  partyName?: string;
  amount: number;
  note?: string;
  status: RecordStatus;
  date: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Party credit & settlement ledger row.
 * direction === 'given' (দিয়েছি): increases receivable / reduces payable (+amount to party.balance)
 * direction === 'received' (নিয়েছি): reduces receivable / increases payable (-amount to party.balance)
 */
export interface DueTransaction {
  id: string;
  partyId: string;
  partyRole: PartyRole;
  direction: DueDirection;
  source: DueSourceType;
  sourceId?: string | null;
  /** Present ONLY when actual money moved (collection or supplier payment). Null for credit sale/purchase or manual due. */
  moneyMovementId?: string | null;
  paymentMethod?: PaymentChannel | null;
  amount: number;
  runningBalance: number;
  note?: string;
  status: RecordStatus;
  date: string;
  revision: number;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseRecord {
  id: string;
  category: string;
  title: string;
  amount: number;
  paymentMethod: PaymentChannel;
  moneyMovementId: string;
  note?: string;
  status: RecordStatus;
  date: string;
  revision: number;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  deltaQty: number;
  reason: StockMovementReason;
  sourceType: 'sale' | 'purchase' | 'manual';
  sourceId?: string | null;
  note?: string;
  date: string;
  createdAt: string;
}

/**
 * Append-only audit log for financial & inventory actions.
 * Never mutated or deleted during normal operations.
 */
export interface AuditLog {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  summary: string;
  beforeSnapshot?: string | null;
  afterSnapshot?: string | null;
  reason?: string | null;
  timestamp: string;
}

/**
 * Local-only offline mutation outbox ready for future Jomarkhata BE sync.
 * Phase 1 records pending mutations locally; no mock cloud sync is performed.
 */
export interface SyncQueueItem {
  id: string;
  entityType: AuditEntityType | 'money_movement' | 'stock_movement';
  entityId: string;
  operation: 'upsert' | 'void';
  payload: string;
  queuedAt: string;
  syncStatus: 'pending';
}

// ============================================================================
// Pure Domain Calculation Output Types (Flows vs. Balances vs. Honest Profit)
// ============================================================================

export interface CurrentBalancesSummary {
  /** Cumulative all-time balances per channel = opening + all active in - all active out */
  channelBalances: Record<PaymentChannel, number>;
  /** All-time physical cash in shop drawer (channelBalances.cash) */
  cashInHand: number;
  /** Sum of bKash + Nagad + Bank cumulative balances */
  digitalAndBankTotal: number;
  /** Sum of all 4 channels */
  totalLiquidBalance: number;
  /** Current cumulative customer/party receivables (sum of positive balances) */
  totalReceivables: number;
  /** Current cumulative supplier/party payables (sum of abs negative balances) */
  totalPayables: number;
  /** Net receivable minus payable */
  netDuePosition: number;
  /** Active inventory total stock count & purchase-cost valuation */
  totalStockQty: number;
  totalStockValue: number;
  lowStockCount: number;
}

export interface PeriodFlowsSummary {
  /** Total revenue from active sales in period (cash + credit) */
  salesRevenue: number;
  salesCount: number;
  /** Actual money received in period from active moneyMovements (sale_payment + customer_collection) */
  totalCollected: number;
  salePaymentCollected: number;
  customerDueCollected: number;
  /** Cash-only inflows and outflows in period (for daily cashflow transparency) */
  cashInflow: number;
  cashOutflow: number;
  /** Total value of active purchases in period */
  purchasesTotal: number;
  /** Actual money paid out in period for purchases & supplier payables */
  purchaseAndSupplierPaid: number;
  /** Active operating expenses in period */
  expensesTotal: number;
  /** New credit given / taken during period */
  newReceivablesAdded: number;
  newPayablesAdded: number;
}

export type ProfitCompletenessStatus =
  | 'no_sales'
  | 'complete'
  | 'partial'
  | 'unavailable';

export interface HonestProfitSummary {
  completeness: ProfitCompletenessStatus;
  totalSalesCount: number;
  totalSalesRevenue: number;
  costedSalesCount: number;
  costedSalesRevenue: number;
  uncostedSalesCount: number;
  uncostedSalesRevenue: number;
  /** Percentage (0–100) of sales revenue covered by known purchase cost */
  costCoveragePercent: number;
  /** Sum of qty * unitCostSnapshot strictly for lines with known cost */
  knownCOGS: number;
  /** Strictly costedSalesRevenue - knownCOGS (null if no costed sales exist) */
  grossProfitOnCostedSales: number | null;
  /** Operating expenses in the period */
  operatingExpenses: number;
  /** grossProfitOnCostedSales - operatingExpenses (null if no costed sales exist) */
  netProfitEstimate: number | null;
}

export interface UnifiedLedgerItem {
  id: string;
  sourceType: 'sale' | 'purchase' | 'customer_collection' | 'supplier_payment' | 'manual_due' | 'expense';
  sourceId: string;
  title: string;
  subtitle: string;
  partyId?: string | null;
  partyName?: string;
  /** Primary display amount (e.g. sale total, expense amount, collection amount) */
  amount: number;
  /** Actual cash/digital impact of this entry (+ for in, - for out, 0 for pure credit) */
  moneyEffect: number;
  paymentMethod?: PaymentChannel | null;
  status: RecordStatus;
  date: string;
  badgeText?: string;
}

export interface DailyFlowPoint {
  dateKey: string;
  label: string;
  sales: number;
  expenses: number;
  collected: number;
}

export type AppRoute =
  | 'dashboard'
  | 'sales'
  | 'purchases'
  | 'dues'
  | 'ledger'
  | 'cash'
  | 'stock'
  | 'reports'
  | 'settings';
