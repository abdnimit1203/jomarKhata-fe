/**
 * AP-8: put re-read rows back into an already-loaded table list, in exactly the order a full read
 * would return them:
 * - `orderBy(key).reverse()` → key descending, ties broken by id descending (IndexedDB 'prev'),
 *   and rows without the key are left out (they aren't in that index)
 * - plain `toArray()` → id ascending
 * IndexedDB compares strings by UTF-16 code units, the same as JS `<`.
 */
type Row = { id: string };

/**
 * @param rows   the current list (in full-read order)
 * @param ids    ids that were written since `rows` was loaded
 * @param fresh  `bulkGet(ids)` result, in the same order; `undefined` = deleted
 * @param key    sort field for date-ordered tables, or null for id order
 * @returns the new list, or null when a value isn't a string key (caller does a full read)
 */
export function mergeRows<T extends Row>(rows: T[], ids: string[], fresh: Array<T | undefined>, key: string | null): T[] | null {
  const changed = new Set(ids);
  const out = rows.filter((r) => !changed.has(r.id));
  const keyOf = (r: T) => (r as unknown as Record<string, unknown>)[key as string];

  const add: T[] = [];
  for (const r of fresh) {
    if (!r) continue;
    if (key) {
      const k = keyOf(r);
      if (k === undefined || k === null) continue;
      if (typeof k !== 'string') return null;
    }
    add.push(r);
  }
  if (add.length === 0) return out;

  const cmp = key
    ? (a: T, b: T) => {
        const ka = keyOf(a) as string;
        const kb = keyOf(b) as string;
        if (ka !== kb) return ka > kb ? -1 : 1;
        return a.id === b.id ? 0 : a.id > b.id ? -1 : 1;
      }
    : (a: T, b: T) => (a.id === b.id ? 0 : a.id < b.id ? -1 : 1);

  if (add.length > 64) return out.concat(add).sort(cmp);
  for (const r of add) {
    let lo = 0;
    let hi = out.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cmp(out[mid], r) <= 0) lo = mid + 1;
      else hi = mid;
    }
    out.splice(lo, 0, r);
  }
  return out;
}
