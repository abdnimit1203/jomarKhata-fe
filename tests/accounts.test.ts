/**
 * S10: account interfaces (no fake auth) and the access policy (7-day grace → read-only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GRACE_DAYS, decideAccess, effectiveNow } from '@/lib/access-policy';
import { AuthUnavailableError, formatAccountId, noBackendAuthProvider, normalizeBdMobile } from '@/lib/auth';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-11-23T10:00:00Z');
const sub = (expiresInDays: number, status: 'trial' | 'active' | 'expired' = 'active', serverTime = T0) => ({
  status,
  expiresAt: new Date(T0 + expiresInDays * DAY).toISOString(),
  serverTime: new Date(serverTime).toISOString(),
});

describe('access policy (D4)', () => {
  it('local mode (no subscription) is always full access', () => {
    expect(decideAccess(null, T0)).toMatchObject({ level: 'full', canWrite: true, reason: 'local_mode' });
  });

  it('active before expiry; grace for 7 days after; then read-only (view/export only)', () => {
    expect(decideAccess(sub(10), T0).level).toBe('full');
    const g = decideAccess(sub(-2), T0);
    expect(g).toMatchObject({ level: 'grace', canWrite: true, graceDaysLeft: GRACE_DAYS - 2 });
    expect(decideAccess(sub(-(GRACE_DAYS + 1)), T0)).toMatchObject({ level: 'read_only', canWrite: false });
  });

  it('never shows "active" past a known expiry, even if the cached status says active', () => {
    expect(decideAccess(sub(-1, 'active'), T0).level).toBe('grace');
  });

  it('turning the phone clock back cannot undo an expiry the server already saw', () => {
    const s = sub(-30, 'expired', T0); // server confirmed at T0, long expired
    const clockSetBack = T0 - 60 * DAY;
    expect(effectiveNow(clockSetBack, s)).toBe(T0);
    expect(decideAccess(s, clockSetBack).level).toBe('read_only');
  });

  it('read-only blocks every write action but never view/export (context guard)', () => {
    const ctx = read('context/JomarkhataContext.tsx');
    const re = new RegExp(/WRITE_ACTION = \/(.*)\//.exec(ctx)![1]);
    for (const w of ['createSale', 'editSale', 'voidSale', 'recordDueEntry', 'updateParty', 'adjustProductStock', 'restoreBackup', 'clearKhata']) expect(re.test(w), w).toBe(true);
    for (const r of ['exportBackupJson', 'inspectBackup', 'getSyncStatus', 'getLastBackupAt', 'enterDemo', 'exitDemo']) expect(re.test(r), r).toBe(false);
    expect(ctx).toMatch(/if \(!accessRef\.current\.canWrite && WRITE_ACTION\.test\(k\)\) throw new Error\(READ_ONLY_MESSAGE\)/);
  });

  it('the dev override exists only in development builds', () => {
    expect(read('context/JomarkhataContext.tsx')).toMatch(/process\.env\.NODE_ENV === 'development'[\s\S]{0,80}jk_dev_access/);
  });
});

describe('no fake authentication (plan §7.2)', () => {
  it('without Firebase/API settings every sign-in is refused with an honest message', async () => {
    expect(noBackendAuthProvider.available).toBe(false);
    await expect(noBackendAuthProvider.signInWithGoogle()).rejects.toBeInstanceOf(AuthUnavailableError);
    await expect(noBackendAuthProvider.signInWithEmail('a@b.c', 'secret1')).rejects.toThrow('এখনও চালু হয়নি');
    await expect(noBackendAuthProvider.signUpWithEmail('a@b.c', 'secret1')).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it('"authenticated" comes only from a backend session (authFromSession); the app starts as guest', () => {
    const ctx = read('context/JomarkhataContext.tsx');
    expect(ctx).toContain('useState<AuthState>(LOCAL_AUTH)');
    expect(read('lib/auth-firebase.ts')).toContain("apiFetch<SessionResponse>('/auth/session'");
    const sources = ['context/JomarkhataContext.tsx', 'components/onboarding/AuthScreen.tsx', 'components/onboarding/WelcomeScreen.tsx', 'lib/auth-firebase.ts'].map(read).join('\n');
    expect(sources).not.toMatch(/status: 'authenticated'/);
  });

  it('OTP / logout-guard / claim designs live only on the development /preview page under a banner', () => {
    expect(read('app/preview/page.tsx')).toMatch(/NODE_ENV === 'production'\) notFound\(\)/);
    expect(read('components/preview/AccountDesigns.tsx')).toMatch(/প্রিভিউ — আসল যাচাই নয়/);
    expect(read('components/onboarding/AuthScreen.tsx')).not.toMatch(/কোড লিখুন/); // no OTP entry in the real app
  });
});

describe('phone and account ID formats', () => {
  it('normalises Bangladeshi mobiles (Bengali digits, +88, spaces) and rejects others', () => {
    expect(normalizeBdMobile('০১৭১২-৩৪৫৬৭৮')).toBe('01712345678');
    expect(normalizeBdMobile('+8801912345678')).toBe('01912345678');
    expect(normalizeBdMobile('01212345678')).toBeNull();
    expect(normalizeBdMobile('12345')).toBeNull();
  });
  it('account IDs display as JK-1234-5678 (D29)', () => {
    expect(formatAccountId('48271935')).toBe('JK-4827-1935');
  });
});

describe('backend hand-off contract exists and covers the essentials', () => {
  it('auth, tenancy, idempotent sync, claim, logout guard, subscription', () => {
    const doc = read('docs/BACKEND_CONTRACT.md');
    for (const s of ['POST /sync/push', 'A repeated `opId` is a no-op', 'never trusts a `tenantId`', 'never merge automatically', 'Logout is blocked', 'GET /subscription', 'jomarkhata_<tenantId>']) {
      expect(doc, s).toContain(s);
    }
  });
});
