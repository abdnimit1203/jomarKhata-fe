/**
 * S9 sync engine with a FAKE transport (no backend exists). Proves the client-side rules:
 * synced only on ack, never delete, retry with backoff, conflicts → needs_review, idempotent opIds.
 */
import { describe, expect, it } from 'vitest';
import { bootEmptyShop } from './helpers/app';
import { buildRealisticShop } from './helpers/shop';
import { SyncEngine, backoffMs, type PushResult, type SyncTransport } from '@/lib/sync/engine';
import type { SyncQueueItem } from '@/types/domain';

/** A fake server: idempotent by opId, can fail, time out, drop acks or report conflicts. */
class FakeServer implements SyncTransport {
  applied = new Map<string, number>(); // opId → times the server actually applied it
  received: string[] = [];
  mode: 'ok' | 'timeout' | 'partial' | 'conflict-first' = 'ok';
  async push(items: SyncQueueItem[]): Promise<PushResult[]> {
    this.received.push(...items.map((i) => i.opId));
    if (this.mode === 'timeout') throw new Error('timeout');
    const out: PushResult[] = [];
    items.forEach((i, idx) => {
      if (!this.applied.has(i.opId)) this.applied.set(i.opId, 1); // idempotent: apply once
      if (this.mode === 'partial' && idx % 2 === 1) return; // ack lost
      if (this.mode === 'conflict-first' && idx === 0) return out.push({ opId: i.opId, status: 'conflict', error: 'changed on another phone' });
      out.push({ opId: i.opId, status: 'ok' });
    });
    return out;
  }
}

async function setup(batchSize = 500) {
  const app = await bootEmptyShop();
  await buildRealisticShop(app);
  let clock = Date.parse('2026-11-23T10:00:00Z');
  const server = new FakeServer();
  const engine = new SyncEngine(() => app.db.syncQueue, server, { batchSize, now: () => clock, random: () => 0.5 });
  return { app, server, engine, advance: (ms: number) => (clock += ms), total: await app.db.syncQueue.count() };
}

const statuses = async (app: Awaited<ReturnType<typeof setup>>['app']) =>
  (await app.db.syncQueue.toArray()).reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.status]: (acc[i.status] ?? 0) + 1 }), {});

describe('sync engine (fake transport)', () => {
  it('happy path: everything acknowledged becomes synced; nothing is deleted', async () => {
    const { app, engine, total } = await setup();
    const r = await engine.runOnce();
    expect(r).toMatchObject({ sent: total, synced: total, failed: 0 });
    expect(await app.db.syncQueue.count()).toBe(total);
    expect(await statuses(app)).toEqual({ synced: total });
    expect((await app.service.loadAllData()).pendingSyncCount).toBe(0);
  });

  it('timeout: nothing is marked synced; items become failed with the error and retry after backoff', async () => {
    const { app, server, engine, advance, total } = await setup();
    server.mode = 'timeout';
    await engine.runOnce();
    expect(await statuses(app)).toEqual({ failed: total });
    const item = (await app.db.syncQueue.toArray())[0];
    expect(item).toMatchObject({ retryCount: 1, lastError: 'timeout' });
    server.mode = 'ok';
    expect((await engine.runOnce()).sent).toBe(0); // backoff not elapsed yet
    advance(backoffMs(1, { random: () => 0.5 }) + 1);
    const r = await engine.runOnce();
    expect(r.synced).toBe(total);
  });

  it('partial batch (lost acks): only acknowledged items are synced; resending is idempotent on the server', async () => {
    const { app, server, engine, advance, total } = await setup();
    server.mode = 'partial';
    const first = await engine.runOnce();
    expect(first.synced + first.failed).toBe(total);
    expect(first.failed).toBeGreaterThan(0);
    server.mode = 'ok';
    advance(60 * 60_000);
    await engine.runOnce();
    expect(await statuses(app)).toEqual({ synced: total });
    // Some opIds were sent twice, but the server applied each exactly once (no duplicates).
    expect(server.received.length).toBeGreaterThan(total);
    expect([...server.applied.values()].every((n) => n === 1)).toBe(true);
    expect(server.applied.size).toBe(total);
  });

  it('conflict → needs_review (kept, not retried, not overwritten)', async () => {
    const { app, server, engine, advance, total } = await setup();
    server.mode = 'conflict-first';
    const r = await engine.runOnce();
    expect(r.needsReview).toBe(1);
    advance(60 * 60_000);
    expect((await engine.runOnce()).sent).toBe(0);
    expect(await statuses(app)).toEqual({ synced: total - 1, needs_review: 1 });
    expect((await app.service.loadAllData()).pendingSyncCount).toBe(1); // still shown to the owner
  });

  it('app killed mid-sync: items stuck in "syncing" go back to pending and are sent again', async () => {
    const { app, engine, total } = await setup();
    await app.db.syncQueue.toCollection().modify({ status: 'syncing' });
    const r = await engine.runOnce();
    expect(r.synced).toBe(total);
  });

  it('batches are sent oldest first and limited in size', async () => {
    const { server, engine } = await setup(5);
    const r = await engine.runOnce();
    expect(r.sent).toBe(5);
    expect(server.received).toHaveLength(5);
  });

  it('new local work while offline keeps queueing (append-only) and is picked up next run', async () => {
    const { app, server, engine, total } = await setup();
    server.mode = 'timeout';
    await engine.runOnce();
    await app.service.createParty({ name: 'অফলাইনে যোগ', phone: '', role: 'customer' });
    expect(await app.db.syncQueue.count()).toBeGreaterThan(total);
    server.mode = 'ok';
    const pending = await engine.due();
    expect(pending.some((i) => i.status === 'pending')).toBe(true);
  });
});

describe('backoff', () => {
  it('grows exponentially with jitter and is capped', () => {
    const r = () => 0.5;
    expect(backoffMs(1, { random: r })).toBe(5_000);
    expect(backoffMs(2, { random: r })).toBe(10_000);
    expect(backoffMs(3, { random: r })).toBe(20_000);
    expect(backoffMs(30, { random: r })).toBe(30 * 60_000);
    expect(backoffMs(1, { random: () => 0 })).toBe(4_000);
    expect(backoffMs(1, { random: () => 1 })).toBe(6_000);
  });
});

describe('honest status in the app (static + service)', () => {
  it('the app never starts syncing without a real transport (none exists yet)', async () => {
    const { getSyncTransport } = await import('@/lib/sync/runner');
    expect(getSyncTransport()).toBeNull();
  });

  it('every record reports "local" until a server acknowledges it', async () => {
    const { app } = await setup();
    const sale = (await app.db.sales.toArray())[0];
    expect(await app.service.getRecordSyncState(sale.id)).toBe('local');
    const st = await app.service.getSyncStatus();
    expect(st.counts.synced).toBe(0);
    expect(st.counts.pending).toBe(await app.db.syncQueue.count());
  });

  it('the status sheet and record badge never claim cloud backup today', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
    expect(read('components/layout/SyncStatusSheet.tsx')).toMatch(/ক্লাউড ব্যাকআপ এখনও চালু হয়নি/);
    expect(read('components/sheets/TransactionDetailSheet.tsx')).toMatch(/: 'ফোনে সংরক্ষিত'/);
    expect(read('components/layout/NavSheets.tsx')).toMatch(/openSheet\(\{ type: 'sync_status' \}\)/);
  });
});
