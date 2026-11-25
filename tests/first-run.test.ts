/**
 * S3: first run, demo separation and the legacy-data choice (AP-1, AP-2, AP-3, D15).
 * Rule under test: user data is never silently deleted, overwritten or mixed with demo data.
 */
import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { bootApp, bootEmptyShop, closeApp, dumpAllTables } from './helpers/app';
import { assertLedgerInvariants } from './helpers/invariants';

const shop = {
  shopName: 'মায়ের দোয়া স্টোর',
  ownerName: 'করিম',
  phone: '01712345678',
  businessType: 'মুদি দোকান',
  openingBalances: { cash: 5000, bkash: 1200, nagad: 0, bank: 0 },
};

describe('new shop setup (empty khata by default, D3)', () => {
  it('creates an empty real khata with workspace meta, audit and outbox entries', async () => {
    const app = await bootApp();
    const snap = await app.service.createShop(shop);
    expect(snap.businessProfile).toMatchObject({ shopName: 'মায়ের দোয়া স্টোর', ownerName: 'করিম' });
    expect(snap.parties).toEqual([]);
    expect(snap.sales).toEqual([]);
    expect(snap.products).toEqual([]);
    const ws = await app.db.appMeta.get('workspace');
    expect(ws?.value).toMatchObject({ origin: 'setup' });
    expect(await app.db.auditLogs.where('entityType').equals('business_profile').count()).toBe(1);
    expect(await app.db.syncQueue.count()).toBe(1);
    expect((await app.service.bootstrap()).phase).toBe('ready');
  });

  it('opening balances count towards cash in hand', async () => {
    const app = await bootApp();
    const snap = await app.service.createShop(shop);
    const bal = app.calc.computeCurrentBalances(snap.businessProfile, snap.parties, snap.moneyMovements, snap.products);
    expect(bal.cashInHand).toBe(5000);
    expect(bal.totalLiquidBalance).toBe(6200);
  });

  it('validates: shop name required, Bangladeshi mobile format', async () => {
    const app = await bootApp();
    await expect(app.service.createShop({ ...shop, shopName: '  ' })).rejects.toThrow('দোকানের নাম');
    await expect(app.service.createShop({ ...shop, phone: '12345' })).rejects.toThrow('মোবাইল');
    await expect(app.service.createShop({ ...shop, phone: '০১৮১২৩৪৫৬৭৮' })).resolves.toBeTruthy(); // Bengali digits OK
  });

  it('refuses to create a second shop over an existing one', async () => {
    const app = await bootEmptyShop();
    await expect(app.service.createShop(shop)).rejects.toThrow();
    expect((await app.db.businessProfile.get('default'))?.shopName).toBe('টেস্ট স্টোর');
  });

  it('the new khata survives restarts and startup never seeds it', async () => {
    const app1 = await bootApp();
    await app1.service.createShop(shop);
    await app1.service.createParty({ name: 'রহিম', phone: '', role: 'customer', openingDue: 300 });
    const before = await dumpAllTables(app1);
    closeApp(app1);
    const app2 = await bootApp(app1.factory);
    const start = await app2.service.bootstrap();
    expect(start.phase).toBe('ready');
    expect(await dumpAllTables(app2)).toEqual(before);
  });
});

describe('demo mode lives in its own database (AP-2)', () => {
  it('entering demo seeds only the demo DB; the real khata is untouched', async () => {
    const app = await bootApp();
    await app.service.createShop(shop);
    await app.service.createParty({ name: 'আসল কাস্টমার', phone: '', role: 'customer' });
    const realBefore = await dumpAllTables(app);

    const demoSnap = await app.service.enterDemo();
    expect(demoSnap.parties.length).toBeGreaterThan(0);
    expect(demoSnap.parties.some((p) => p.name === 'আসল কাস্টমার')).toBe(false);

    // Work in demo goes to the demo DB only.
    await app.service.createParty({ name: 'ডেমো কাস্টমার', phone: '', role: 'customer' });
    const realNow = await dumpAllTables(app);
    expect({ ...realNow, appMeta: [] }).toEqual({ ...realBefore, appMeta: [] }); // only the prefs meta changed
    expect(app.dbModule.getDemoDb().name).toBe('jomarkhata_demo');
    expect(await app.dbModule.getDemoDb().parties.where('name').equals('ডেমো কাস্টমার').count()).toBe(1);
  });

  it('demo mode is remembered across restarts, and exiting returns to the real khata', async () => {
    const app1 = await bootApp();
    await app1.service.createShop(shop);
    await app1.service.enterDemo();
    closeApp(app1);
    app1.dbModule.getDemoDb().close();

    const app2 = await bootApp(app1.factory);
    const start = await app2.service.bootstrap();
    expect(start.mode).toBe('demo');
    const back = await app2.service.exitDemo();
    expect(back).toMatchObject({ phase: 'ready', mode: 'real' });
    expect(back.snapshot?.businessProfile.shopName).toBe('মায়ের দোয়া স্টোর');
  });

  it('demo before any real shop: exiting goes back to the welcome screen', async () => {
    const app = await bootApp();
    await app.service.enterDemo();
    expect((await app.service.exitDemo()).phase).toBe('welcome');
  });

  it('resetDemoData resets the demo DB only', async () => {
    const app = await bootApp();
    await app.service.createShop(shop);
    await app.service.createParty({ name: 'আসল কাস্টমার', phone: '', role: 'customer' });
    await app.service.enterDemo();
    await app.service.createParty({ name: 'ডেমো কাস্টমার', phone: '', role: 'customer' });
    const reset = await app.service.resetDemoData();
    expect(reset.parties.some((p) => p.name === 'ডেমো কাস্টমার')).toBe(false);
    expect(await app.db.parties.where('name').equals('আসল কাস্টমার').count()).toBe(1);
  });

  it('demo data never enters the real outbox', async () => {
    const app = await bootApp();
    await app.service.createShop(shop);
    const outboxBefore = await app.db.syncQueue.count();
    await app.service.enterDemo();
    await app.service.createParty({ name: 'ডেমো', phone: '', role: 'customer', openingDue: 100 });
    expect(await app.db.syncQueue.count()).toBe(outboxBefore);
  });
});

describe('existing installs with data from an older build (D15)', () => {
  it('startup asks (legacy_choice) and changes nothing', async () => {
    const app = await bootEmptyShop();
    await app.service.createParty({ name: 'পুরোনো কাস্টমার', phone: '', role: 'customer' });
    const before = await dumpAllTables(app);
    const start = await app.service.bootstrap();
    expect(start.phase).toBe('legacy_choice');
    expect(await dumpAllTables(app)).toEqual(before);
  });

  it('"আমার ব্যবসার হিসাব" keeps every record exactly and marks the workspace', async () => {
    const app = await bootEmptyShop();
    await app.service.createParty({ name: 'পুরোনো কাস্টমার', phone: '', role: 'customer', openingDue: 500 });
    const before = await dumpAllTables(app);
    await app.service.keepLegacyAsMine();
    const after = await dumpAllTables(app);
    expect({ ...after, appMeta: [] }).toEqual({ ...before, appMeta: [] });
    expect((await app.db.appMeta.get('workspace'))?.value).toMatchObject({ origin: 'legacy' });
    expect((await app.service.bootstrap()).phase).toBe('ready');
    await assertLedgerInvariants(app);
  });

  it('"ডেমো হিসাব" MOVES the data into the demo DB (copied and verified, then cleared from real)', async () => {
    const factory = new IDBFactory();
    const app = await bootEmptyShop(factory);
    await app.service.createParty({ name: 'পুরোনো কাস্টমার', phone: '', role: 'customer', openingDue: 500 });
    const before = await dumpAllTables(app);
    await app.service.moveLegacyToDemo();

    const demo = app.dbModule.getDemoDb();
    for (const t of ['businessProfile', 'parties', 'dueTransactions', 'auditLogs'] as const) {
      const rows = (await demo.table(t).toArray()).sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
      expect(rows, t).toEqual(before[t]);
    }
    for (const t of app.db.tables) if (t.name !== 'appMeta') expect(await t.count(), t.name).toBe(0);
    expect((await app.service.bootstrap()).phase).toBe('welcome');
    const demoSnap = await app.service.enterDemo(); // the moved data is what demo now shows
    expect(demoSnap.parties.map((p) => p.name)).toEqual(['পুরোনো কাস্টমার']);
  });

  it('a khata already marked as the owner\'s can never be moved to demo', async () => {
    const app = await bootApp();
    await app.service.createShop(shop);
    await expect(app.service.moveLegacyToDemo()).rejects.toThrow();
    expect(await app.db.businessProfile.count()).toBe(1);
  });
});

describe('first-run UI wiring (static)', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

  it('startup uses the read-only bootstrap, never the old auto-seeding path', () => {
    const ctx = read('context/JomarkhataContext.tsx');
    expect(ctx).toMatch(/jomarkhataService\.bootstrap\(\)/);
    expect(ctx).not.toMatch(/initializeAndLoad\(\)/);
  });

  it('welcome → setup, legacy choice and the demo banner are wired; dev-only preview removed', () => {
    const shell = read('components/layout/AppShell.tsx');
    expect(shell).toMatch(/phase === 'welcome'/);
    expect(shell).toMatch(/<ShopSetupScreen/);
    expect(shell).toMatch(/<LegacyChoiceScreen \/>/);
    expect(shell).toMatch(/ডেমো খাতা দেখছেন/);
    expect(shell).not.toMatch(/preview=welcome|preview'\) === 'welcome'/);
  });

  it('settings offers demo reset only inside demo mode', () => {
    const settings = read('components/views/SettingsView.tsx');
    expect(settings).toMatch(/mode === ['"]demo['"] \?[\s\S]*ডেমো খাতা রিসেট করুন[\s\S]*:[\s\S]*ডেমো খাতা দেখুন/);
  });
});
