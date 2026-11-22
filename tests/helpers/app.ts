/**
 * Test harness: boots the real app data layer (Dexie DB + jomarkhataService + calculator)
 * against an isolated in-memory IndexedDB (fake-indexeddb).
 *
 * - `bootApp()` with a NEW factory  = a brand-new device / fresh install.
 * - `bootApp(sameFactory)`          = the same device after an app restart / page reload / PWA relaunch
 *                                     (module singletons are reset, the IndexedDB contents are kept).
 */
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { vi } from 'vitest';
import type { BusinessProfile } from '@/types/domain';

export async function bootApp(factory: IDBFactory = new IDBFactory()) {
  Dexie.dependencies.indexedDB = factory;
  Dexie.dependencies.IDBKeyRange = IDBKeyRange;
  vi.resetModules();

  const dbModule = await import('@/db/jomarkhataDb');
  const { jomarkhataService } = await import('@/services/jomarkhataService');
  const calc = await import('@/services/financeCalculator');

  const db = dbModule.getJomarkhataDb();
  return { factory, db, dbModule, service: jomarkhataService, calc };
}

export type App = Awaited<ReturnType<typeof bootApp>>;

export function makeProfile(overrides: Partial<BusinessProfile> = {}): BusinessProfile {
  const now = new Date().toISOString();
  return {
    id: 'default',
    shopName: 'টেস্ট স্টোর',
    ownerName: 'টেস্ট মালিক',
    phone: '01700000000',
    address: '',
    businessType: 'সাধারণ খুচরা',
    openingBalances: { cash: 1000, bkash: 500, nagad: 0, bank: 0 },
    defaultLowStockThreshold: 5,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** An existing shop with a profile but no transactions (no demo seed). */
export async function bootEmptyShop(factory?: IDBFactory) {
  const app = await bootApp(factory);
  await app.db.businessProfile.put(makeProfile());
  return app;
}

/** Dumps every table, including the sync outbox, sorted by id for stable comparison. */
export async function dumpAllTables(app: App) {
  const out: Record<string, unknown[]> = {};
  for (const table of app.db.tables) {
    const rows = (await table.toArray()) as Array<{ id: string }>;
    out[table.name] = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return out;
}

/** Closes the DB connection, like the browser does when the tab/app is closed. */
export function closeApp(app: App) {
  app.db.close();
}
