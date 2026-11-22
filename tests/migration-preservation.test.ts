/**
 * S0 — Dexie migration & data-preservation guard.
 *
 * Purpose: prove that customer, supplier, transaction, stock and audit records already stored
 * on a device survive app restarts, new app builds (UI changes) and future additive schema
 * migrations. UI and PWA work must never change the DB name or schema without a reviewed,
 * additive migration; the schema-lock test below fails loudly if that happens.
 */
import Dexie from 'dexie';
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
async function buildRealisticShop(app: App) {
  const cust = await app.service.createParty({ name: 'করিম স্টোর', phone: '01711000000', role: 'customer', openingDue: 500 });
  const sup = await app.service.createParty({ name: 'ঢাকা ট্রেডার্স', phone: '01811000000', role: 'supplier' });
  const prod = await app.service.createProduct({
    name: 'সয়াবিন তেল ১ লি.', category: 'মুদি', unit: 'বোতল', purchasePrice: 170, sellingPrice: 190, stockQty: 0, lowStockThreshold: 4,
  });
  await app.service.createPurchase({
    mode: 'product', partyId: sup.id, paymentMethod: 'cash', paidAmount: 1000,
    items: [{ productId: prod.id, name: prod.name, unit: 'বোতল', qty: 12, unitPrice: 170, lineTotal: 2040 }],
  });
  const sale = await app.service.createSale({
    mode: 'product', partyId: cust.id, paymentMethod: 'bkash', paidAmount: 200,
    items: [{ productId: prod.id, name: prod.name, unit: 'বোতল', qty: 3, unitPrice: 190, unitCostSnapshot: 170, lineTotal: 570 }],
  });
  const walkIn = await app.service.createSale({
    mode: 'quick', paymentMethod: 'cash', paidAmount: 120,
    items: [{ productId: null, name: 'বিস্কুট', qty: 1, unitPrice: 120, unitCostSnapshot: null, lineTotal: 120 }],
  });
  await app.service.recordDueEntry({ partyId: cust.id, entryType: 'customer_collection', amount: 300, paymentMethod: 'cash' });
  await app.service.recordDueEntry({ partyId: sup.id, entryType: 'supplier_payment', amount: 500 });
  const exp = await app.service.createExpense({ category: 'ভাড়া', title: 'দোকান ভাড়া', amount: 3000, paymentMethod: 'cash' });
  await app.service.adjustProductStock(prod.id, -1, 'ভাঙা বোতল');
  await app.service.editSale(walkIn.id, {
    mode: 'quick', paymentMethod: 'cash', paidAmount: 150,
    items: [{ productId: null, name: 'বিস্কুট', qty: 1, unitPrice: 150, unitCostSnapshot: null, lineTotal: 150 }],
  });
  await app.service.voidExpense(exp.id, 'ভুল এন্ট্রি');
  return { cust, sup, prod, sale };
}

describe('schema lock (any change must be a deliberate, additive migration)', () => {
  it('database name and version are unchanged', async () => {
    const app = await bootApp();
    expect(app.dbModule.JOMARKHATA_DB_NAME).toBe('jomarkhata_db');
    expect(app.dbModule.JOMARKHATA_DB_VERSION).toBe(1);
    await app.db.open();
    expect(app.db.verno).toBe(1);
  });

  it('tables, primary keys and indexes match the shipped v1 schema', async () => {
    const app = await bootApp();
    await app.db.open();
    const actual = Object.fromEntries(
      app.db.tables.map((t) => [t.name, [t.schema.primKey.src, ...t.schema.indexes.map((i) => i.src)].join(', ')])
    );
    expect(actual).toEqual(V1_SCHEMA);
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
    const snap = await app.service.initializeAndLoad();
    expect(snap.businessProfile.shopName).toBe('পুরোনো দোকান');
    for (const t of app.db.tables) {
      const rows = await t.toArray();
      expect(rows, t.name).toEqual(legacyDump[t.name]);
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

describe('current first-run behaviour (characterised before S3 changes it under AP-1/AP-2)', () => {
  it('a fresh device is auto-seeded with demo data; user work survives restarts and is not re-seeded', async () => {
    const app1 = await bootApp();
    const first = await app1.service.initializeAndLoad();
    const seededParties = first.parties.length;
    expect(seededParties).toBeGreaterThan(0);
    const mine = await app1.service.createParty({ name: 'আমার কাস্টমার', phone: '', role: 'customer' });
    closeApp(app1);

    const app2 = await bootApp(app1.factory);
    const again = await app2.service.initializeAndLoad();
    expect(again.parties).toHaveLength(seededParties + 1);
    expect(again.parties.some((p) => p.id === mine.id)).toBe(true);
  });

  it('KNOWN RISK (fixed in S3/S8): resetDemoData wipes user-entered records as well', async () => {
    const app = await bootApp();
    await app.service.initializeAndLoad();
    const mine = await app.service.createParty({ name: 'আমার কাস্টমার', phone: '', role: 'customer' });
    await app.service.resetDemoData();
    expect(await app.db.parties.get(mine.id)).toBeUndefined();
  });
});

describe('future additive migration pattern (harness for AP-3 / AP-4; the app schema itself is NOT changed)', () => {
  it('opening v1 data with a v2 schema that adds a table and outbox fields preserves every existing record', async () => {
    const app = await bootEmptyShop();
    await buildRealisticShop(app);
    const before = await dumpAllTables(app);
    const factory = app.factory;
    closeApp(app);

    // Test-only candidate v2 — mirrors the planned AP-3 (appMeta table) and AP-4 (outbox status/retry fields).
    const v2 = new Dexie('jomarkhata_db', { indexedDB: factory, IDBKeyRange });
    v2.version(1).stores(V1_SCHEMA);
    v2.version(2)
      .stores({ appMeta: 'key', syncQueue: 'id, entityType, entityId, operation, syncStatus, queuedAt, status' })
      .upgrade(async (tx) => {
        await tx.table('syncQueue').toCollection().modify((item: Record<string, unknown>) => {
          item.status = 'pending';
          item.retryCount = 0;
          item.lastError = null;
        });
      });
    await v2.open();
    expect(v2.verno).toBe(2);

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

describe('backup export (input for S8 restore)', () => {
  it('the JSON backup contains every business record', async () => {
    const app = await bootEmptyShop();
    await buildRealisticShop(app);
    const backup = JSON.parse(await app.service.exportBackupJson());
    expect(backup.schemaVersion).toBe(1);
    expect(backup.data.businessProfile.id).toBe('default');
    for (const t of BUSINESS_TABLES.filter((x) => x !== 'businessProfile')) {
      const ids = (backup.data[t] as Array<{ id: string }>).map((r) => r.id).sort();
      const dbIds = (await app.db.table(t).toArray()).map((r: { id: string }) => r.id).sort();
      expect(ids, t).toEqual(dbIds);
    }
  });

  it('KNOWN GAP (S8): the backup has only a pending count, not the sync outbox items', async () => {
    const app = await bootEmptyShop();
    await buildRealisticShop(app);
    const backup = JSON.parse(await app.service.exportBackupJson());
    expect(backup.data.syncQueue).toBeUndefined();
    expect(backup.data.pendingSyncCount).toBe(await app.db.syncQueue.count());
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
