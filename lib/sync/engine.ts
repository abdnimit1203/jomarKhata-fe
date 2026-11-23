/**
 * Sync engine (S9, plan 7.3/7.5). Sends outbox items through a transport and records the result.
 * There is NO real transport yet (no backend): the app never starts the engine, and every record
 * honestly stays "ফোনে সংরক্ষিত". Tests drive it with a fake transport.
 *
 * Rules (OFFLINE_SYNC.md):
 * - An item becomes `synced` ONLY when the server acknowledges its opId. Unacknowledged → `failed`.
 * - Items are never deleted. Failed items keep `lastError` and are retried with exponential backoff.
 * - A server conflict marks the item `needs_review`; nothing is overwritten silently.
 * - opId is the idempotency key: resending the same op is safe (the server returns the first result).
 */
import type { Table } from 'dexie';
import type { SyncQueueItem } from '@/types/domain';

export type PushStatus = 'ok' | 'conflict' | 'error';
export interface PushResult {
  opId: string;
  status: PushStatus;
  error?: string;
}

/** The only thing the backend phase has to implement on the client side. */
export interface SyncTransport {
  push(items: SyncQueueItem[]): Promise<PushResult[]>;
}

export interface EngineOptions {
  batchSize?: number;
  now?: () => number;
  random?: () => number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface RunSummary {
  sent: number;
  synced: number;
  failed: number;
  needsReview: number;
}

/** Exponential backoff with ±20% jitter: 5s, 10s, 20s … capped at 30 min. */
export function backoffMs(retryCount: number, opts: EngineOptions = {}): number {
  const base = opts.baseDelayMs ?? 5_000;
  const max = opts.maxDelayMs ?? 30 * 60_000;
  const raw = Math.min(max, base * 2 ** Math.max(0, retryCount - 1));
  const jitter = 0.8 + 0.4 * (opts.random ?? Math.random)();
  return Math.round(raw * jitter);
}

export class SyncEngine {
  constructor(
    private readonly queue: () => Table<SyncQueueItem, string>,
    private readonly transport: SyncTransport,
    private readonly opts: EngineOptions = {}
  ) {}

  private now() {
    return (this.opts.now ?? Date.now)();
  }

  /** Items left in `syncing` by a killed app go back to `pending` (they were never acknowledged). */
  async recoverInterrupted(): Promise<number> {
    return this.queue().where('status').equals('syncing').modify({ status: 'pending' });
  }

  /** pending + failed items whose backoff has elapsed, oldest first. */
  async due(): Promise<SyncQueueItem[]> {
    const now = this.now();
    const items = await this.queue().where('status').anyOf(['pending', 'failed']).toArray();
    return items
      .filter((i) => {
        if (i.status === 'pending' || !i.lastAttemptAt) return true;
        return Date.parse(i.lastAttemptAt) + backoffMs(i.retryCount, this.opts) <= now;
      })
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.id.localeCompare(b.id))
      .slice(0, this.opts.batchSize ?? 50);
  }

  async runOnce(): Promise<RunSummary> {
    const summary: RunSummary = { sent: 0, synced: 0, failed: 0, needsReview: 0 };
    await this.recoverInterrupted();
    const batch = await this.due();
    if (batch.length === 0) return summary;
    const attemptAt = new Date(this.now()).toISOString();
    await this.queue().bulkUpdate(batch.map((i) => ({ key: i.id, changes: { status: 'syncing' as const, lastAttemptAt: attemptAt } })));
    summary.sent = batch.length;

    let results: PushResult[];
    try {
      results = await this.transport.push(batch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'network error';
      await this.queue().bulkUpdate(
        batch.map((i) => ({ key: i.id, changes: { status: 'failed' as const, retryCount: i.retryCount + 1, lastError: msg } }))
      );
      summary.failed = batch.length;
      return summary;
    }

    const byOp = new Map(results.map((r) => [r.opId, r]));
    for (const item of batch) {
      const r = byOp.get(item.opId);
      if (r?.status === 'ok') {
        await this.queue().update(item.id, { status: 'synced', lastError: null });
        summary.synced++;
      } else if (r?.status === 'conflict') {
        await this.queue().update(item.id, { status: 'needs_review', lastError: r.error ?? 'সার্ভারে অন্য পরিবর্তন আছে' });
        summary.needsReview++;
      } else {
        await this.queue().update(item.id, {
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastError: r?.error ?? 'সার্ভার নিশ্চিত করেনি (no ack)',
        });
        summary.failed++;
      }
    }
    return summary;
  }
}
