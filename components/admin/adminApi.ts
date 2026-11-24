'use client';

/** Admin calls: always with the signed-in Firebase token; the server checks super_admin. */
import { apiFetch } from '@/lib/api';
import { currentIdToken } from '@/lib/auth-firebase';

export async function adminFetch<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await currentIdToken();
  if (!token) throw Object.assign(new Error('লগইন করুন।'), { status: 401 });
  return apiFetch<T>(path, { ...opts, token });
}

/** 'ok' = super admin; 'login' = not signed in; 'forbidden' = signed in but not super admin. */
export async function checkAdmin(): Promise<'ok' | 'login' | 'forbidden'> {
  try {
    await adminFetch('/admin/me');
    return 'ok';
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 404) return 'login';
    if (status === 403) return 'forbidden';
    throw err;
  }
}
