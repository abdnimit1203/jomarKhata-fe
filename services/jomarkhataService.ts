import {
  getActiveDbMode,
  getDemoDb,
  getJomarkhataDb,
  getRealDb,
  normalizeOutboxItem,
  setActiveDbMode,
  type JomarkhataDB,
} from '@/db/jomarkhataDb';
import { buildSeedDataset } from '@/db/seedData';
import { takeChanges } from '@/db/changeTracker';
import { mergeRows } from '@/lib/snapshot-merge';
import { BACKUP_TABLES, buildBackupFile, parseBackup, type BackupData, type BackupPreview } from '@/lib/backup';
import { JOMARKHATA_DB_VERSION } from '@/db/jomarkhataDb';
import { timed } from '@/lib/perf';
import type { AuthUser } from '@/lib/auth';
import type { CachedSubscription } from '@/lib/access-policy';
import { computePartyRunningTimeline } from '@/services/financeCalculator';
import { formatTaka, generateId } from '@/lib/format';
import type {
  AuditAction,
  AuditEntityType,
  AuditLog,
  BusinessProfile,
  ChannelOpeningBalances,
  DbMode,
  WorkspaceMeta,
  DueDirection,
  DueTransaction,
  EntryMode,
  ExpenseRecord,
  MoneyMovement,
  Party,
  PartyRole,
  PaymentChannel,
  Product,
  PurchaseLineItem,
  PurchaseRecord,
  SaleLineItem,
  SaleRecord,
  StockMovement,
  SyncQueueItem,
} from '@/types/domain';

export interface AppDataSnapshot {
  businessProfile: BusinessProfile;
  parties: Party[];
  products: Product[];
  sales: SaleRecord[];
  purchases: PurchaseRecord[];
  moneyMovements: MoneyMovement[];
  dueTransactions: DueTransaction[];
  expenses: ExpenseRecord[];
  stockMovements: StockMovement[];
  auditLogs: AuditLog[];
  pendingSyncCount: number;
}

/** AP-8: list tables in a snapshot and how a full read orders them (null = id order). */
const SNAPSHOT_TABLES = {
  parties: null,
  products: null,
  sales: 'date',
  purchases: 'date',
  moneyMovements: 'date',
  dueTransactions: 'date',
  expenses: 'date',
  stockMovements: 'date',
  auditLogs: 'timestamp',
} as const;
type SnapshotTable = keyof typeof SNAPSHOT_TABLES;

/** The last snapshot handed to the app and the database it came from (AP-8). */
let lastLoaded: { db: JomarkhataDB; snap: AppDataSnapshot } | null = null;

/** What the app shows at startup (S3). Decided by reading only; startup never writes. */
export type StartupPhase = 'welcome' | 'legacy_choice' | 'ready';

export interface StartupState {
  phase: StartupPhase;
  mode: DbMode;
  snapshot: AppDataSnapshot | null;
}

export interface NewShopInput {
  shopName: string;
  ownerName: string;
  phone: string;
  address?: string;
  businessType: string;
  openingBalances: ChannelOpeningBalances;
}

/** Bangladesh mobile: 01[3-9] + 8 digits (Bengali digits accepted). Empty is allowed. */
export function isValidBdMobile(phone: string): boolean {
  const ascii = phone.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[\s-]/g, '');
  return ascii === '' || /^(\+?88)?01[3-9]\d{8}$/.test(ascii);
}

/** Every table that holds shop records (everything except appMeta). */
function shopTables(db: JomarkhataDB) {
  return [
    db.businessProfile,
    db.parties,
    db.products,
    db.sales,
    db.purchases,
    db.moneyMovements,
    db.dueTransactions,
    db.expenses,
    db.stockMovements,
    db.auditLogs,
    db.syncQueue,
  ];
}

async function getMeta<T>(db: JomarkhataDB, key: string): Promise<T | undefined> {
  return (await db.appMeta.get(key))?.value as T | undefined;
}

async function setMeta(db: JomarkhataDB, key: string, value: unknown) {
  await db.appMeta.put({ key, value, updatedAt: new Date().toISOString() });
}

export interface CreateSaleInput {
  mode: EntryMode;
  partyId?: string | null;
  description?: string;
  items: SaleLineItem[];
  discount?: number;
  paidAmount: number;
  paymentMethod: PaymentChannel;
  note?: string;
  date?: string;
}

export interface CreatePurchaseInput {
  mode: EntryMode;
  partyId?: string | null;
  description?: string;
  items: PurchaseLineItem[];
  paidAmount: number;
  paymentMethod: PaymentChannel;
  note?: string;
  date?: string;
}

export interface RecordDueEntryInput {
  partyId: string;
  /**
   * 'customer_collection': customer pays us (direction: 'received', creates IN MoneyMovement)
   * 'supplier_payment': we pay supplier (direction: 'given', creates OUT MoneyMovement)
   * 'manual_due_given': add manual receivable / due given (no cash moved)
   * 'manual_due_received': add manual payable / due taken (no cash moved)
   */
  entryType: 'customer_collection' | 'supplier_payment' | 'manual_due_given' | 'manual_due_received';
  amount: number;
  paymentMethod?: PaymentChannel;
  note?: string;
  date?: string;
}

export interface CreateExpenseInput {
  category: string;
  title: string;
  amount: number;
  paymentMethod: PaymentChannel;
  note?: string;
  date?: string;
}

async function appendAuditLog(
  db: JomarkhataDB,
  params: {
    entityType: AuditEntityType;
    entityId: string;
    action: AuditAction;
    summary: string;
    beforeSnapshot?: unknown;
    afterSnapshot?: unknown;
    reason?: string | null;
  }
): Promise<void> {
  const entry: AuditLog = {
    id: generateId(),
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    summary: params.summary,
    beforeSnapshot: params.beforeSnapshot ? JSON.stringify(params.beforeSnapshot) : null,
    afterSnapshot: params.afterSnapshot ? JSON.stringify(params.afterSnapshot) : null,
    reason: params.reason ?? null,
    timestamp: new Date().toISOString(),
  };
  await db.auditLogs.add(entry);
}

async function enqueueSyncMutation(
  db: JomarkhataDB,
  entityType: SyncQueueItem['entityType'],
  entityId: string,
  operation: 'upsert' | 'void',
  payload: unknown
): Promise<void> {
  const id = generateId();
  const rev = (payload as { revision?: unknown } | null)?.revision;
  await db.syncQueue.add({
    id,
    entityType,
    entityId,
    operation,
    payload: JSON.stringify(payload),
    queuedAt: new Date().toISOString(),
    syncStatus: 'pending',
    opId: id,
    tenantId: null,
    baseRevision: typeof rev === 'number' ? rev : null,
    status: 'pending',
    retryCount: 0,
    lastAttemptAt: null,
    lastError: null,
  });
}

/**
 * AP-4: a void also changes linked rows (money movement, due, stock reversal, product, party).
 * Each of those gets its own outbox op, so the server can replay the void exactly.
 */
async function queueLinkedVoidChanges(
  db: JomarkhataDB,
  link: {
    moneyMovementId?: string | null;
    dueTransactionId?: string | null;
    partyId?: string | null;
    sourceId: string;
    at: string;
    /** Only sales/purchases reverse stock (and their transactions include the stock tables). */
    stock?: boolean;
  }
): Promise<void> {
  if (link.moneyMovementId) {
    const mm = await db.moneyMovements.get(link.moneyMovementId);
    if (mm) await enqueueSyncMutation(db, 'money_movement', mm.id, 'void', mm);
  }
  if (link.dueTransactionId) {
    const due = await db.dueTransactions.get(link.dueTransactionId);
    if (due) await enqueueSyncMutation(db, 'due_transaction', due.id, 'void', due);
  }
  if (link.partyId) {
    const party = await db.parties.get(link.partyId);
    if (party) await enqueueSyncMutation(db, 'party', party.id, 'upsert', party);
  }
  if (!link.stock) return;
  const reversals = (await db.stockMovements.where('sourceId').equals(link.sourceId).toArray()).filter(
    (m) => m.reason === 'void_reversal' && m.createdAt === link.at
  );
  for (const sm of reversals) {
    await enqueueSyncMutation(db, 'stock_movement', sm.id, 'upsert', sm);
    const prod = await db.products.get(sm.productId);
    if (prod) await enqueueSyncMutation(db, 'product', prod.id, 'upsert', prod);
  }
}

/**
 * Deterministically recomputes all running balances and current cumulative balance
 * for a given party inside an active Dexie transaction.
 */
async function recomputePartyBalanceTx(db: JomarkhataDB, partyId: string): Promise<void> {
  const party = await db.parties.get(partyId);
  if (!party) return;

  const partyTxns = await db.dueTransactions.where('partyId').equals(partyId).toArray();
  const { updatedTxns, finalBalance, lastTransactionAt } = computePartyRunningTimeline(partyTxns);

  if (updatedTxns.length > 0) {
    await db.dueTransactions.bulkPut(updatedTxns);
  }

  await db.parties.update(partyId, {
    balance: finalBalance,
    lastTransactionAt,
    updatedAt: new Date().toISOString(),
  });
}

async function nextInvoiceNumber(db: JomarkhataDB, prefix: 'INV' | 'BILL'): Promise<string> {
  const count = prefix === 'INV' ? await db.sales.count() : await db.purchases.count();
  return `${prefix}-${1001 + count}`;
}

/**
 * Domain Service Layer — ALL business rules, validations, stock updates,
 * canonical moneyMovements links, credit-party guards, and append-only audit logs
 * live strictly here inside atomic Dexie transactions.
 */
export const jomarkhataService = {
  /**
   * Startup (S3, AP-1). READ-ONLY: decides what to show and never writes, seeds or deletes.
   * - welcome: no shop yet on this device.
   * - legacy_choice: an older build left data here (no workspace record). The owner decides
   *   whether it's demo or their real khata (D15). Nothing is changed until they choose.
   * - ready: real khata, or demo mode.
   */
  async bootstrap(): Promise<StartupState> {
    const real = getRealDb();
    const prefs = await getMeta<{ activeMode?: DbMode }>(real, 'prefs');
    if (prefs?.activeMode === 'demo') {
      setActiveDbMode('demo');
      const demo = getDemoDb();
      if (!(await demo.businessProfile.get('default'))) await this.seedDatabase(demo); // demo DB only
      return { phase: 'ready', mode: 'demo', snapshot: await this.loadAllData() };
    }
    setActiveDbMode('real');
    if (!(await real.businessProfile.get('default'))) return { phase: 'welcome', mode: 'real', snapshot: null };
    const workspace = await getMeta<WorkspaceMeta>(real, 'workspace');
    return { phase: workspace ? 'ready' : 'legacy_choice', mode: 'real', snapshot: await this.loadAllData() };
  },

  /** Loads the active database. Kept for existing callers; it no longer auto-seeds (AP-1). */
  async initializeAndLoad(): Promise<AppDataSnapshot> {
    return this.loadAllData();
  },

  /** Start the owner's real khata from the setup form (empty khata, D3). */
  async createShop(input: NewShopInput): Promise<AppDataSnapshot> {
    const db = getRealDb();
    const shopName = input.shopName.trim();
    if (!shopName) throw new Error('দোকানের নাম লিখুন।');
    if (!isValidBdMobile(input.phone)) throw new Error('সঠিক মোবাইল নম্বর লিখুন (যেমন 01712345678)।');
    const now = new Date().toISOString();
    const profile: BusinessProfile = {
      id: 'default',
      shopName,
      ownerName: input.ownerName.trim(),
      phone: input.phone.trim(),
      address: (input.address ?? '').trim(),
      businessType: input.businessType.trim() || 'সাধারণ খুচরা',
      openingBalances: {
        cash: Math.max(0, Math.round(input.openingBalances.cash || 0)),
        bkash: Math.max(0, Math.round(input.openingBalances.bkash || 0)),
        nagad: Math.max(0, Math.round(input.openingBalances.nagad || 0)),
        bank: Math.max(0, Math.round(input.openingBalances.bank || 0)),
      },
      defaultLowStockThreshold: 5,
      createdAt: now,
      updatedAt: now,
    };
    await db.transaction('rw', [db.businessProfile, db.appMeta, db.auditLogs, db.syncQueue], async () => {
      if (await db.businessProfile.get('default')) throw new Error('এই ফোনে আগেই একটি দোকানের খাতা আছে।');
      await db.businessProfile.put(profile);
      const workspace: WorkspaceMeta = { workspaceId: generateId(), createdAt: now, origin: 'setup' };
      await setMeta(db, 'workspace', workspace);
      await setMeta(db, 'prefs', { activeMode: 'real' });
      await appendAuditLog(db, {
        entityType: 'business_profile',
        entityId: 'default',
        action: 'create',
        summary: `নতুন খাতা শুরু: ${profile.shopName}`,
        beforeSnapshot: null,
        afterSnapshot: profile,
      });
      await enqueueSyncMutation(db, 'business_profile', 'default', 'upsert', profile);
    });
    setActiveDbMode('real');
    return this.loadAllData();
  },

  /** D15 choice 1: the data an older build left here is the owner's real khata. Data unchanged. */
  async keepLegacyAsMine(): Promise<AppDataSnapshot> {
    const db = getRealDb();
    await db.transaction('rw', [db.appMeta], async () => {
      if (!(await getMeta(db, 'workspace'))) {
        const workspace: WorkspaceMeta = { workspaceId: generateId(), createdAt: new Date().toISOString(), origin: 'legacy' };
        await setMeta(db, 'workspace', workspace);
      }
      await setMeta(db, 'prefs', { activeMode: 'real' });
    });
    setActiveDbMode('real');
    return this.loadAllData();
  },

  /**
   * D15 choice 2: the data an older build left here was only demo. It is MOVED (never just deleted)
   * into the demo database: copied, verified row-for-row, and only then cleared from the real one.
   */
  async moveLegacyToDemo(): Promise<void> {
    const real = getRealDb();
    const demo = getDemoDb();
    if (await getMeta(real, 'workspace')) throw new Error('এই খাতাটি আপনার আসল খাতা হিসেবে চিহ্নিত, তাই সরানো যাবে না।');
    const tables = shopTables(real).filter((t) => t.name !== 'syncQueue'); // demo never syncs
    const copy: Record<string, unknown[]> = {};
    for (const t of tables) copy[t.name] = await t.toArray();

    await demo.transaction('rw', shopTables(demo), async () => {
      for (const t of shopTables(demo)) await t.clear();
      for (const t of tables) await demo.table(t.name).bulkPut(copy[t.name]);
    });
    for (const t of tables) {
      const n = await demo.table(t.name).count();
      if (n !== copy[t.name].length) throw new Error('ডেমোতে সরানো যাচাই করা যায়নি; কিছুই মোছা হয়নি।');
    }
    await real.transaction('rw', shopTables(real), async () => {
      for (const t of shopTables(real)) await t.clear();
    });
  },

  /** Open the demo khata (its own database). The real khata is untouched. */
  async enterDemo(): Promise<AppDataSnapshot> {
    const real = getRealDb();
    await setMeta(real, 'prefs', { activeMode: 'demo' });
    setActiveDbMode('demo');
    const demo = getDemoDb();
    if (!(await demo.businessProfile.get('default'))) await this.seedDatabase(demo);
    return this.loadAllData();
  },

  /** Leave demo mode and go back to the real khata (or the welcome screen if there is none yet). */
  async exitDemo(): Promise<StartupState> {
    await setMeta(getRealDb(), 'prefs', { activeMode: 'real' });
    setActiveDbMode('real');
    return this.bootstrap();
  },

  async seedDatabase(db: JomarkhataDB): Promise<void> {
    const seed = buildSeedDataset();
    await db.transaction(
      'rw',
      [
        db.businessProfile,
        db.parties,
        db.products,
        db.sales,
        db.purchases,
        db.moneyMovements,
        db.dueTransactions,
        db.expenses,
        db.stockMovements,
        db.auditLogs,
        db.syncQueue,
      ],
      async () => {
        await db.businessProfile.put(seed.businessProfile);
        await db.parties.bulkPut(seed.parties);
        await db.products.bulkPut(seed.products);
        await db.sales.bulkPut(seed.sales);
        await db.purchases.bulkPut(seed.purchases);
        await db.moneyMovements.bulkPut(seed.moneyMovements);
        await db.dueTransactions.bulkPut(seed.dueTransactions);
        await db.expenses.bulkPut(seed.expenses);
        await db.stockMovements.bulkPut(seed.stockMovements);
        await db.auditLogs.bulkPut(seed.auditLogs);
      }
    );
  },

  /** Reset the DEMO khata only. Refuses in the real khata (fixes the old wipe-everything risk). */
  async resetDemoData(): Promise<AppDataSnapshot> {
    if (getActiveDbMode() !== 'demo') throw new Error('আসল খাতায় ডেমো রিসেট করা যায় না।');
    const db = getDemoDb();
    await db.transaction(
      'rw',
      [
        db.businessProfile,
        db.parties,
        db.products,
        db.sales,
        db.purchases,
        db.moneyMovements,
        db.dueTransactions,
        db.expenses,
        db.stockMovements,
        db.auditLogs,
        db.syncQueue,
      ],
      async () => {
        await Promise.all([
          db.businessProfile.clear(),
          db.parties.clear(),
          db.products.clear(),
          db.sales.clear(),
          db.purchases.clear(),
          db.moneyMovements.clear(),
          db.dueTransactions.clear(),
          db.expenses.clear(),
          db.stockMovements.clear(),
          db.auditLogs.clear(),
          db.syncQueue.clear(),
        ]);
      }
    );
    await this.seedDatabase(db);
    return this.loadAllData();
  },

  async loadAllData(): Promise<AppDataSnapshot> {
    const db = getJomarkhataDb();
    lastLoaded = null;
    takeChanges(db); // start a fresh change list BEFORE reading (see db/changeTracker.ts)
    const [
      businessProfile,
      parties,
      products,
      sales,
      purchases,
      moneyMovements,
      dueTransactions,
      expenses,
      stockMovements,
      auditLogs,
      pendingSyncCount,
    ] = await Promise.all([
      db.businessProfile.get('default'),
      db.parties.toArray(),
      db.products.toArray(),
      db.sales.orderBy('date').reverse().toArray(),
      db.purchases.orderBy('date').reverse().toArray(),
      db.moneyMovements.orderBy('date').reverse().toArray(),
      db.dueTransactions.orderBy('date').reverse().toArray(),
      db.expenses.orderBy('date').reverse().toArray(),
      db.stockMovements.orderBy('date').reverse().toArray(),
      db.auditLogs.orderBy('timestamp').reverse().toArray(),
      db.syncQueue.where('status').noneOf(['synced']).count(),
    ]);

    if (!businessProfile) {
      throw new Error('বিজনেস প্রোফাইল লোড করা যায়নি।');
    }

    const snap: AppDataSnapshot = {
      businessProfile,
      parties,
      products,
      sales,
      purchases,
      moneyMovements,
      dueTransactions,
      expenses,
      stockMovements,
      auditLogs,
      pendingSyncCount,
    };
    lastLoaded = { db, snap };
    return snap;
  },

  /**
   * AP-8: the refresh after a save. Re-reads only the rows written since the last load and merges
   * them into the previous snapshot. The result equals `loadAllData()` (tests compare the two after
   * every kind of write). Unchanged tables keep their array, so screens that depend on them don't
   * recompute. Falls back to a full read after a khata switch, a range delete/clear, or anything
   * it can't merge.
   */
  async loadChanges(): Promise<AppDataSnapshot> {
    const db = getJomarkhataDb();
    const prev = lastLoaded;
    if (!prev || prev.db !== db) return this.loadAllData();
    lastLoaded = null; // until this refresh succeeds, the next one is a full read
    const changes = takeChanges(db);
    if (changes.whole.size > 0) return this.loadAllData();

    const next: AppDataSnapshot = { ...prev.snap };
    const tables = (Object.keys(SNAPSHOT_TABLES) as SnapshotTable[]).filter((t) => changes.keys.has(t));
    const [businessProfile, pendingSyncCount, ...fresh] = await Promise.all([
      changes.keys.has('businessProfile') ? db.businessProfile.get('default') : prev.snap.businessProfile,
      changes.keys.has('syncQueue') ? db.syncQueue.where('status').noneOf(['synced']).count() : prev.snap.pendingSyncCount,
      ...tables.map((t) => db.table(t).bulkGet([...changes.keys.get(t)!])),
    ]);
    if (!businessProfile) throw new Error('বিজনেস প্রোফাইল লোড করা যায়নি।');
    next.businessProfile = businessProfile as BusinessProfile;
    next.pendingSyncCount = pendingSyncCount as number;

    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const merged = mergeRows(
        prev.snap[t] as Array<{ id: string }>,
        [...changes.keys.get(t)!],
        fresh[i] as Array<{ id: string } | undefined>,
        SNAPSHOT_TABLES[t],
      );
      if (!merged) return this.loadAllData();
      (next as unknown as Record<string, unknown>)[t] = merged;
    }
    lastLoaded = { db, snap: next };
    return next;
  },

  // =========================================================================
  // Backup, restore & data safety (S8: AP-10, AP-11)
  // =========================================================================

  /** Every table of the active khata as backup data (appMeta excluded). */
  async readBackupData(db: JomarkhataDB = getJomarkhataDb()): Promise<BackupData> {
    const profile = await db.businessProfile.get('default');
    if (!profile) throw new Error('ব্যাকআপ নেওয়ার মতো কোনো খাতা নেই।');
    const data: BackupData = { businessProfile: profile as unknown as Record<string, unknown> };
    for (const t of BACKUP_TABLES) data[t] = await db.table(t).toArray();
    return data;
  },

  /** Backup file v2 (checksum, counts, optional password). Records when the last backup was taken. */
  async exportBackupJson(password?: string): Promise<string> {
    const file = await buildBackupFile(await this.readBackupData(), JOMARKHATA_DB_VERSION, password || undefined);
    if (getActiveDbMode() === 'real') await setMeta(getRealDb(), 'lastBackupAt', new Date().toISOString());
    return file;
  },

  /** Outbox overview for the সিঙ্ক অবস্থা screen (read-only). */
  async getSyncStatus(): Promise<{ counts: Record<string, number>; items: SyncQueueItem[] }> {
    const db = getJomarkhataDb();
    const all = await db.syncQueue.toArray();
    const counts: Record<string, number> = { pending: 0, syncing: 0, synced: 0, failed: 0, needs_review: 0 };
    for (const i of all) counts[i.status ?? 'pending'] = (counts[i.status ?? 'pending'] ?? 0) + 1;
    const items = all
      .filter((i) => i.status !== 'synced')
      .sort((a, b) => b.queuedAt.localeCompare(a.queuedAt))
      .slice(0, 50);
    return { counts, items };
  },

  /** Cloud state of one record: today always "local" (no backend), later synced / needs review. */
  async getRecordSyncState(entityId: string): Promise<'local' | 'synced' | 'needs_review'> {
    const ops = await getJomarkhataDb().syncQueue.where('entityId').equals(entityId).toArray();
    if (ops.some((o) => o.status === 'needs_review')) return 'needs_review';
    if (ops.length > 0 && ops.every((o) => o.status === 'synced')) return 'synced';
    return 'local';
  },

  /** Last server-verified subscription (backend phase). Local mode has none → never restricted. */
  /** Signed-in account cached on this phone (so the app opens offline). null = guest / test mode. */
  async getSession(): Promise<AuthUser | null> {
    return (await getMeta<AuthUser>(getRealDb(), 'session')) ?? null;
  },

  /** Save (or clear) the session; also caches its subscription for the offline access policy. */
  async saveSession(user: AuthUser | null): Promise<void> {
    const db = getRealDb();
    if (!user) {
      await db.appMeta.bulkDelete(['session', 'subscription']);
      return;
    }
    await setMeta(db, 'session', user);
    if (user.subscription) {
      const sub: CachedSubscription = {
        status: user.subscription.status,
        expiresAt: user.subscription.expiresAt,
        serverTime: user.serverTime ?? new Date().toISOString(),
      };
      await setMeta(db, 'subscription', sub);
    }
  },

  async getCachedSubscription(): Promise<CachedSubscription | null> {
    return (await getMeta<CachedSubscription>(getRealDb(), 'subscription')) ?? null;
  },

  async getLastBackupAt(): Promise<string | null> {
    return (await getMeta<string>(getRealDb(), 'lastBackupAt')) ?? null;
  },

  /** Validate a backup file and describe it, without changing anything. */
  async inspectBackup(text: string, password?: string): Promise<BackupPreview> {
    return (await parseBackup(text, password)).preview;
  },

  /** Keep one automatic copy of the current khata on this device before a destructive action. */
  async saveSafetyCopy(reason: 'restore' | 'clear'): Promise<boolean> {
    const real = getRealDb();
    if (!(await real.businessProfile.get('default'))) return false;
    const json = await buildBackupFile(await this.readBackupData(real), JOMARKHATA_DB_VERSION);
    await setMeta(real, 'safetyCopy', { reason, createdAt: new Date().toISOString(), json });
    return true;
  },

  async getSafetyCopy(): Promise<{ reason: string; createdAt: string; json: string } | null> {
    return (await getMeta(getRealDb(), 'safetyCopy')) ?? null;
  },

  /**
   * Restore (replace) the real khata from a backup file (AP-10):
   * validate everything → automatic safety copy of the current data → apply in ONE transaction,
   * so it either fully succeeds or changes nothing. Never merges two shops.
   */
  async restoreBackup(text: string, password?: string): Promise<AppDataSnapshot> {
    if (getActiveDbMode() !== 'real') throw new Error('ডেমো খাতায় ব্যাকআপ ফিরিয়ে আনা যায় না। আগে আসল খাতায় যান।');
    const { data } = await timed('restore: parse+validate', () => parseBackup(text, password));
    await timed('restore: safety copy', () => this.saveSafetyCopy('restore'));
    const db = getRealDb();
    await timed('restore: write', () => db.transaction('rw', [...shopTables(db), db.appMeta], async () => {
      for (const t of shopTables(db)) await t.clear();
      await db.businessProfile.put(data.businessProfile as unknown as BusinessProfile);
      for (const t of BACKUP_TABLES) {
        const rows = data[t] as Array<Record<string, unknown>>;
        await db.table(t).bulkPut(t === 'syncQueue' ? rows.map((r) => ({ ...r, ...normalizeOutboxItem(r) })) : rows);
      }
      if (!(await getMeta(db, 'workspace'))) {
        const workspace: WorkspaceMeta = { workspaceId: generateId(), createdAt: new Date().toISOString(), origin: 'setup' };
        await setMeta(db, 'workspace', workspace);
      }
      await setMeta(db, 'prefs', { activeMode: 'real' });
    }));
    return timed('restore: reload', () => this.loadAllData());
  },

  /**
   * "খাতা খালি করুন": removes every record but keeps the shop profile (AP-10).
   * A safety copy is saved first; the UI also offers a download and asks for typed confirmation.
   */
  async clearKhata(): Promise<AppDataSnapshot> {
    if (getActiveDbMode() !== 'real') throw new Error('এটি শুধু আসল খাতার জন্য।');
    await this.saveSafetyCopy('clear');
    const db = getRealDb();
    await db.transaction('rw', shopTables(db), async () => {
      for (const t of shopTables(db)) if (t.name !== 'businessProfile') await t.clear();
      await appendAuditLog(db, {
        entityType: 'business_profile',
        entityId: 'default',
        action: 'edit',
        summary: 'খাতা খালি করা হয়েছে (আগের হিসাবের একটি নিরাপত্তা-কপি এই ফোনে রাখা আছে)',
      });
    });
    return this.loadAllData();
  },

  // =========================================================================
  // Business Profile
  // =========================================================================

  async updateBusinessProfile(updates: {
    shopName: string;
    ownerName: string;
    phone: string;
    address: string;
    businessType: string;
    openingBalances: ChannelOpeningBalances;
    defaultLowStockThreshold: number;
  }): Promise<BusinessProfile> {
    const db = getJomarkhataDb();
    if (!updates.shopName.trim()) {
      throw new Error('দোকানের নাম লিখুন।');
    }

    let updated!: BusinessProfile;
    await db.transaction('rw', [db.businessProfile, db.auditLogs, db.syncQueue], async () => {
      const existing = await db.businessProfile.get('default');
      if (!existing) throw new Error('প্রোফাইল পাওয়া যায়নি।');

      updated = {
        ...existing,
        shopName: updates.shopName.trim(),
        ownerName: updates.ownerName.trim(),
        phone: updates.phone.trim(),
        address: updates.address.trim(),
        businessType: updates.businessType.trim(),
        openingBalances: {
          cash: Math.round(updates.openingBalances.cash || 0),
          bkash: Math.round(updates.openingBalances.bkash || 0),
          nagad: Math.round(updates.openingBalances.nagad || 0),
          bank: Math.round(updates.openingBalances.bank || 0),
        },
        defaultLowStockThreshold: Math.max(0, Math.round(updates.defaultLowStockThreshold || 0)),
        updatedAt: new Date().toISOString(),
      };

      await db.businessProfile.put(updated);
      await appendAuditLog(db, {
        entityType: 'business_profile',
        entityId: 'default',
        action: 'edit',
        summary: `দোকানের তথ্য ও শুরুর ব্যালেন্স আপডেট করা হয়েছে (${updated.shopName})`,
        beforeSnapshot: existing,
        afterSnapshot: updated,
      });
      await enqueueSyncMutation(db, 'business_profile', 'default', 'upsert', updated);
    });
    return updated;
  },

  // =========================================================================
  // Parties (Customers & Suppliers)
  // =========================================================================

  async createParty(input: {
    name: string;
    phone: string;
    address?: string;
    role: PartyRole;
    openingDue?: number;
  }): Promise<Party> {
    const db = getJomarkhataDb();
    const name = input.name.trim();
    if (!name) throw new Error('নাম লেখা বাধ্যতামূলক।');

    const now = new Date().toISOString();
    const partyId = generateId();
    const openingDue = Math.max(0, Math.round(input.openingDue || 0));

    let created!: Party;
    await db.transaction('rw', [db.parties, db.dueTransactions, db.auditLogs, db.syncQueue], async () => {
      created = {
        id: partyId,
        name,
        phone: input.phone.trim(),
        address: input.address?.trim() || '',
        role: input.role,
        balance: 0,
        dueReminderDate: null,
        lastTransactionAt: openingDue > 0 ? now : null,
        createdAt: now,
        updatedAt: now,
      };
      await db.parties.add(created);

      if (openingDue > 0) {
        const direction: DueDirection = input.role === 'customer' ? 'given' : 'received';
        const dueId = generateId();
        const dueTxn: DueTransaction = {
          id: dueId,
          partyId,
          partyRole: input.role,
          direction,
          source: 'manual_due',
          sourceId: null,
          moneyMovementId: null,
          paymentMethod: null,
          amount: openingDue,
          runningBalance: direction === 'given' ? openingDue : -openingDue,
          note: 'পূর্বের খাতার বাকি জের',
          status: 'active',
          date: now,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };
        await db.dueTransactions.add(dueTxn);
        await recomputePartyBalanceTx(db, partyId);
        await enqueueSyncMutation(db, 'due_transaction', dueId, 'upsert', dueTxn);
      }

      const fresh = await db.parties.get(partyId);
      if (fresh) created = fresh;

      await appendAuditLog(db, {
        entityType: 'party',
        entityId: partyId,
        action: 'create',
        summary: `নতুন ${input.role === 'customer' ? 'কাস্টমার' : 'সাপ্লায়ার'} যোগ হয়েছে: ${name}`,
        afterSnapshot: created,
      });
      await enqueueSyncMutation(db, 'party', partyId, 'upsert', created);
    });

    return created;
  },

  async updateParty(
    partyId: string,
    updates: { name: string; phone: string; address?: string; dueReminderDate?: string | null }
  ): Promise<void> {
    const db = getJomarkhataDb();
    if (!updates.name.trim()) throw new Error('নাম লেখা বাধ্যতামূলক।');

    await db.transaction('rw', [db.parties, db.auditLogs, db.syncQueue], async () => {
      const existing = await db.parties.get(partyId);
      if (!existing) throw new Error('পার্টি খুঁজে পাওয়া যায়নি।');

      const next: Party = {
        ...existing,
        name: updates.name.trim(),
        phone: updates.phone.trim(),
        address: updates.address?.trim() ?? existing.address,
        dueReminderDate:
          updates.dueReminderDate !== undefined ? updates.dueReminderDate : existing.dueReminderDate,
        updatedAt: new Date().toISOString(),
      };
      await db.parties.put(next);
      await appendAuditLog(db, {
        entityType: 'party',
        entityId: partyId,
        action: 'edit',
        summary: `পার্টির তথ্য আপডেট হয়েছে: ${next.name}`,
        beforeSnapshot: existing,
        afterSnapshot: next,
      });
      await enqueueSyncMutation(db, 'party', partyId, 'upsert', next);
    });
  },

  async setPartyDueReminder(partyId: string, dueReminderDate: string | null): Promise<void> {
    const db = getJomarkhataDb();
    await db.transaction('rw', [db.parties, db.syncQueue], async () => {
      const existing = await db.parties.get(partyId);
      if (!existing) return;
      const next = { ...existing, dueReminderDate, updatedAt: new Date().toISOString() };
      await db.parties.put(next);
      await enqueueSyncMutation(db, 'party', partyId, 'upsert', next);
    });
  },

  // =========================================================================
  // Products & Stock (100% Optional Module)
  // =========================================================================

  async createProduct(input: {
    name: string;
    category: string;
    unit: string;
    purchasePrice: number;
    sellingPrice: number;
    stockQty: number;
    lowStockThreshold: number;
  }): Promise<Product> {
    const db = getJomarkhataDb();
    const name = input.name.trim();
    if (!name) throw new Error('পণ্যের নাম লিখুন।');
    if (input.sellingPrice < 0 || input.purchasePrice < 0) {
      throw new Error('পণ্যের মূল্য শূন্য বা তার বেশি হতে হবে।');
    }

    const now = new Date().toISOString();
    const id = generateId();
    const product: Product = {
      id,
      name,
      category: input.category || 'অন্যান্য',
      unit: input.unit || 'পিস',
      purchasePrice: Math.round(input.purchasePrice),
      sellingPrice: Math.round(input.sellingPrice),
      stockQty: Math.max(0, Number(input.stockQty) || 0),
      lowStockThreshold: Math.max(0, Math.round(input.lowStockThreshold || 5)),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.transaction('rw', [db.products, db.stockMovements, db.auditLogs, db.syncQueue], async () => {
      await db.products.add(product);
      if (product.stockQty > 0) {
        const sm: StockMovement = {
          id: generateId(),
          productId: id,
          productName: name,
          deltaQty: product.stockQty,
          reason: 'manual_add',
          sourceType: 'manual',
          note: 'প্রারম্ভিক স্টক',
          date: now,
          createdAt: now,
        };
        await db.stockMovements.add(sm);
      }
      await appendAuditLog(db, {
        entityType: 'product',
        entityId: id,
        action: 'create',
        summary: `নতুন পণ্য যোগ হয়েছে: ${name} (স্টক ${product.stockQty} ${product.unit})`,
        afterSnapshot: product,
      });
      await enqueueSyncMutation(db, 'product', id, 'upsert', product);
    });

    return product;
  },

  async updateProduct(
    productId: string,
    updates: {
      name: string;
      category: string;
      unit: string;
      purchasePrice: number;
      sellingPrice: number;
      lowStockThreshold: number;
    }
  ): Promise<void> {
    const db = getJomarkhataDb();
    if (!updates.name.trim()) throw new Error('পণ্যের নাম লিখুন।');

    await db.transaction('rw', [db.products, db.auditLogs, db.syncQueue], async () => {
      const existing = await db.products.get(productId);
      if (!existing) throw new Error('পণ্যটি খুঁজে পাওয়া যায়নি।');
      const next: Product = {
        ...existing,
        name: updates.name.trim(),
        category: updates.category || existing.category,
        unit: updates.unit || existing.unit,
        purchasePrice: Math.max(0, Math.round(updates.purchasePrice)),
        sellingPrice: Math.max(0, Math.round(updates.sellingPrice)),
        lowStockThreshold: Math.max(0, Math.round(updates.lowStockThreshold)),
        updatedAt: new Date().toISOString(),
      };
      await db.products.put(next);
      await appendAuditLog(db, {
        entityType: 'product',
        entityId: productId,
        action: 'edit',
        summary: `পণ্যের তথ্য আপডেট হয়েছে: ${next.name}`,
        beforeSnapshot: existing,
        afterSnapshot: next,
      });
      await enqueueSyncMutation(db, 'product', productId, 'upsert', next);
    });
  },

  async adjustProductStock(productId: string, deltaQty: number, note?: string): Promise<void> {
    const db = getJomarkhataDb();
    if (!deltaQty || !Number.isFinite(deltaQty)) {
      throw new Error('সঠিক স্টক পরিমাণ লিখুন।');
    }

    const now = new Date().toISOString();
    await db.transaction('rw', [db.products, db.stockMovements, db.auditLogs, db.syncQueue], async () => {
      const prod = await db.products.get(productId);
      if (!prod) throw new Error('পণ্যটি খুঁজে পাওয়া যায়নি।');

      const nextQty = Math.max(0, prod.stockQty + deltaQty);
      const actualDelta = nextQty - prod.stockQty;
      const updated: Product = { ...prod, stockQty: nextQty, updatedAt: now };
      await db.products.put(updated);

      const sm: StockMovement = {
        id: generateId(),
        productId,
        productName: prod.name,
        deltaQty: actualDelta,
        reason: actualDelta >= 0 ? 'manual_add' : 'manual_remove',
        sourceType: 'manual',
        note: note?.trim() || (actualDelta >= 0 ? 'স্টক যোগ' : 'স্টক সমন্বয়'),
        date: now,
        createdAt: now,
      };
      await db.stockMovements.add(sm);
      await appendAuditLog(db, {
        entityType: 'product',
        entityId: productId,
        action: 'edit',
        summary: `${prod.name} স্টক সমন্বয়: ${prod.stockQty} → ${nextQty} ${prod.unit}`,
        beforeSnapshot: { stockQty: prod.stockQty },
        afterSnapshot: { stockQty: nextQty },
        reason: note?.trim() || null,
      });
      await enqueueSyncMutation(db, 'product', productId, 'upsert', updated);
      await enqueueSyncMutation(db, 'stock_movement', sm.id, 'upsert', sm);
    });
  },

  // =========================================================================
  // Sales (Quick Sale & Product Sale) — Atomic Create, Edit & Void
  // =========================================================================

  async createSale(input: CreateSaleInput): Promise<SaleRecord> {
    const db = getJomarkhataDb();
    if (!input.items.length) {
      throw new Error('বিক্রির পরিমাণ বা পণ্য যোগ করুন।');
    }

    const subtotal = Math.round(input.items.reduce((sum, i) => sum + i.lineTotal, 0));
    const discount = Math.max(0, Math.round(input.discount || 0));
    const total = Math.max(0, subtotal - discount);
    if (total <= 0) {
      throw new Error('বিক্রির মোট টাকা শূন্যের বেশি হতে হবে।');
    }

    const paidAmount = Math.min(total, Math.max(0, Math.round(input.paidAmount)));
    const dueAmount = total - paidAmount;

    // ACCOUNTING INVARIANT #2: Unassigned Credit Prevention
    if (dueAmount > 0 && !input.partyId) {
      throw new Error('বাকি রাখতে হলে কাস্টমার নির্বাচন করুন অথবা নতুন কাস্টমার যোগ করুন।');
    }

    const now = new Date().toISOString();
    const saleDate = input.date || now;
    const saleId = generateId();

    let createdSale!: SaleRecord;

    await db.transaction(
      'rw',
      [
        db.sales,
        db.products,
        db.parties,
        db.moneyMovements,
        db.dueTransactions,
        db.stockMovements,
        db.auditLogs,
        db.syncQueue,
      ],
      async () => {
        let partyName = 'নগদ ক্রেতা';
        if (input.partyId) {
          const party = await db.parties.get(input.partyId);
          if (!party) throw new Error('নির্বাচিত কাস্টমার খুঁজে পাওয়া যায়নি।');
          partyName = party.name;
        }

        const invoiceNo = await nextInvoiceNumber(db, 'INV');

        // 1. Canonical MoneyMovement ONLY if actual money received
        let moneyMovementId: string | null = null;
        if (paidAmount > 0) {
          moneyMovementId = generateId();
          const mm: MoneyMovement = {
            id: moneyMovementId,
            direction: 'in',
            channel: input.paymentMethod,
            sourceType: 'sale_payment',
            sourceId: saleId,
            partyId: input.partyId ?? null,
            partyName,
            amount: paidAmount,
            note: `বিক্রি ${invoiceNo}`,
            status: 'active',
            date: saleDate,
            createdAt: now,
            updatedAt: now,
          };
          await db.moneyMovements.add(mm);
          await enqueueSyncMutation(db, 'money_movement', mm.id, 'upsert', mm);
        }

        // 2. Credit DueTransaction ONLY if unpaid balance > 0 (moneyMovementId is null!)
        let dueTransactionId: string | null = null;
        if (dueAmount > 0 && input.partyId) {
          dueTransactionId = generateId();
          const dueTxn: DueTransaction = {
            id: dueTransactionId,
            partyId: input.partyId,
            partyRole: 'customer',
            direction: 'given',
            source: 'sale',
            sourceId: saleId,
            moneyMovementId: null,
            paymentMethod: null,
            amount: dueAmount,
            runningBalance: 0, // recomputed below
            note: `বিক্রি ${invoiceNo} থেকে বাকি`,
            status: 'active',
            date: saleDate,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          };
          await db.dueTransactions.add(dueTxn);
          await enqueueSyncMutation(db, 'due_transaction', dueTxn.id, 'upsert', dueTxn);
        }

        // 3. Deduct stock ONLY for product-linked items
        for (const item of input.items) {
          if (item.productId) {
            const prod = await db.products.get(item.productId);
            if (prod) {
              // AP-9 (D33): no clamp. Stock may go negative so it always equals the sum of movements.
              const nextQty = prod.stockQty - item.qty;
              await db.products.update(prod.id, { stockQty: nextQty, updatedAt: now });
              const sm: StockMovement = {
                id: generateId(),
                productId: prod.id,
                productName: prod.name,
                deltaQty: -item.qty,
                reason: 'sale',
                sourceType: 'sale',
                sourceId: saleId,
                note: `বিক্রি ${invoiceNo}`,
                date: saleDate,
                createdAt: now,
              };
              await db.stockMovements.add(sm);
              await enqueueSyncMutation(db, 'stock_movement', sm.id, 'upsert', sm);
            }
          }
        }

        createdSale = {
          id: saleId,
          invoiceNo,
          mode: input.mode,
          status: 'active',
          partyId: input.partyId ?? null,
          partyName,
          description: input.description?.trim() || undefined,
          items: input.items,
          subtotal,
          discount,
          total,
          paidAmount,
          dueAmount,
          paymentMethod: input.paymentMethod,
          moneyMovementId,
          dueTransactionId,
          note: input.note?.trim() || undefined,
          date: saleDate,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };

        await db.sales.add(createdSale);

        if (input.partyId && dueAmount > 0) {
          await recomputePartyBalanceTx(db, input.partyId);
        }

        await appendAuditLog(db, {
          entityType: 'sale',
          entityId: saleId,
          action: 'create',
          summary: `বিক্রি ${invoiceNo} (${partyName}) — মোট ${formatTaka(total)}, জমা ${formatTaka(paidAmount)}${dueAmount > 0 ? `, বাকি ${formatTaka(dueAmount)}` : ''}`,
          afterSnapshot: createdSale,
        });
        await enqueueSyncMutation(db, 'sale', saleId, 'upsert', createdSale);
      }
    );

    return createdSale;
  },

  /** `reason` (optional, AP-6) is stored on the audit log entry. */
  async editSale(saleId: string, input: CreateSaleInput, reason?: string): Promise<SaleRecord> {
    const db = getJomarkhataDb();
    const subtotal = Math.round(input.items.reduce((sum, i) => sum + i.lineTotal, 0));
    const discount = Math.max(0, Math.round(input.discount || 0));
    const total = Math.max(0, subtotal - discount);
    if (total <= 0) throw new Error('বিক্রির মোট টাকা শূন্যের বেশি হতে হবে।');

    const paidAmount = Math.min(total, Math.max(0, Math.round(input.paidAmount)));
    const dueAmount = total - paidAmount;

    if (dueAmount > 0 && !input.partyId) {
      throw new Error('বাকি রাখতে হলে কাস্টমার নির্বাচন করুন অথবা নতুন কাস্টমার যোগ করুন।');
    }

    const now = new Date().toISOString();
    let updatedSale!: SaleRecord;

    await db.transaction(
      'rw',
      [
        db.sales,
        db.products,
        db.parties,
        db.moneyMovements,
        db.dueTransactions,
        db.stockMovements,
        db.auditLogs,
        db.syncQueue,
      ],
      async () => {
        const existing = await db.sales.get(saleId);
        if (!existing) throw new Error('বিক্রির হিসাব খুঁজে পাওয়া যায়নি।');
        if (existing.status === 'voided') throw new Error('বাতিলকৃত বিক্রি সংশোধন করা যাবে না।');

        let partyName = 'নগদ ক্রেতা';
        if (input.partyId) {
          const party = await db.parties.get(input.partyId);
          if (!party) throw new Error('নির্বাচিত কাস্টমার খুঁজে পাওয়া যায়নি।');
          partyName = party.name;
        }

        const saleDate = input.date || existing.date;

        // 1. Reverse previous product stock deductions, then apply new product deductions
        const oldQtyByProd = new Map<string, number>();
        for (const item of existing.items) {
          if (item.productId) {
            oldQtyByProd.set(item.productId, (oldQtyByProd.get(item.productId) || 0) + item.qty);
          }
        }
        const newQtyByProd = new Map<string, number>();
        for (const item of input.items) {
          if (item.productId) {
            newQtyByProd.set(item.productId, (newQtyByProd.get(item.productId) || 0) + item.qty);
          }
        }
        const allProductIds = new Set([...oldQtyByProd.keys(), ...newQtyByProd.keys()]);
        for (const pid of allProductIds) {
          const oldQ = oldQtyByProd.get(pid) || 0;
          const newQ = newQtyByProd.get(pid) || 0;
          const stockDelta = oldQ - newQ; // positive means restore stock, negative means deduct more
          if (stockDelta !== 0) {
            const prod = await db.products.get(pid);
            if (prod) {
              await db.products.update(pid, {
                stockQty: prod.stockQty + stockDelta, // AP-9: no clamp
                updatedAt: now,
              });
              const sm: StockMovement = {
                id: generateId(),
                productId: pid,
                productName: prod.name,
                deltaQty: stockDelta,
                reason: 'edit_adjustment',
                sourceType: 'sale',
                sourceId: saleId,
                note: `বিক্রি ${existing.invoiceNo} সংশোধন`,
                date: now,
                createdAt: now,
              };
              await db.stockMovements.add(sm);
            }
          }
        }

        // 2. Atomically sync linked canonical MoneyMovement
        let moneyMovementId = existing.moneyMovementId ?? null;
        if (paidAmount > 0) {
          if (moneyMovementId) {
            await db.moneyMovements.update(moneyMovementId, {
              channel: input.paymentMethod,
              partyId: input.partyId ?? null,
              partyName,
              amount: paidAmount,
              status: 'active',
              date: saleDate,
              updatedAt: now,
            });
          } else {
            moneyMovementId = generateId();
            await db.moneyMovements.add({
              id: moneyMovementId,
              direction: 'in',
              channel: input.paymentMethod,
              sourceType: 'sale_payment',
              sourceId: saleId,
              partyId: input.partyId ?? null,
              partyName,
              amount: paidAmount,
              note: `বিক্রি ${existing.invoiceNo}`,
              status: 'active',
              date: saleDate,
              createdAt: now,
              updatedAt: now,
            });
          }
        } else if (moneyMovementId) {
          await db.moneyMovements.update(moneyMovementId, {
            status: 'voided',
            updatedAt: now,
          });
          moneyMovementId = null;
        }

        // 3. Atomically sync linked DueTransaction
        const affectedParties = new Set<string>();
        if (existing.partyId) affectedParties.add(existing.partyId);
        if (input.partyId) affectedParties.add(input.partyId);

        let dueTransactionId = existing.dueTransactionId ?? null;
        if (dueAmount > 0 && input.partyId) {
          if (dueTransactionId) {
            await db.dueTransactions.update(dueTransactionId, {
              partyId: input.partyId,
              amount: dueAmount,
              status: 'active',
              date: saleDate,
              revision: existing.revision + 1,
              updatedAt: now,
            });
          } else {
            dueTransactionId = generateId();
            await db.dueTransactions.add({
              id: dueTransactionId,
              partyId: input.partyId,
              partyRole: 'customer',
              direction: 'given',
              source: 'sale',
              sourceId: saleId,
              moneyMovementId: null,
              paymentMethod: null,
              amount: dueAmount,
              runningBalance: 0,
              note: `বিক্রি ${existing.invoiceNo} থেকে বাকি`,
              status: 'active',
              date: saleDate,
              revision: 1,
              createdAt: now,
              updatedAt: now,
            });
          }
        } else if (dueTransactionId) {
          await db.dueTransactions.update(dueTransactionId, {
            status: 'voided',
            voidedAt: now,
            voidReason: 'বিক্রি সংশোধনের ফলে বাকি শূন্য হয়েছে',
            updatedAt: now,
          });
          dueTransactionId = null;
        }

        updatedSale = {
          ...existing,
          mode: input.mode,
          partyId: input.partyId ?? null,
          partyName,
          description: input.description?.trim() || undefined,
          items: input.items,
          subtotal,
          discount,
          total,
          paidAmount,
          dueAmount,
          paymentMethod: input.paymentMethod,
          moneyMovementId,
          dueTransactionId,
          note: input.note?.trim() || undefined,
          date: saleDate,
          revision: existing.revision + 1,
          updatedAt: now,
        };

        await db.sales.put(updatedSale);

        for (const pid of affectedParties) {
          await recomputePartyBalanceTx(db, pid);
        }

        await appendAuditLog(db, {
          entityType: 'sale',
          entityId: saleId,
          action: 'edit',
          summary: `বিক্রি ${existing.invoiceNo} সংশোধন হয়েছে: ${formatTaka(existing.total)} → ${formatTaka(total)} (জমা ${formatTaka(paidAmount)})`,
          beforeSnapshot: existing,
          afterSnapshot: updatedSale,
          reason: reason?.trim() || null,
        });
        await enqueueSyncMutation(db, 'sale', saleId, 'upsert', updatedSale);
      }
    );

    return updatedSale;
  },

  async voidSale(saleId: string, reason?: string): Promise<void> {
    const db = getJomarkhataDb();
    const now = new Date().toISOString();
    const cleanReason = reason?.trim() || 'ব্যবহারকারী কর্তৃক বাতিল';

    await db.transaction(
      'rw',
      [
        db.sales,
        db.products,
        db.parties,
        db.moneyMovements,
        db.dueTransactions,
        db.stockMovements,
        db.auditLogs,
        db.syncQueue,
      ],
      async () => {
        const existing = await db.sales.get(saleId);
        if (!existing) throw new Error('বিক্রির হিসাব পাওয়া যায়নি।');
        if (existing.status === 'voided') return;

        // 1. Mark Sale voided (never silently hard-delete!)
        const voided: SaleRecord = {
          ...existing,
          status: 'voided',
          voidedAt: now,
          voidReason: cleanReason,
          updatedAt: now,
        };
        await db.sales.put(voided);

        // 2. Void linked MoneyMovement atomically
        if (existing.moneyMovementId) {
          await db.moneyMovements.update(existing.moneyMovementId, {
            status: 'voided',
            updatedAt: now,
          });
        }

        // 3. Void linked DueTransaction & recompute party balance
        if (existing.dueTransactionId) {
          await db.dueTransactions.update(existing.dueTransactionId, {
            status: 'voided',
            voidedAt: now,
            voidReason: cleanReason,
            updatedAt: now,
          });
        }
        if (existing.partyId) {
          await recomputePartyBalanceTx(db, existing.partyId);
        }

        // 4. Restore deducted product stock via void_reversal movement
        for (const item of existing.items) {
          if (item.productId) {
            const prod = await db.products.get(item.productId);
            if (prod) {
              await db.products.update(prod.id, {
                stockQty: prod.stockQty + item.qty,
                updatedAt: now,
              });
              await db.stockMovements.add({
                id: generateId(),
                productId: prod.id,
                productName: prod.name,
                deltaQty: item.qty,
                reason: 'void_reversal',
                sourceType: 'sale',
                sourceId: saleId,
                note: `বিক্রি ${existing.invoiceNo} বাতিল — স্টক ফেরত`,
                date: now,
                createdAt: now,
              });
            }
          }
        }

        await appendAuditLog(db, {
          entityType: 'sale',
          entityId: saleId,
          action: 'void',
          summary: `বিক্রি ${existing.invoiceNo} বাতিল করা হয়েছে (${formatTaka(existing.total)} রিভার্সড)`,
          beforeSnapshot: existing,
          afterSnapshot: voided,
          reason: cleanReason,
        });
        await queueLinkedVoidChanges(db, { moneyMovementId: existing.moneyMovementId, dueTransactionId: existing.dueTransactionId, partyId: existing.partyId, sourceId: saleId, at: now, stock: true });
        await enqueueSyncMutation(db, 'sale', saleId, 'void', voided);
      }
    );
  },

  // =========================================================================
  // Purchases (Quick & Product) — Atomic Create, Edit & Void
  // =========================================================================

  async createPurchase(input: CreatePurchaseInput): Promise<PurchaseRecord> {
    const db = getJomarkhataDb();
    if (!input.items.length) throw new Error('ক্রয়ের পরিমাণ বা পণ্য যোগ করুন।');

    const total = Math.round(input.items.reduce((sum, i) => sum + i.lineTotal, 0));
    if (total <= 0) throw new Error('ক্রয়ের মোট টাকা শূন্যের বেশি হতে হবে।');

    const paidAmount = Math.min(total, Math.max(0, Math.round(input.paidAmount)));
    const dueAmount = total - paidAmount;

    if (dueAmount > 0 && !input.partyId) {
      throw new Error('বাকি রাখতে হলে সাপ্লায়ার নির্বাচন করুন অথবা নতুন সাপ্লায়ার যোগ করুন।');
    }

    const now = new Date().toISOString();
    const purchaseDate = input.date || now;
    const purchaseId = generateId();
    let createdPurchase!: PurchaseRecord;

    await db.transaction(
      'rw',
      [
        db.purchases,
        db.products,
        db.parties,
        db.moneyMovements,
        db.dueTransactions,
        db.stockMovements,
        db.auditLogs,
        db.syncQueue,
      ],
      async () => {
        let partyName = 'নগদ সরবরাহকারী';
        if (input.partyId) {
          const party = await db.parties.get(input.partyId);
          if (!party) throw new Error('নির্বাচিত সাপ্লায়ার খুঁজে পাওয়া যায়নি।');
          partyName = party.name;
        }

        const billNo = await nextInvoiceNumber(db, 'BILL');

        let moneyMovementId: string | null = null;
        if (paidAmount > 0) {
          moneyMovementId = generateId();
          const mm: MoneyMovement = {
            id: moneyMovementId,
            direction: 'out',
            channel: input.paymentMethod,
            sourceType: 'purchase_payment',
            sourceId: purchaseId,
            partyId: input.partyId ?? null,
            partyName,
            amount: paidAmount,
            note: `ক্রয় ${billNo}`,
            status: 'active',
            date: purchaseDate,
            createdAt: now,
            updatedAt: now,
          };
          await db.moneyMovements.add(mm);
          await enqueueSyncMutation(db, 'money_movement', mm.id, 'upsert', mm);
        }

        let dueTransactionId: string | null = null;
        if (dueAmount > 0 && input.partyId) {
          dueTransactionId = generateId();
          const dueTxn: DueTransaction = {
            id: dueTransactionId,
            partyId: input.partyId,
            partyRole: 'supplier',
            direction: 'received', // negative balance = payable (দিবো)
            source: 'purchase',
            sourceId: purchaseId,
            moneyMovementId: null,
            paymentMethod: null,
            amount: dueAmount,
            runningBalance: 0,
            note: `ক্রয় ${billNo} থেকে সাপ্লায়ার বাকি`,
            status: 'active',
            date: purchaseDate,
            revision: 1,
            createdAt: now,
            updatedAt: now,
          };
          await db.dueTransactions.add(dueTxn);
          await enqueueSyncMutation(db, 'due_transaction', dueTxn.id, 'upsert', dueTxn);
        }

        for (const item of input.items) {
          if (item.productId) {
            const prod = await db.products.get(item.productId);
            if (prod) {
              await db.products.update(prod.id, {
                stockQty: prod.stockQty + item.qty,
                purchasePrice: item.unitPrice > 0 ? Math.round(item.unitPrice) : prod.purchasePrice,
                updatedAt: now,
              });
              await db.stockMovements.add({
                id: generateId(),
                productId: prod.id,
                productName: prod.name,
                deltaQty: item.qty,
                reason: 'purchase',
                sourceType: 'purchase',
                sourceId: purchaseId,
                note: `ক্রয় ${billNo}`,
                date: purchaseDate,
                createdAt: now,
              });
            }
          }
        }

        createdPurchase = {
          id: purchaseId,
          billNo,
          mode: input.mode,
          status: 'active',
          partyId: input.partyId ?? null,
          partyName,
          description: input.description?.trim() || undefined,
          items: input.items,
          total,
          paidAmount,
          dueAmount,
          paymentMethod: input.paymentMethod,
          moneyMovementId,
          dueTransactionId,
          note: input.note?.trim() || undefined,
          date: purchaseDate,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };

        await db.purchases.add(createdPurchase);

        if (input.partyId && dueAmount > 0) {
          await recomputePartyBalanceTx(db, input.partyId);
        }

        await appendAuditLog(db, {
          entityType: 'purchase',
          entityId: purchaseId,
          action: 'create',
          summary: `ক্রয় ${billNo} (${partyName}) — মোট ${formatTaka(total)}, পরিশোধ ${formatTaka(paidAmount)}`,
          afterSnapshot: createdPurchase,
        });
        await enqueueSyncMutation(db, 'purchase', purchaseId, 'upsert', createdPurchase);
      }
    );

    return createdPurchase;
  },

  async editPurchase(purchaseId: string, input: CreatePurchaseInput, reason?: string): Promise<PurchaseRecord> {
    const db = getJomarkhataDb();
    const total = Math.round(input.items.reduce((sum, i) => sum + i.lineTotal, 0));
    if (total <= 0) throw new Error('ক্রয়ের মোট টাকা শূন্যের বেশি হতে হবে।');

    const paidAmount = Math.min(total, Math.max(0, Math.round(input.paidAmount)));
    const dueAmount = total - paidAmount;

    if (dueAmount > 0 && !input.partyId) {
      throw new Error('বাকি রাখতে হলে সাপ্লায়ার নির্বাচন করুন অথবা নতুন সাপ্লায়ার যোগ করুন।');
    }

    const now = new Date().toISOString();
    let updatedPurchase!: PurchaseRecord;

    await db.transaction(
      'rw',
      [
        db.purchases,
        db.products,
        db.parties,
        db.moneyMovements,
        db.dueTransactions,
        db.stockMovements,
        db.auditLogs,
        db.syncQueue,
      ],
      async () => {
        const existing = await db.purchases.get(purchaseId);
        if (!existing) throw new Error('ক্রয়ের হিসাব পাওয়া যায়নি।');
        if (existing.status === 'voided') throw new Error('বাতিলকৃত ক্রয় সংশোধন করা যাবে না।');

        let partyName = 'নগদ সরবরাহকারী';
        if (input.partyId) {
          const party = await db.parties.get(input.partyId);
          if (!party) throw new Error('নির্বাচিত সাপ্লায়ার খুঁজে পাওয়া যায়নি।');
          partyName = party.name;
        }

        const purchaseDate = input.date || existing.date;

        // Reconcile product stock deltas
        const oldQtyByProd = new Map<string, number>();
        for (const item of existing.items) {
          if (item.productId) {
            oldQtyByProd.set(item.productId, (oldQtyByProd.get(item.productId) || 0) + item.qty);
          }
        }
        const newQtyByProd = new Map<string, number>();
        for (const item of input.items) {
          if (item.productId) {
            newQtyByProd.set(item.productId, (newQtyByProd.get(item.productId) || 0) + item.qty);
          }
        }
        const allProductIds = new Set([...oldQtyByProd.keys(), ...newQtyByProd.keys()]);
        for (const pid of allProductIds) {
          const delta = (newQtyByProd.get(pid) || 0) - (oldQtyByProd.get(pid) || 0);
          if (delta !== 0) {
            const prod = await db.products.get(pid);
            if (prod) {
              await db.products.update(pid, {
                stockQty: prod.stockQty + delta, // AP-9: no clamp
                updatedAt: now,
              });
              await db.stockMovements.add({
                id: generateId(),
                productId: pid,
                productName: prod.name,
                deltaQty: delta,
                reason: 'edit_adjustment',
                sourceType: 'purchase',
                sourceId: purchaseId,
                note: `ক্রয় ${existing.billNo} সংশোধন`,
                date: now,
                createdAt: now,
              });
            }
          }
        }

        // Sync linked MoneyMovement
        let moneyMovementId = existing.moneyMovementId ?? null;
        if (paidAmount > 0) {
          if (moneyMovementId) {
            await db.moneyMovements.update(moneyMovementId, {
              channel: input.paymentMethod,
              partyId: input.partyId ?? null,
              partyName,
              amount: paidAmount,
              status: 'active',
              date: purchaseDate,
              updatedAt: now,
            });
          } else {
            moneyMovementId = generateId();
            await db.moneyMovements.add({
              id: moneyMovementId,
              direction: 'out',
              channel: input.paymentMethod,
              sourceType: 'purchase_payment',
              sourceId: purchaseId,
              partyId: input.partyId ?? null,
              partyName,
              amount: paidAmount,
              note: `ক্রয় ${existing.billNo}`,
              status: 'active',
              date: purchaseDate,
              createdAt: now,
              updatedAt: now,
            });
          }
        } else if (moneyMovementId) {
          await db.moneyMovements.update(moneyMovementId, { status: 'voided', updatedAt: now });
          moneyMovementId = null;
        }

        // Sync linked DueTransaction
        const affectedParties = new Set<string>();
        if (existing.partyId) affectedParties.add(existing.partyId);
        if (input.partyId) affectedParties.add(input.partyId);

        let dueTransactionId = existing.dueTransactionId ?? null;
        if (dueAmount > 0 && input.partyId) {
          if (dueTransactionId) {
            await db.dueTransactions.update(dueTransactionId, {
              partyId: input.partyId,
              amount: dueAmount,
              status: 'active',
              date: purchaseDate,
              revision: existing.revision + 1,
              updatedAt: now,
            });
          } else {
            dueTransactionId = generateId();
            await db.dueTransactions.add({
              id: dueTransactionId,
              partyId: input.partyId,
              partyRole: 'supplier',
              direction: 'received',
              source: 'purchase',
              sourceId: purchaseId,
              moneyMovementId: null,
              paymentMethod: null,
              amount: dueAmount,
              runningBalance: 0,
              note: `ক্রয় ${existing.billNo} থেকে সাপ্লায়ার বাকি`,
              status: 'active',
              date: purchaseDate,
              revision: 1,
              createdAt: now,
              updatedAt: now,
            });
          }
        } else if (dueTransactionId) {
          await db.dueTransactions.update(dueTransactionId, {
            status: 'voided',
            voidedAt: now,
            voidReason: 'ক্রয় সংশোধনের ফলে বাকি শূন্য হয়েছে',
            updatedAt: now,
          });
          dueTransactionId = null;
        }

        updatedPurchase = {
          ...existing,
          mode: input.mode,
          partyId: input.partyId ?? null,
          partyName,
          description: input.description?.trim() || undefined,
          items: input.items,
          total,
          paidAmount,
          dueAmount,
          paymentMethod: input.paymentMethod,
          moneyMovementId,
          dueTransactionId,
          note: input.note?.trim() || undefined,
          date: purchaseDate,
          revision: existing.revision + 1,
          updatedAt: now,
        };

        await db.purchases.put(updatedPurchase);

        for (const pid of affectedParties) {
          await recomputePartyBalanceTx(db, pid);
        }

        await appendAuditLog(db, {
          entityType: 'purchase',
          entityId: purchaseId,
          action: 'edit',
          summary: `ক্রয় ${existing.billNo} সংশোধন হয়েছে: ${formatTaka(existing.total)} → ${formatTaka(total)}`,
          beforeSnapshot: existing,
          afterSnapshot: updatedPurchase,
          reason: reason?.trim() || null,
        });
        await enqueueSyncMutation(db, 'purchase', purchaseId, 'upsert', updatedPurchase);
      }
    );

    return updatedPurchase;
  },

  async voidPurchase(purchaseId: string, reason?: string): Promise<void> {
    const db = getJomarkhataDb();
    const now = new Date().toISOString();
    const cleanReason = reason?.trim() || 'ব্যবহারকারী কর্তৃক বাতিল';

    await db.transaction(
      'rw',
      [
        db.purchases,
        db.products,
        db.parties,
        db.moneyMovements,
        db.dueTransactions,
        db.stockMovements,
        db.auditLogs,
        db.syncQueue,
      ],
      async () => {
        const existing = await db.purchases.get(purchaseId);
        if (!existing || existing.status === 'voided') return;

        const voided: PurchaseRecord = {
          ...existing,
          status: 'voided',
          voidedAt: now,
          voidReason: cleanReason,
          updatedAt: now,
        };
        await db.purchases.put(voided);

        if (existing.moneyMovementId) {
          await db.moneyMovements.update(existing.moneyMovementId, {
            status: 'voided',
            updatedAt: now,
          });
        }
        if (existing.dueTransactionId) {
          await db.dueTransactions.update(existing.dueTransactionId, {
            status: 'voided',
            voidedAt: now,
            voidReason: cleanReason,
            updatedAt: now,
          });
        }
        if (existing.partyId) {
          await recomputePartyBalanceTx(db, existing.partyId);
        }

        for (const item of existing.items) {
          if (item.productId) {
            const prod = await db.products.get(item.productId);
            if (prod) {
              await db.products.update(prod.id, {
                stockQty: prod.stockQty - item.qty, // AP-9: no clamp
                updatedAt: now,
              });
              await db.stockMovements.add({
                id: generateId(),
                productId: prod.id,
                productName: prod.name,
                deltaQty: -item.qty,
                reason: 'void_reversal',
                sourceType: 'purchase',
                sourceId: purchaseId,
                note: `ক্রয় ${existing.billNo} বাতিল — স্টক বাদ`,
                date: now,
                createdAt: now,
              });
            }
          }
        }

        await appendAuditLog(db, {
          entityType: 'purchase',
          entityId: purchaseId,
          action: 'void',
          summary: `ক্রয় ${existing.billNo} বাতিল করা হয়েছে (${formatTaka(existing.total)} রিভার্সড)`,
          beforeSnapshot: existing,
          afterSnapshot: voided,
          reason: cleanReason,
        });
        await queueLinkedVoidChanges(db, { moneyMovementId: existing.moneyMovementId, dueTransactionId: existing.dueTransactionId, partyId: existing.partyId, sourceId: purchaseId, at: now, stock: true });
        await enqueueSyncMutation(db, 'purchase', purchaseId, 'void', voided);
      }
    );
  },

  // =========================================================================
  // Party Collections (নিচ্ছি), Supplier Payments (দিচ্ছি) & Manual Dues
  // =========================================================================

  async recordDueEntry(input: RecordDueEntryInput): Promise<DueTransaction> {
    const db = getJomarkhataDb();
    const amount = Math.round(input.amount);
    if (amount <= 0) throw new Error('টাকার পরিমাণ শূন্যের বেশি হতে হবে।');
    if (!input.partyId) throw new Error('কাস্টমার বা সাপ্লায়ার নির্বাচন করুন।');

    const now = new Date().toISOString();
    const txnDate = input.date || now;
    const dueId = generateId();
    const channel: PaymentChannel = input.paymentMethod || 'cash';

    let created!: DueTransaction;

    await db.transaction(
      'rw',
      [db.parties, db.dueTransactions, db.moneyMovements, db.auditLogs, db.syncQueue],
      async () => {
        const party = await db.parties.get(input.partyId);
        if (!party) throw new Error('পার্টি খুঁজে পাওয়া যায়নি।');

        let direction: DueDirection;
        let source: DueTransaction['source'];
        let moneyMovementId: string | null = null;
        let usedPaymentMethod: PaymentChannel | null = null;
        let defaultNote = '';

        if (input.entryType === 'customer_collection') {
          direction = 'received';
          source = 'customer_collection';
          usedPaymentMethod = channel;
          moneyMovementId = generateId();
          defaultNote = 'টাকা পেলাম';
          const mm: MoneyMovement = {
            id: moneyMovementId,
            direction: 'in',
            channel,
            sourceType: 'customer_collection',
            sourceId: dueId,
            partyId: party.id,
            partyName: party.name,
            amount,
            note: input.note?.trim() || defaultNote,
            status: 'active',
            date: txnDate,
            createdAt: now,
            updatedAt: now,
          };
          await db.moneyMovements.add(mm);
          await enqueueSyncMutation(db, 'money_movement', mm.id, 'upsert', mm);
        } else if (input.entryType === 'supplier_payment') {
          direction = 'given';
          source = 'supplier_payment';
          usedPaymentMethod = channel;
          moneyMovementId = generateId();
          defaultNote = 'টাকা দিলাম';
          const mm: MoneyMovement = {
            id: moneyMovementId,
            direction: 'out',
            channel,
            sourceType: 'supplier_payment',
            sourceId: dueId,
            partyId: party.id,
            partyName: party.name,
            amount,
            note: input.note?.trim() || defaultNote,
            status: 'active',
            date: txnDate,
            createdAt: now,
            updatedAt: now,
          };
          await db.moneyMovements.add(mm);
          await enqueueSyncMutation(db, 'money_movement', mm.id, 'upsert', mm);
        } else if (input.entryType === 'manual_due_given') {
          direction = 'given';
          source = 'manual_due';
          defaultNote = 'বাকিতে দিলাম';
        } else {
          direction = 'received';
          source = 'manual_due';
          defaultNote = 'বাকিতে নিলাম';
        }

        created = {
          id: dueId,
          partyId: party.id,
          partyRole: party.role,
          direction,
          source,
          sourceId: null,
          moneyMovementId,
          paymentMethod: usedPaymentMethod,
          amount,
          runningBalance: 0,
          note: input.note?.trim() || defaultNote,
          status: 'active',
          date: txnDate,
          revision: 1,
          createdAt: now,
          updatedAt: now,
        };

        await db.dueTransactions.add(created);
        await recomputePartyBalanceTx(db, party.id);

        const refreshed = await db.dueTransactions.get(dueId);
        if (refreshed) created = refreshed;

        await appendAuditLog(db, {
          entityType: 'due_transaction',
          entityId: dueId,
          action: 'create',
          summary: `${party.name} — ${defaultNote} ${formatTaka(amount)}`,
          afterSnapshot: created,
        });
        await enqueueSyncMutation(db, 'due_transaction', dueId, 'upsert', created);
      }
    );

    return created;
  },

  async editDueEntry(
    dueId: string,
    updates: { amount: number; paymentMethod?: PaymentChannel; note?: string; date?: string },
    reason?: string
  ): Promise<void> {
    const db = getJomarkhataDb();
    const amount = Math.round(updates.amount);
    if (amount <= 0) throw new Error('টাকার পরিমাণ শূন্যের বেশি হতে হবে।');

    const now = new Date().toISOString();
    await db.transaction(
      'rw',
      [db.parties, db.dueTransactions, db.moneyMovements, db.auditLogs, db.syncQueue],
      async () => {
        const existing = await db.dueTransactions.get(dueId);
        if (!existing) throw new Error('বাকির এন্ট্রি পাওয়া যায়নি।');
        if (existing.status === 'voided') throw new Error('বাতিলকৃত এন্ট্রি সংশোধন করা যাবে না।');
        if (existing.source === 'sale' || existing.source === 'purchase') {
          throw new Error('বিক্রি বা ক্রয় থেকে তৈরি বাকি মূল ইনভয়েস থেকেই সংশোধন করুন।');
        }

        const nextDate = updates.date || existing.date;
        const nextChannel = updates.paymentMethod || existing.paymentMethod || 'cash';

        if (existing.moneyMovementId) {
          await db.moneyMovements.update(existing.moneyMovementId, {
            amount,
            channel: nextChannel,
            note: updates.note?.trim() ?? existing.note,
            date: nextDate,
            updatedAt: now,
          });
        }

        const next: DueTransaction = {
          ...existing,
          amount,
          paymentMethod: existing.moneyMovementId ? nextChannel : existing.paymentMethod,
          note: updates.note?.trim() ?? existing.note,
          date: nextDate,
          revision: existing.revision + 1,
          updatedAt: now,
        };
        await db.dueTransactions.put(next);
        await recomputePartyBalanceTx(db, existing.partyId);

        await appendAuditLog(db, {
          entityType: 'due_transaction',
          entityId: dueId,
          action: 'edit',
          summary: `বাকি লেনদেন সংশোধন হয়েছে: ${formatTaka(existing.amount)} → ${formatTaka(amount)}`,
          beforeSnapshot: existing,
          afterSnapshot: next,
          reason: reason?.trim() || null,
        });
        await enqueueSyncMutation(db, 'due_transaction', dueId, 'upsert', next);
      }
    );
  },

  async voidDueEntry(dueId: string, reason?: string): Promise<void> {
    const db = getJomarkhataDb();
    const now = new Date().toISOString();
    const cleanReason = reason?.trim() || 'ব্যবহারকারী কর্তৃক বাতিল';

    await db.transaction(
      'rw',
      [db.parties, db.dueTransactions, db.moneyMovements, db.auditLogs, db.syncQueue],
      async () => {
        const existing = await db.dueTransactions.get(dueId);
        if (!existing || existing.status === 'voided') return;
        if (existing.source === 'sale' || existing.source === 'purchase') {
          throw new Error('বিক্রি বা ক্রয় থেকে তৈরি বাকি মূল ইনভয়েস থেকে বাতিল করুন।');
        }

        const voided: DueTransaction = {
          ...existing,
          status: 'voided',
          voidedAt: now,
          voidReason: cleanReason,
          updatedAt: now,
        };
        await db.dueTransactions.put(voided);

        if (existing.moneyMovementId) {
          await db.moneyMovements.update(existing.moneyMovementId, {
            status: 'voided',
            updatedAt: now,
          });
        }

        await recomputePartyBalanceTx(db, existing.partyId);

        await appendAuditLog(db, {
          entityType: 'due_transaction',
          entityId: dueId,
          action: 'void',
          summary: `বাকি লেনদেন বাতিল করা হয়েছে (${formatTaka(existing.amount)} রিভার্সড)`,
          beforeSnapshot: existing,
          afterSnapshot: voided,
          reason: cleanReason,
        });
        await queueLinkedVoidChanges(db, { moneyMovementId: existing.moneyMovementId, partyId: existing.partyId, sourceId: dueId, at: now });
        await enqueueSyncMutation(db, 'due_transaction', dueId, 'void', voided);
      }
    );
  },

  // =========================================================================
  // Direct-Amount Expenses — Atomic Create, Edit & Void
  // =========================================================================

  async createExpense(input: CreateExpenseInput): Promise<ExpenseRecord> {
    const db = getJomarkhataDb();
    const amount = Math.round(input.amount);
    if (amount <= 0) throw new Error('খরচের পরিমাণ শূন্যের বেশি হতে হবে।');

    const now = new Date().toISOString();
    const expDate = input.date || now;
    const expId = generateId();
    const mmId = generateId();
    const category = input.category?.trim() || 'অন্যান্য';
    const title = input.title?.trim() || category;

    let created!: ExpenseRecord;

    await db.transaction('rw', [db.expenses, db.moneyMovements, db.auditLogs, db.syncQueue], async () => {
      const mm: MoneyMovement = {
        id: mmId,
        direction: 'out',
        channel: input.paymentMethod,
        sourceType: 'expense',
        sourceId: expId,
        amount,
        note: title,
        status: 'active',
        date: expDate,
        createdAt: now,
        updatedAt: now,
      };
      await db.moneyMovements.add(mm);

      created = {
        id: expId,
        category,
        title,
        amount,
        paymentMethod: input.paymentMethod,
        moneyMovementId: mmId,
        note: input.note?.trim() || undefined,
        status: 'active',
        date: expDate,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      };
      await db.expenses.add(created);

      await appendAuditLog(db, {
        entityType: 'expense',
        entityId: expId,
        action: 'create',
        summary: `খরচ যোগ হয়েছে: ${title} (${formatTaka(amount)})`,
        afterSnapshot: created,
      });
      await enqueueSyncMutation(db, 'expense', expId, 'upsert', created);
      await enqueueSyncMutation(db, 'money_movement', mmId, 'upsert', mm);
    });

    return created;
  },

  async editExpense(expenseId: string, input: CreateExpenseInput, reason?: string): Promise<void> {
    const db = getJomarkhataDb();
    const amount = Math.round(input.amount);
    if (amount <= 0) throw new Error('খরচের পরিমাণ শূন্যের বেশি হতে হবে।');

    const now = new Date().toISOString();
    await db.transaction('rw', [db.expenses, db.moneyMovements, db.auditLogs, db.syncQueue], async () => {
      const existing = await db.expenses.get(expenseId);
      if (!existing) throw new Error('খরচটি পাওয়া যায়নি।');
      if (existing.status === 'voided') throw new Error('বাতিলকৃত খরচ সংশোধন করা যাবে না।');

      const category = input.category?.trim() || existing.category;
      const title = input.title?.trim() || category;
      const expDate = input.date || existing.date;

      const next: ExpenseRecord = {
        ...existing,
        category,
        title,
        amount,
        paymentMethod: input.paymentMethod,
        note: input.note?.trim() || undefined,
        date: expDate,
        revision: existing.revision + 1,
        updatedAt: now,
      };
      await db.expenses.put(next);

      await db.moneyMovements.update(existing.moneyMovementId, {
        channel: input.paymentMethod,
        amount,
        note: title,
        date: expDate,
        updatedAt: now,
      });

      await appendAuditLog(db, {
        entityType: 'expense',
        entityId: expenseId,
        action: 'edit',
        summary: `খরচ "${title}" সংশোধন হয়েছে: ${formatTaka(existing.amount)} → ${formatTaka(amount)}`,
        beforeSnapshot: existing,
        afterSnapshot: next,
        reason: reason?.trim() || null,
      });
      await enqueueSyncMutation(db, 'expense', expenseId, 'upsert', next);
    });
  },

  async voidExpense(expenseId: string, reason?: string): Promise<void> {
    const db = getJomarkhataDb();
    const now = new Date().toISOString();
    const cleanReason = reason?.trim() || 'ব্যবহারকারী কর্তৃক বাতিল';

    await db.transaction('rw', [db.expenses, db.moneyMovements, db.auditLogs, db.syncQueue], async () => {
      const existing = await db.expenses.get(expenseId);
      if (!existing || existing.status === 'voided') return;

      const voided: ExpenseRecord = {
        ...existing,
        status: 'voided',
        voidedAt: now,
        voidReason: cleanReason,
        updatedAt: now,
      };
      await db.expenses.put(voided);

      await db.moneyMovements.update(existing.moneyMovementId, {
        status: 'voided',
        updatedAt: now,
      });

      await appendAuditLog(db, {
        entityType: 'expense',
        entityId: expenseId,
        action: 'void',
        summary: `খরচ "${existing.title}" বাতিল করা হয়েছে (${formatTaka(existing.amount)} রিভার্সড)`,
        beforeSnapshot: existing,
        afterSnapshot: voided,
        reason: cleanReason,
      });
      await queueLinkedVoidChanges(db, { moneyMovementId: existing.moneyMovementId, sourceId: expenseId, at: now });
      await enqueueSyncMutation(db, 'expense', expenseId, 'void', voided);
    });
  },
};
