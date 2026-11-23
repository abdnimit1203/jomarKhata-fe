/**
 * AP-8: remembers which rows each khata database wrote, so a save can re-read only those rows
 * instead of the whole khata (see `jomarkhataService.loadChanges`).
 *
 * A Dexie DBCore middleware sees every write request (add / put / delete / deleteRange). It only
 * records keys and never reads anything. Unlike table hooks, it doesn't make `clear()` read every
 * row first, so restore stays fast.
 *
 * Safety: the tracker may record MORE than really changed (for example, a write whose transaction
 * later aborts). That's harmless, because changed rows are re-read from the database. It must never
 * record less. Any write whose keys it can't see marks the whole table instead.
 */
import type Dexie from 'dexie';
import type { DBCoreMutateRequest } from 'dexie';

export interface PendingChanges {
  /** Table name → primary keys written since the last take. */
  keys: Map<string, Set<string>>;
  /** Tables that need a full re-read (range delete, clear, or keys not visible). */
  whole: Set<string>;
}

const trackers = new WeakMap<Dexie, PendingChanges>();

const empty = (): PendingChanges => ({ keys: new Map(), whole: new Set() });

function record(state: PendingChanges, table: string, req: DBCoreMutateRequest) {
  if (req.type === 'deleteRange') {
    state.whole.add(table);
    return;
  }
  let keys: unknown[] | undefined;
  if (req.type === 'delete') keys = req.keys;
  else keys = req.keys ?? req.values?.map((v) => (v as { id?: unknown } | null)?.id);
  if (!keys || keys.some((k) => typeof k !== 'string')) {
    state.whole.add(table);
    return;
  }
  let set = state.keys.get(table);
  if (!set) state.keys.set(table, (set = new Set()));
  for (const k of keys as string[]) set.add(k);
}

/** Install once per database instance (called from the JomarkhataDB constructor). */
export function trackChanges(db: Dexie) {
  const state = empty();
  trackers.set(db, state);
  db.use({
    stack: 'dbcore',
    name: 'jkChangeTracker',
    create(down) {
      return {
        ...down,
        table(name) {
          const table = down.table(name);
          return {
            ...table,
            mutate(req) {
              record(state, name, req);
              return table.mutate(req);
            },
          };
        },
      };
    },
  });
}

/**
 * Returns everything written since the last call and starts a fresh list. Call it BEFORE reading:
 * a write that happens during the read is then recorded for the next refresh. A write that is
 * already in progress commits before the read sees its table, because IndexedDB queues a read
 * transaction behind an earlier overlapping write transaction.
 */
export function takeChanges(db: Dexie): PendingChanges {
  const state = trackers.get(db);
  if (!state) return { keys: new Map(), whole: new Set(['*']) };
  const out: PendingChanges = { keys: state.keys, whole: state.whole };
  state.keys = new Map();
  state.whole = new Set();
  return out;
}
