/**
 * S0 — Dexie migration & data-preservation guard.
 *
 * Purpose: prove that customer, supplier, transaction, stock and audit records already stored
 * on a device survive app restarts, new app builds (UI changes) and future additive schema
 * migrations. UI and PWA work must never change the DB name or schema without a reviewed,
 * additive migration; the schema-lock test below fails loudly if that happens.
 */
import Dexie from 'dexie';
import { buildRealisticShop } from './helpers/shop';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { bootApp, bootEmptyShop, closeApp, dumpAllTables, type App } from './helpers/app';
import { assertLedgerInvariants } from './helpers/invariants';

/** The v1 schema exactly as shipped by the existing app. Changing it requires a version(2) migration. */
const V1_SCHEMA: Record<string, string> = {
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
};

const BUSINESS_TABLES = [
  'businessProfile',
  'parties',
  'products',
  'sales',
  'purchases',
  'moneyMovements',
  'dueTransactions',
  'expenses',
  'stockMovements',
  'auditLogs',
] as const;

/** Creates one of every record type through the real service (customer, supplier, stock, sale, purchase, due, expense, edits, voids). */

/** v2 (S3, AP-3): v1 plus the `appMeta` table. Every v1 table and index is unchanged. */
const V2_SCHEMA: Record<string, string> = { ...V1_SCHEMA, appMeta: 'key' };

describe('schema lock (any change must be a deliberate, additive migration)', () => {
  it('database name is unchanged; version is 2 (AP-3)', async () => {
    const app = await bootApp();
    expect(app.dbModule.JOMARKHATA_DB_NAME).toBe('jomarkhata_db');
    expect(app.dbModule.JOMARKHATA_DB_VERSION).toBe(2);
    await app.db.open();
    expect(app.db.verno).toBe(2);
  });

  it('tables, primary keys and indexes = v1 schema + appMeta (nothing removed or re-indexed)', async () => {
    const app = await bootApp();
    await app.db.open();
    const actual = Object.fromEntries(
      app.db.tables.map((t) => [t.name, [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(', ')])
    );
    expect(actual).toEqual(V2_SCHEMA);
  });
});

describe('records survive app restarts (reload / app kill / new build / PWA relaunch)', () => {
  it('every table, including audit history and the sync outbox, is identical after a restart', async () => {
    const app1 = await bootEmptyShop();
    await buildRealisticShop(app1);
    await assertLedgerInvariants(app1);
    const before = await dumpAllTables(app1);
    closeApp(app1);

    const app2 = await bootApp(app1.factory); // same device storage, fresh JS runtime
    await app2.service.initializeAndLoad(); // the app's real startup path
    const after = await dumpAllTables(app2);

    expect(after).toEqual(before);
    for (const t of BUSINESS_TABLES) expect((after[t] as unknown[]).length, t).toBeGreaterThan(0);
    await assertLedgerInvariants(app2);
  });

  it('startup never re-seeds or overwrites an existing shop', async () => {
    const app1 = await bootEmptyShop();
    await app1.service.createParty({ name: 'শুধু আমার কাস্টমার', phone: '', role: 'customer' });
    closeApp(app1);
    const app2 = await bootApp(app1.factory);
    const snap = await app2.service.initializeAndLoad();
    expect(snap.businessProfile.shopName).toBe('টেস্ট স্টোর');
    expect(snap.parties.map((p) => p.name)).toEqual(['শুধু আমার কাস্টমার']);
  });

  it('many restarts with work in between never lose earlier records', async () => {
    let app = await bootEmptyShop();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = await app.service.createParty({ name: `কাস্টমার ${i}`, phone: '', role: 'customer', openingDue: 100 * (i + 1) });
      ids.push(p.id);
      closeApp(app);
      app = await bootApp(app.factory);
      await app.service.initializeAndLoad();
    }
    const parties = await app.db.parties.toArray();
    expect(parties.map((p) => p.id).sort()).toEqual([...ids].sort());
    await assertLedgerInvariants(app);
  });
});

describe('existing installs: data written by an older build of the app', () => {
  it('a raw v1 database (not created through the current code) is opened and read without any change', async () => {
    const factory = new IDBFactory();
    Dexie.dependencies.indexedDB = factory;
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;

    // 1. An older build wrote this data (simulated with the shipped seed dataset + a plain Dexie v1 handle).
    const { buildSeedDataset } = await import('@/db/seedData');
    const legacy = new Dexie('jomarkhata_db');
    legacy.version(1).stores(V1_SCHEMA);
    const seed = buildSeedDataset();
    await legacy.table('businessProfile').put({ ...seed.businessProfile, shopName: 'পুরোনো দোকান' });
    for (const t of BUSINESS_TABLES.filter((x) => x !== 'businessProfile')) {
      await legacy.table(t).bulkPut(seed[t] as unknown[]);
    }
    const legacyDump: Record<string, unknown[]> = {};
    for (const t of legacy.tables) legacyDump[t.name] = await t.toArray();
    legacy.close();

    // 2. The current app opens the same storage.
    const app = await bootApp(factory);
    const start = await app.service.bootstrap(); // upgrades v1 -> v2 on open
    expect(app.db.verno).toBe(2);
    expect(start.phase).toBe('legacy_choice'); // D15: the owner decides; nothing changed yet
    expect(start.snapshot?.businessProfile.shopName).toBe('পুরোনো দোকান');
    for (const t of app.db.tables) {
      const rows = await t.toArray();
      if (t.name === 'appMeta') expect(rows).toEqual([]);
      else expect(rows, t.name).toEqual(legacyDump[t.name]);
    }

    // 3. New work on top of the old data leaves old records untouched.
    await app.service.createSale({
      mode: 'quick', paymentMethod: 'cash', paidAmount: 50,
      items: [{ productId: null, name: 'চা', qty: 1, unitPrice: 50, unitCostSnapshot: null, lineTotal: 50 }],
    });
    for (const t of ['parties', 'products', 'dueTransactions', 'expenses', 'stockMovements'] as const) {
      expect(await app.db.table(t).toArray(), t).toEqual(legacyDump[t]);
    }
    expect(await app.db.sales.count()).toBe(legacyDump.sales.length + 1);
  });
});

describe('first run after S3 (AP-1/AP-2): no auto-seed; demo is a separate database', () => {
  it('a fresh device is NOT seeded: startup shows welcome and writes nothing', async () => {
    const app = await bootApp();
    const start = await app.service.bootstrap();
    expect(start).toMatchObject({ phase: 'welcome', mode: 'real', snapshot: null });
    for (const t of app.db.tables) expect(await t.count(), t.name).toBe(0);
  });

  it('resetDemoData refuses in the real khata and never touches user records (old risk fixed)', async () => {
    const app = await bootEmptyShop();
    const mine = await app.service.createParty({ name: 'আমার কাস্টমার', phone: '', role: 'customer' });
    await expect(app.service.resetDemoData()).rejects.toThrow();
    expect(await app.db.parties.get(mine.id)).toBeDefined();
  });
});

describe('future additive migration pattern (harness for AP-4 as v3; the app schema itself is NOT changed)', () => {
  it('opening v2 data with a v3 schema that adds outbox fields preserves every existing record', async () => {
    const app = await bootEmptyShop();
    await buildRealisticShop(app);
    const before = await dumpAllTables(app);
    const factory = app.factory;
    closeApp(app);

    // Test-only candidate v2 — mirrors the planned AP-3 (appMeta table) and AP-4 (outbox status/retry fields).
    const v2 = new Dexie('jomarkhata_db', { indexedDB: factory, IDBKeyRange });
    v2.version(1).stores(V1_SCHEMA);
    v2.version(2).stores({ appMeta: 'key' }); // the shipped v2 (S3)
    v2.version(3)
      .stores({ syncQueue: 'id, entityType, entityId, operation, syncStatus, queuedAt, status' })
      .upgrade(async (tx) => {
        await tx.table('syncQueue').toCollection().modify((item: Record<string, unknown>) => {
          item.status = 'pending';
          item.retryCount = 0;
          item.lastError = null;
        });
      });
    await v2.open();
    expect(v2.verno).toBe(3);

    for (const t of BUSINESS_TABLES) {
      expect(await v2.table(t).toArray(), t).toEqual(before[t]);
    }
    const queue = (await v2.table('syncQueue').toArray()).sort((a, b) => a.id.localeCompare(b.id));
    expect(queue).toHaveLength(before.syncQueue.length);
    queue.forEach((item, i) => {
      expect(item).toMatchObject(before.syncQueue[i] as object); // all original fields kept
      expect(item).toMatchObject({ status: 'pending', retryCount: 0 });
    });
    expect(await v2.table('appMeta').count()).toBe(0);
    v2.close();
  });
});

describe('backup export (v2 since S8)', () => {
  it('the backup contains every business record, including the sync outbox (old gap closed)', async () => {
    const app = await bootEmptyShop();
    await buildRealisticShop(app);
    const backup = JSON.parse(await app.service.exportBackupJson());
    expect(backup).toMatchObject({ format: 'jomarkhata-backup', formatVersion: 2 });
    expect(backup.data.businessProfile.id).toBe('default');
    for (const t of [...BUSINESS_TABLES.filter((x) => x !== 'businessProfile'), 'syncQueue']) {
      const ids = (backup.data[t] as Array<{ id: string }>).map((r) => r.id).sort();
      const dbIds = (await app.db.table(t).toArray()).map((r: { id: string }) => r.id).sort();
      expect(ids, t).toEqual(dbIds);
    }
  });
});

describe('sync outbox behaviour today (input for S9 / AP-4)', () => {
  it('normal operations only ever append to the outbox; nothing is removed', async () => {
    const app = await bootEmptyShop();
    let last = 0;
    const check = async () => {
      const n = await app.db.syncQueue.count();
      expect(n).toBeGreaterThanOrEqual(last);
      last = n;
    };
    const { cust } = await buildRealisticShop(app);
    await check();
    await app.service.recordDueEntry({ partyId: cust.id, entryType: 'manual_due_given', amount: 10 });
    await check();
    const items = await app.db.syncQueue.toArray();
    expect(items.every((i) => i.syncStatus === 'pending')).toBe(true);
  });

  it('KNOWN GAP (AP-4): voiding a sale queues only the sale; its linked money movement / due changes have no own outbox op', async () => {
    const app = await bootEmptyShop();
    const { sale } = await buildRealisticShop(app);
    await app.service.voidSale(sale.id, 'test');
    const ops = await app.db.syncQueue.toArray();
    expect(ops.filter((o) => o.entityId === sale.id && o.operation === 'void')).toHaveLength(1);
    const mmOps = ops.filter((o) => o.entityId === sale.moneyMovementId);
    expect(mmOps.map((o) => o.operation)).toEqual(['upsert']); // only the original create; the void is not queued
  });
});
