/**
 * Sync runner (S9, plan 7.5): decides WHEN the engine runs.
 * Triggers: start, the `online` event, the tab becoming visible, and a periodic timer while online.
 * Only one tab runs at a time (Web Locks API; without it the tab simply runs, and the server is
 * idempotent by opId anyway). Background Sync is never relied on (iOS lacks it).
 *
 * Started only when a real transport exists. `getSyncTransport()` returns null until the backend
 * phase, so today nothing is ever sent.
 */
import type { SyncEngine } from './engine';
import type { SyncTransport } from './engine';

/** No backend yet → no transport. The backend phase replaces this with an HTTP transport. */
export function getSyncTransport(): SyncTransport | null {
  return null;
}

export function startSyncRunner(engine: SyncEngine, opts: { intervalMs?: number } = {}): () => void {
  let stopped = false;
  let running = false;

  const run = async () => {
    if (stopped || running || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    running = true;
    try {
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      if (locks?.request) await locks.request('jk-sync', { ifAvailable: true }, async (lock) => (lock ? engine.runOnce() : undefined));
      else await engine.runOnce();
    } catch {
      /* errors are recorded per item by the engine; the next trigger retries */
    } finally {
      running = false;
    }
  };

  const onVisible = () => document.visibilityState === 'visible' && void run();
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(run, opts.intervalMs ?? 60_000);
  void run();

  return () => {
    stopped = true;
    window.removeEventListener('online', run);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}
