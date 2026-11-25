'use client';

/**
 * Cloud backup (owner, 2026-11-25): the whole khata, as the app's own checksummed backup file,
 * saved to the server (MongoDB) for the signed-in account. gzip-compressed when the phone supports
 * it. A snapshot, not record-by-record sync: restoring replaces this phone's khata (with the usual
 * preview + confirmation in RestoreFlow).
 *
 * Automatic: CloudBackupRunner uploads a fresh copy a little after the khata changes, when online.
 */
import { apiFetch } from './api';
import { currentIdToken } from './auth-firebase';
import { APP_VERSION } from './version';

export interface CloudMeta {
  exists: boolean;
  savedAt?: string;
  size?: number;
  shopName?: string;
  appVersion?: string;
}

const AUTO_KEY = 'jk_cloud_auto';
const LAST_KEY = 'jk_cloud_last';

async function token(): Promise<string> {
  const t = await currentIdToken();
  if (!t) throw new Error('ক্লাউড ব্যাকআপের জন্য লগইন করুন।');
  return t;
}

async function gzipBase64(text: string): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function gunzipBase64(b64: string): Promise<string> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export async function uploadCloudBackup(json: string, shopName: string): Promise<string> {
  const gz = await gzipBase64(json);
  const body = { encoding: gz ? 'gzip-base64' : 'plain', payload: gz ?? json, size: json.length, shopName, appVersion: APP_VERSION };
  const res = await apiFetch<{ savedAt: string }>('/me/backup', { token: await token(), method: 'PUT', body });
  try {
    window.localStorage.setItem(LAST_KEY, res.savedAt);
  } catch {
    /* ignore */
  }
  return res.savedAt;
}

export async function getCloudMeta(): Promise<CloudMeta> {
  return apiFetch<CloudMeta>('/me/backup/meta', { token: await token() });
}

/** The latest cloud copy as backup-file text (ready for inspectBackup / restoreBackup). */
export async function downloadCloudBackup(): Promise<string> {
  const r = await apiFetch<{ encoding: 'gzip-base64' | 'plain'; payload: string }>('/me/backup', { token: await token() });
  return r.encoding === 'gzip-base64' ? gunzipBase64(r.payload) : r.payload;
}

/** Per-phone switch (on by default). */
export function cloudAutoEnabled(): boolean {
  try {
    return window.localStorage.getItem(AUTO_KEY) !== '0';
  } catch {
    return true;
  }
}
export function setCloudAuto(on: boolean) {
  try {
    window.localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}
export function lastCloudBackupAt(): string | null {
  try {
    return window.localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}
