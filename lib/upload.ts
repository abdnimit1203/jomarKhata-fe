'use client';

/**
 * The ONE place images are uploaded (owner rule: everything nests under one project root folder,
 * enforced here, not at each call site). Same flow as the owner's other shop app:
 *   1. compress in the browser (never send a big photo),
 *   2. ask our server for short-lived signed params (the private key stays on the server),
 *   3. upload straight to ImageKit into ROOT_FOLDER + folder, get back { url, fileId }.
 * Callers then save the URL through their own API call (the server deletes the replaced file).
 * Needs internet; callers disable their button offline.
 */
import imageCompression from 'browser-image-compression';
import { apiFetch } from './api';
import { currentIdToken } from './auth-firebase';

const PUBLIC_KEY = process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY ?? '';
export const ROOT_FOLDER = '/jomarkhata';
export const uploadsConfigured = Boolean(PUBLIC_KEY);

export interface Uploaded {
  url: string;
  fileId: string;
}

async function compress(file: File, maxSizeMB: number, maxWidthOrHeight: number): Promise<File> {
  if (!file.type.startsWith('image/')) throw new Error('শুধু ছবি দেওয়া যাবে।');
  if (file.size <= maxSizeMB * 1024 * 1024 && file.type !== 'image/heic') return file;
  try {
    return await imageCompression(file, { maxSizeMB, maxWidthOrHeight, useWebWorker: true, fileType: 'image/jpeg' });
  } catch {
    return file; // ImageKit still enforces its own limits
  }
}

async function uploadToImageKit(file: File, folder: '/avatars' | '/payment-qr', purpose: 'avatar' | 'qr'): Promise<Uploaded> {
  if (!uploadsConfigured) throw new Error('ছবি আপলোড এখন চালু নেই।');
  const token = await currentIdToken();
  if (!token) throw new Error('আবার লগইন করুন।');
  const auth = await apiFetch<{ token: string; expire: number; signature: string; publicKey: string }>(
    `/uploads/imagekit-auth?purpose=${purpose}`,
    { token },
  );
  const form = new FormData();
  form.append('file', file);
  form.append('fileName', file.name || `${purpose}.jpg`);
  form.append('publicKey', auth.publicKey || PUBLIC_KEY);
  form.append('signature', auth.signature);
  form.append('expire', String(auth.expire));
  form.append('token', auth.token);
  form.append('folder', `${ROOT_FOLDER}${folder}`);
  form.append('useUniqueFileName', 'true');
  let res: Response;
  try {
    res = await fetch('https://upload.imagekit.io/api/v1/files/upload', { method: 'POST', body: form });
  } catch {
    throw new Error('ইন্টারনেট সংযোগ নেই। নেট চালু করে আবার চেষ্টা করুন।');
  }
  const data = (await res.json().catch(() => ({}))) as { url?: string; fileId?: string; message?: string };
  if (!res.ok || !data.url || !data.fileId) throw new Error(data.message ?? 'ছবি আপলোড হয়নি।');
  return { url: data.url, fileId: data.fileId };
}

/** Profile photo: 512 px, ~100 KB. */
export async function uploadAvatar(file: File): Promise<Uploaded> {
  return uploadToImageKit(await compress(file, 0.1, 512), '/avatars', 'avatar');
}

/** Payment QR: sharper (a blurred QR won't scan) — 800 px, ~300 KB. Super admin only. */
export async function uploadPaymentQr(file: File): Promise<Uploaded> {
  return uploadToImageKit(await compress(file, 0.3, 800), '/payment-qr', 'qr');
}
