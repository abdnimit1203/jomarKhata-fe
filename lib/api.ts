/**
 * Calls to the Jomarkhata backend (jomarKhata-be). Base URL: NEXT_PUBLIC_API_URL.
 * Errors carry the server's Bangla message when it sends one.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, opts: { token?: string; method?: string; body?: unknown } = {}): Promise<T> {
  if (!API_URL) throw new ApiError(0, 'no_api', 'সার্ভারের ঠিকানা সেট করা নেই।');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? (opts.body ? 'POST' : 'GET'),
      headers: {
        ...(opts.body ? { 'content-type': 'application/json' } : {}),
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', 'ইন্টারনেট সংযোগ নেই। নেট চালু করে আবার চেষ্টা করুন।');
  }
  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'error', data.message ?? 'সার্ভারে সমস্যা হয়েছে।');
  return data as T;
}
