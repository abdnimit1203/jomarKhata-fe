import Dexie, { type Table } from 'dexie';
import type {
  AuditLog,
  BusinessProfile,
  DueTransaction,
  ExpenseRecord,
  MoneyMovement,
  Party,
  Product,
  PurchaseRecord,
  SaleRecord,
  StockMovement,
  SyncQueueItem,
} from '@/types/domain';

export const JOMARKHATA_DB_NAME = 'jomarkhata_db';
export const JOMARKHATA_DB_VERSION = 1;

/**
 * Versioned Dexie + IndexedDB Database for জমারখাতা (Jomarkhata).
 * - Uses stable UUID record IDs across all tables for future offline-first sync with Jomarkhata BE.
 * - `moneyMovements` is the single source of truth for all cash/bKash/Nagad/bank inflows and outflows.
 * - `auditLogs` is append-only at the application layer.
 * - `syncQueue` records pending local mutations for future backend sync (strictly local in Phase 1).
 */
export class JomarkhataDB extends Dexie {
  businessProfile!: Table<BusinessProfile, string>;
  parties!: Table<Party, string>;
  products!: Table<Product, string>;
  sales!: Table<SaleRecord, string>;
  purchases!: Table<PurchaseRecord, string>;
  moneyMovements!: Table<MoneyMovement, string>;
  dueTransactions!: Table<DueTransaction, string>;
  expenses!: Table<ExpenseRecord, string>;
  stockMovements!: Table<StockMovement, string>;
  auditLogs!: Table<AuditLog, string>;
  syncQueue!: Table<SyncQueueItem, string>;

  constructor() {
    super(JOMARKHATA_DB_NAME);

    this.version(1).stores({
      businessProfile: 'id',
      parties: 'id, role, name, phone, balance, lastTransactionAt',
      products: 'id, name, category, stockQty, isActive',
      sales: 'id, invoiceNo, mode, status, partyId, date, paymentMethod, moneyMovementId, dueTransactionId',
      purchases: 'id, billNo, mode, status, partyId, date, paymentMethod, moneyMovementId, dueTransactionId',
      moneyMovements: 'id, direction, channel, sourceType, sourceId, partyId, status, date',
      dueTransactions: 'id, partyId, partyRole, direction, source, sourceId, moneyMovementId, status, date',
      expenses: 'id, category, paymentMethod, moneyMovementId, status, date',
      stockMovements: 'id, productId, reason, sourceType, sourceId, date',
      auditLogs: 'id, entityType, entityId, action, timestamp',
      syncQueue: 'id, entityType, entityId, operation, syncStatus, queuedAt',
    });

    /**
     * Future Migration Pattern:
     * When upgrading to version(2), declare `.version(2).stores({ ... }).upgrade(tx => { ... })`
     * so existing shopkeeper IndexedDB data upgrades safely without data loss.
     */
  }
}

let dbInstance: JomarkhataDB | null = null;

export function getJomarkhataDb(): JomarkhataDB {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB (Dexie) is only available in the browser runtime.');
  }
  if (!dbInstance) {
    dbInstance = new JomarkhataDB();
  }
  return dbInstance;
}
