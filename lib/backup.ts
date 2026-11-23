/**
 * Backup file format v2 (S8, AP-11) and restore validation (AP-10). No database access here:
 * the service reads/writes Dexie; this module builds, encrypts, decrypts and validates files.
 *
 * File (plain):     { format, formatVersion: 2, app, appVersion, dbVersion, shopName, exportedAt,
 *                     counts, checksum: sha256(JSON.stringify(data)), data }
 * File (password):  { format, formatVersion: 2, encrypted: true, kdf: PBKDF2-SHA256, iterations,
 *                     salt, iv, ciphertext }  (AES-GCM 256; the plain file is the encrypted payload)
 * v1 (old builds):  { app, schemaVersion: 1, exportedAt, data: snapshot } — still restorable.
 */

export const BACKUP_FORMAT = 'jomarkhata-backup';
export const BACKUP_FORMAT_VERSION = 2;
export const APP_VERSION = '0.1.0';
const PBKDF2_ITERATIONS = 210_000;

/** Tables that make up a khata, in a fixed order (appMeta is device metadata, never backed up). */
export const BACKUP_TABLES = [
  'parties',
  'products',
  'sales',
  'purchases',
  'moneyMovements',
  'dueTransactions',
  'expenses',
  'stockMovements',
  'auditLogs',
  'syncQueue',
] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];

export interface BackupData {
  businessProfile: Record<string, unknown>;
  [table: string]: unknown;
}

export interface BackupFileV2 {
  format: typeof BACKUP_FORMAT;
  formatVersion: 2;
  app: string;
  appVersion: string;
  dbVersion: number;
  shopName: string;
  exportedAt: string;
  counts: Record<string, number>;
  checksum: string;
  data: BackupData;
}

export interface BackupPreview {
  formatVersion: 1 | 2;
  shopName: string;
  exportedAt: string | null;
  counts: Record<string, number>;
  encrypted: boolean;
  checksumVerified: boolean;
  /** v1 files have no sync outbox; restoring them leaves the outbox empty. */
  notes: string[];
}

export class BackupError extends Error {}

// ---------------------------------------------------------------- hashing / crypto (WebCrypto)
const enc = new TextEncoder();
const dec = new TextDecoder();
const toB64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ---------------------------------------------------------------- build
/** Rows sorted by id so the same khata always produces the same checksum. */
export function canonicalData(data: BackupData): BackupData {
  const out: BackupData = { businessProfile: data.businessProfile };
  for (const t of BACKUP_TABLES) {
    const rows = (data[t] as Array<{ id: string }> | undefined) ?? [];
    out[t] = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }
  return out;
}

export async function buildBackupFile(raw: BackupData, dbVersion: number, password?: string): Promise<string> {
  const data = canonicalData(raw);
  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, (data[t] as unknown[]).length]));
  const file: BackupFileV2 = {
    format: BACKUP_FORMAT,
    formatVersion: 2,
    app: 'Jomarkhata (জমারখাতা)',
    appVersion: APP_VERSION,
    dbVersion,
    shopName: String(data.businessProfile.shopName ?? ''),
    exportedAt: new Date().toISOString(),
    counts,
    checksum: await sha256Hex(JSON.stringify(data)),
    data,
  };
  const plain = JSON.stringify(file);
  if (!password) return plain;

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(plain));
  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: 2,
    encrypted: true,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
  });
}

// ---------------------------------------------------------------- read + validate
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown) => typeof v === 'string' && v.length > 0;
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

/** Required fields per table: enough to reject a wrong or damaged file, loose enough for every version. */
const SHAPES: Record<BackupTable, (r: Record<string, unknown>) => boolean> = {
  parties: (r) => str(r.name) && (r.role === 'customer' || r.role === 'supplier') && num(r.balance),
  products: (r) => str(r.name) && num(r.stockQty),
  sales: (r) => num(r.total) && Array.isArray(r.items) && str(r.status),
  purchases: (r) => num(r.total) && Array.isArray(r.items) && str(r.status),
  moneyMovements: (r) => (r.direction === 'in' || r.direction === 'out') && num(r.amount) && str(r.channel),
  dueTransactions: (r) => str(r.partyId) && (r.direction === 'given' || r.direction === 'received') && num(r.amount),
  expenses: (r) => num(r.amount) && str(r.status),
  stockMovements: (r) => str(r.productId) && num(r.deltaQty),
  auditLogs: (r) => str(r.entityType) && str(r.action),
  syncQueue: (r) => str(r.entityType) && str(r.operation),
};

export async function parseBackup(text: string, password?: string): Promise<{ data: BackupData; preview: BackupPreview }> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError('ফাইলটি পড়া যায়নি — এটি জমারখাতার ব্যাকআপ ফাইল নয় বা নষ্ট হয়ে গেছে।');
  }
  if (!isObj(json)) throw new BackupError('ফাইলটি জমারখাতার ব্যাকআপ নয়।');

  let encrypted = false;
  if (json.encrypted === true) {
    encrypted = true;
    if (!password) throw new BackupError('এই ব্যাকআপে পাসওয়ার্ড দেওয়া আছে। পাসওয়ার্ড লিখুন।');
    try {
      const key = await deriveKey(password, fromB64(String(json.salt)), Number(json.iterations));
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: fromB64(String(json.iv)) as BufferSource },
        key,
        fromB64(String(json.ciphertext)) as BufferSource
      );
      json = JSON.parse(dec.decode(plain));
    } catch {
      throw new BackupError('পাসওয়ার্ড ভুল, অথবা ফাইলটি নষ্ট।');
    }
    if (!isObj(json)) throw new BackupError('ফাইলটি জমারখাতার ব্যাকআপ নয়।');
  }

  const notes: string[] = [];
  let formatVersion: 1 | 2;
  let checksumVerified = false;
  if (json.format === BACKUP_FORMAT && json.formatVersion === 2) {
    formatVersion = 2;
    if (!isObj(json.data)) throw new BackupError('ব্যাকআপে কোনো ডেটা নেই।');
    const actual = await sha256Hex(JSON.stringify(json.data));
    if (actual !== json.checksum) throw new BackupError('ফাইলটি বদলে গেছে বা নষ্ট (checksum মেলেনি)। এই ফাইল দিয়ে ফিরিয়ে আনা নিরাপদ নয়।');
    checksumVerified = true;
  } else if (json.schemaVersion === 1 && isObj(json.data) && String(json.app ?? '').includes('Jomarkhata')) {
    formatVersion = 1;
    notes.push('পুরোনো (v1) ব্যাকআপ: এতে checksum ও সিঙ্ক তালিকা নেই।');
  } else {
    throw new BackupError('ফাইলটি জমারখাতার ব্যাকআপ নয়, অথবা নতুন কোনো ভার্সনের।');
  }

  const src = json.data as Record<string, unknown>;
  if (!isObj(src.businessProfile) || !str(src.businessProfile.shopName)) throw new BackupError('ব্যাকআপে দোকানের তথ্য নেই।');
  const data: BackupData = { businessProfile: src.businessProfile };
  for (const t of BACKUP_TABLES) {
    const rows = src[t] ?? [];
    if (!Array.isArray(rows)) throw new BackupError(`ব্যাকআপের "${t}" অংশটি ঠিক নেই।`);
    rows.forEach((r, i) => {
      if (!isObj(r) || !str(r.id) || !SHAPES[t](r)) throw new BackupError(`ব্যাকআপের "${t}" অংশে ${i + 1} নম্বর রেকর্ড ঠিক নেই।`);
    });
    data[t] = rows;
  }
  checkIntegrity(data);

  const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, (data[t] as unknown[]).length]));
  return {
    data,
    preview: {
      formatVersion,
      shopName: String(data.businessProfile.shopName),
      exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : null,
      counts,
      encrypted,
      checksumVerified,
      notes,
    },
  };
}

/** Referential integrity: every link must point at a record that is in the same backup. */
export function checkIntegrity(data: BackupData) {
  const ids = (t: BackupTable) => new Set((data[t] as Array<{ id: string }>).map((r) => r.id));
  const parties = ids('parties');
  const products = ids('products');
  const bySource: Record<string, Set<string>> = {
    sale_payment: ids('sales'),
    purchase_payment: ids('purchases'),
    expense: ids('expenses'),
    customer_collection: ids('dueTransactions'),
    supplier_payment: ids('dueTransactions'),
  };
  const fail = (what: string) => {
    throw new BackupError(`ব্যাকআপের ভেতরের সম্পর্ক মেলেনি (${what})। ফাইলটি অসম্পূর্ণ বা নষ্ট।`);
  };
  for (const t of ['sales', 'purchases'] as const) {
    for (const r of data[t] as Array<{ partyId?: string | null }>) if (r.partyId && !parties.has(r.partyId)) fail(`${t} → পার্টি`);
  }
  for (const r of data.dueTransactions as Array<{ partyId: string }>) if (!parties.has(r.partyId)) fail('বাকি → পার্টি');
  for (const r of data.moneyMovements as Array<{ sourceType: string; sourceId?: string | null }>) {
    const set = bySource[r.sourceType];
    if (set && r.sourceId && !set.has(r.sourceId)) fail('টাকার হিসাব → লেনদেন');
  }
  for (const r of data.stockMovements as Array<{ productId: string }>) if (!products.has(r.productId)) fail('স্টক → পণ্য');
}
