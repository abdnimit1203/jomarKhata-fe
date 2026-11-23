/**
 * Access policy (S10, plan 7.9, owner decision D4): after a subscription expires there is a
 * 7-day grace period, then read-only. Read-only never hides data: viewing, searching and backup
 * export always work. Local mode (no account) has no subscription and is never restricted (D16).
 *
 * The real status comes from the backend later. This module only evaluates a cached,
 * server-verified status and guards against the device clock being turned back.
 */
export const GRACE_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export type AccessLevel = 'full' | 'grace' | 'read_only';

export interface CachedSubscription {
  /** As last verified by the server. */
  status: 'trial' | 'active' | 'expired';
  expiresAt: string;
  /** Server time at the moment of verification. */
  serverTime: string;
}

export interface AccessDecision {
  level: AccessLevel;
  canWrite: boolean;
  /** Days left in the grace period (only for `grace`). */
  graceDaysLeft?: number;
  reason: 'local_mode' | 'active' | 'grace' | 'expired';
}

/**
 * The clock we trust: never earlier than the last server time we saw. Turning the phone's clock
 * back can't move "now" before a moment the server has already confirmed.
 */
export function effectiveNow(deviceNow: number, sub: CachedSubscription | null): number {
  if (!sub) return deviceNow;
  return Math.max(deviceNow, Date.parse(sub.serverTime));
}

export function decideAccess(sub: CachedSubscription | null, deviceNow: number = Date.now()): AccessDecision {
  if (!sub) return { level: 'full', canWrite: true, reason: 'local_mode' };
  const now = effectiveNow(deviceNow, sub);
  const expires = Date.parse(sub.expiresAt);
  // Never show "active" past a known expiry, whatever the cached status says.
  if (now < expires && sub.status !== 'expired') return { level: 'full', canWrite: true, reason: 'active' };
  const graceEnd = expires + GRACE_DAYS * DAY;
  if (now < graceEnd) {
    return { level: 'grace', canWrite: true, reason: 'grace', graceDaysLeft: Math.ceil((graceEnd - now) / DAY) };
  }
  return { level: 'read_only', canWrite: false, reason: 'expired' };
}
