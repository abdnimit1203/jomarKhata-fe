/**
 * S8: backup v2 (AP-11) and validated, atomic restore + clear khata (AP-10).
 * Rule under test: a bad file never changes anything; a good one restores every record exactly.
 */
import { describe, expect, it, vi } from 'vitest';
import { bootApp, bootEmptyShop, dumpAllTables } from './helpers/app';
import { buildRealisticShop } from './helpers/shop';
import { assertLedgerInvariants } from './helpers/invariants';
import { buildBackupFile, sha256Hex } from '@/lib/backup';

const withoutMeta = (d: Record<string, unknown[]>) => ({ ...d, appMeta: [] });

async function shopWithBackup(password?: string) {
  const app = await bootEmptyShop();
  await app.service.keepLegacyAsMine();
  await buildRealisticShop(app);
  const file = await app.service.exportBackupJson(password);
  return { app, file, before: await dumpAllTables(app) };
}

describe('backup file v2', () => {
  it('has metadata, counts and a checksum that matches the data', async () => {
    const { file, before } = await shopWithBackup();
    const b = JSON.parse(file);
    expect(b).toMatchObject({ format: 'jomarkhata-backup', formatVersion: 2, dbVersion: 2, shopName: 'টেস্ট স্টোর' });
    expect(b.counts.sales).toBe(before.sales.length);
    expect(b.counts.syncQueue).toBe(before.syncQueue.length);
    expect(await sha256Hex(JSON.stringify(b.data))).toBe(b.checksum);
  });

  it('records the last backup time (for the reminder)', async () => {
    const { app } = await shopWithBackup();
    expect(await app.service.getLastBackupAt()).toBeTruthy();
  });

  it('password backup is encrypted: no readable shop data in the file', async () => {
    const { file } = await shopWithBackup('গোপন123');
    const b = JSON.parse(file);
    expect(b.encrypted).toBe(true);
    expect(file).not.toContain('টেস্ট স্টোর');
    expect(file).not.toContain('invoiceNo');
  });
});

describe('restore (validated, atomic, replace-only)', () => {
  it('round trip onto a NEW device restores every table exactly and the books balance', async () => {
    const { file, before } = await shopWithBackup();
    const phone2 = await bootApp();
    expect((await phone2.service.bootstrap()).phase).toBe('welcome');
    const preview = await phone2.service.inspectBackup(file);
    expect(preview).toMatchObject({ formatVersion: 2, shopName: 'টেস্ট স্টোর', checksumVerified: true });
    await phone2.service.restoreBackup(file);
    expect(withoutMeta(await dumpAllTables(phone2))).toEqual(withoutMeta(before));
    expect((await phone2.service.bootstrap()).phase).toBe('ready');
    await assertLedgerInvariants(phone2);
  });

  it('password backup restores with the right password and is refused with a wrong one', async () => {
    const { file, before } = await shopWithBackup('গোপন123');
    const phone2 = await bootApp();
    await expect(phone2.service.inspectBackup(file)).rejects.toThrow('পাসওয়ার্ড');
    await expect(phone2.service.restoreBackup(file, 'ভুল')).rejects.toThrow('পাসওয়ার্ড ভুল');
    for (const t of phone2.db.tables) expect(await t.count(), t.name).toBe(0);
    await phone2.service.restoreBackup(file, 'গোপন123');
    expect(withoutMeta(await dumpAllTables(phone2))).toEqual(withoutMeta(before));
  });

  it('a tampered file (one amount changed) is rejected and nothing changes', async () => {
    const { app, file } = await shopWithBackup();
    const b = JSON.parse(file);
    b.data.sales[0].total += 1;
    const current = await dumpAllTables(app);
    await expect(app.service.restoreBackup(JSON.stringify(b))).rejects.toThrow('checksum');
    expect(await dumpAllTables(app)).toEqual(current);
  });

  it('a file whose links are broken (sale → missing party) is rejected even with a valid checksum', async () => {
    const { app } = await shopWithBackup();
    const data = await app.service.readBackupData();
    const sale = (data.sales as Array<{ partyId: string | null }>).find((x) => x.partyId)!;
    sale.partyId = 'missing-party';
    const forged = await buildBackupFile(data, 2);
    await expect(app.service.inspectBackup(forged)).rejects.toThrow('সম্পর্ক মেলেনি');
  });

  it("random JSON, other apps' files and damaged records are rejected", async () => {
    const app = await bootApp();
    await expect(app.service.inspectBackup('not json')).rejects.toThrow();
    await expect(app.service.inspectBackup('{"hello":1}')).rejects.toThrow('ব্যাকআপ নয়');
    const { app: a2 } = await shopWithBackup();
    const data = await a2.service.readBackupData();
    (data.parties as Array<Record<string, unknown>>)[0].role = 'boss';
    await expect(a2.service.inspectBackup(await buildBackupFile(data, 2))).rejects.toThrow('ঠিক নেই');
  });

  it('old v1 backups (from earlier builds) still restore; the outbox starts empty', async () => {
    const { app, before } = await shopWithBackup();
    const snap = await app.service.loadAllData();
    const v1 = JSON.stringify({ app: 'Jomarkhata (জমারখাতা)', schemaVersion: 1, exportedAt: new Date().toISOString(), data: snap });
    const phone2 = await bootApp();
    const preview = await phone2.service.inspectBackup(v1);
    expect(preview.formatVersion).toBe(1);
    expect(preview.notes.join(' ')).toMatch(/v1/);
    await phone2.service.restoreBackup(v1);
    const after = await dumpAllTables(phone2);
    for (const t of ['parties', 'sales', 'purchases', 'dueTransactions', 'expenses', 'moneyMovements', 'stockMovements']) {
      expect(after[t], t).toEqual(before[t]);
    }
    expect(after.syncQueue).toEqual([]);
  });

  it('a failure in the middle of applying a restore leaves the current khata untouched (one transaction)', async () => {
    const { file } = await shopWithBackup();
    const target = await bootEmptyShop();
    await target.service.keepLegacyAsMine();
    await target.service.createParty({ name: 'বর্তমান কাস্টমার', phone: '', role: 'customer', openingDue: 200 });
    const current = await dumpAllTables(target);
    // Make writing the `expenses` table fail half-way through the restore.
    const proto = Object.getPrototypeOf(target.db.expenses) as { bulkPut: (...a: unknown[]) => Promise<unknown> };
    const original = proto.bulkPut;
    const spy = vi.spyOn(proto, 'bulkPut').mockImplementation(function (this: { name: string }, ...args: unknown[]) {
      if (this.name === 'expenses') return Promise.reject(new Error('disk error'));
      return original.apply(this, args);
    });
    await expect(target.service.restoreBackup(file)).rejects.toThrow('disk error');
    spy.mockRestore();
    const after = await dumpAllTables(target);
    expect(withoutMeta(after)).toEqual(withoutMeta(current));
  });

  it('a safety copy of the current khata is kept before restoring', async () => {
    const { file } = await shopWithBackup();
    const target = await bootEmptyShop();
    await target.service.keepLegacyAsMine();
    await target.service.createParty({ name: 'আগের কাস্টমার', phone: '', role: 'customer' });
    await target.service.restoreBackup(file);
    const safety = await target.service.getSafetyCopy();
    expect(safety?.reason).toBe('restore');
    expect(safety?.json).toContain('আগের কাস্টমার');
  });

  it('restore is refused in demo mode (never mixes demo and real)', async () => {
    const { file } = await shopWithBackup();
    const app = await bootApp();
    await app.service.enterDemo();
    await expect(app.service.restoreBackup(file)).rejects.toThrow('ডেমো');
  });
});

describe('clear khata (guarded)', () => {
  it('removes every record, keeps the shop profile, saves a safety copy and logs it', async () => {
    const { app } = await shopWithBackup();
    const snap = await app.service.clearKhata();
    expect(snap.businessProfile.shopName).toBe('টেস্ট স্টোর');
    for (const t of ['parties', 'products', 'sales', 'purchases', 'moneyMovements', 'dueTransactions', 'expenses', 'stockMovements', 'syncQueue']) {
      expect(await app.db.table(t).count(), t).toBe(0);
    }
    expect((await app.db.auditLogs.toArray()).map((l) => l.summary).join()).toMatch(/খাতা খালি/);
    expect((await app.service.getSafetyCopy())?.reason).toBe('clear');
  });
});
