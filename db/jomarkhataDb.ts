import { trackChanges } from './changeTracker';
import Dexie, { type Table } from 'dexie';
import type {
  AppMetaRecord,
  AuditLog,
  DbMode,
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
/** Demo data lives in its own database (AP-2), so it can never mix with or upload as real data. */
export const JOMARKHATA_DEMO_DB_NAME = 'jomarkhata_demo';
export const JOMARKHATA_DB_VERSION = 3;

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
  appMeta!: Table<AppMetaRecord, string>;

  constructor(name: string = JOMARKHATA_DB_NAME) {
    // S13: Dexie's query cache (for liveQuery, which this app doesn't use) clones every written row.
    // With it off, restoring a 20k-sale khata no longer spends most of its time in the cache.
    super(name, { cache: 'disabled' });

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

    // v2 (AP-3, additive): app metadata only. Every v1 table and index is unchanged.
    // Rule: future versions are additive too, `version(n).stores({...}).upgrade(...)`, never dropping data.
    this.version(2).stores({ appMeta: 'key' });

    // v3 (AP-4, additive): outbox v2. Two new indexes; every existing item is upgraded in place
    // (never dropped). Old items keep all their fields and gain status/opId/retry fields.
    this.version(3)
      .stores({ syncQueue: 'id, entityType, entityId, operation, syncStatus, queuedAt, status, opId' })
      .upgrade(async (tx) => {
        await tx
          .table('syncQueue')
          .toCollection()
          .modify((item: Record<string, unknown>) => Object.assign(item, normalizeOutboxItem(item)));
      });

    // AP-8: remember written keys so a save re-reads only what changed.
    trackChanges(this);
  }
}

/** Fill outbox v2 fields on an older item (used by the v3 upgrade and by backup restore). */
export function normalizeOutboxItem(item: Record<string, unknown>): Partial<SyncQueueItem> {
  let baseRevision: number | null = null;
  try {
    const rev = (JSON.parse(String(item.payload ?? 'null')) as { revision?: unknown } | null)?.revision;
    baseRevision = typeof rev === 'number' ? rev : null;
  } catch {
    baseRevision = null;
  }
  return {
    opId: typeof item.opId === 'string' ? item.opId : String(item.id),
    tenantId: (item.tenantId as string | null | undefined) ?? null,
    baseRevision: (item.baseRevision as number | null | undefined) ?? baseRevision,
    status: (item.status as SyncQueueItem['status'] | undefined) ?? 'pending',
    retryCount: typeof item.retryCount === 'number' ? item.retryCount : 0,
    lastAttemptAt: (item.lastAttemptAt as string | null | undefined) ?? null,
    lastError: (item.lastError as string | null | undefined) ?? null,
    syncStatus: 'pending',
  };
}

let realDb: JomarkhataDB | null = null;
let demoDb: JomarkhataDB | null = null;
let activeMode: DbMode = 'real';

function assertBrowser() {
  if (typeof window === 'undefined') {
    throw new Error('IndexedDB (Dexie) is only available in the browser runtime.');
  }
}

/** The owner's real khata. Also holds `appMeta` (which mode is active, workspace). */
export function getRealDb(): JomarkhataDB {
  assertBrowser();
  if (!realDb) realDb = new JomarkhataDB(JOMARKHATA_DB_NAME);
  return realDb;
}

export function getDemoDb(): JomarkhataDB {
  assertBrowser();
  if (!demoDb) demoDb = new JomarkhataDB(JOMARKHATA_DEMO_DB_NAME);
  return demoDb;
}

/** The database every service read/write uses: real by default, demo only in demo mode. */
export function getJomarkhataDb(): JomarkhataDB {
  return activeMode === 'demo' ? getDemoDb() : getRealDb();
}

export function setActiveDbMode(mode: DbMode) {
  activeMode = mode;
}

export function getActiveDbMode(): DbMode {
  return activeMode;
}
