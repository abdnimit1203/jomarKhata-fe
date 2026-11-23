/**
 * S8 UI rules: backup reminder, friendly storage errors, guarded clear, restore entry points.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKUP_REMINDER_DAYS, needsBackupReminder } from '@/lib/backup-reminder';
import { toFriendlyError } from '@/lib/errors';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const day = 24 * 60 * 60 * 1000;

describe('backup reminder', () => {
  const now = new Date('2026-11-23T10:00:00Z');
  it('no records → no reminder; records and never backed up → reminder', () => {
    expect(needsBackupReminder(null, 0, now)).toBe(false);
    expect(needsBackupReminder(null, 3, now)).toBe(true);
  });
  it(`reminds after ${BACKUP_REMINDER_DAYS} days, not before`, () => {
    expect(needsBackupReminder(new Date(now.getTime() - 2 * day).toISOString(), 5, now)).toBe(false);
    expect(needsBackupReminder(new Date(now.getTime() - 8 * day).toISOString(), 5, now)).toBe(true);
  });
});

describe('friendly storage errors (forms stay open with a plain message)', () => {
  it('quota exceeded → Bangla message that keeps the typed input', () => {
    const e = Object.assign(new Error('x'), { name: 'QuotaExceededError' });
    expect(toFriendlyError(e).message).toMatch(/জায়গা ভরে গেছে[\s\S]*ফর্মে রাখা আছে/);
    expect(toFriendlyError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } }).message).toMatch(/জায়গা ভরে গেছে/);
  });
  it('database cannot open (private mode etc.) → Bangla guidance; other errors pass through', () => {
    expect(toFriendlyError(Object.assign(new Error('x'), { name: 'OpenFailedError' })).message).toMatch(/ডেটাবেস খোলা যাচ্ছে না/);
    expect(toFriendlyError(new Error('দোকানের নাম লিখুন।')).message).toBe('দোকানের নাম লিখুন।');
  });
  it('every context action is wrapped with toFriendlyError', () => {
    expect(read('context/JomarkhataContext.tsx')).toMatch(/throw toFriendlyError\(err\)/);
    expect(read('context/JomarkhataContext.tsx')).toMatch(/actions: safeActions/);
  });
});

describe('wiring (static)', () => {
  it('settings: backup with optional password, restore, safety copy, typed-confirm clear', () => {
    const b = read('components/settings/BackupSection.tsx');
    expect(b).toMatch(/পাসওয়ার্ড দিয়ে সুরক্ষিত করুন/);
    expect(b).toMatch(/<RestoreFlow currentShopName=/);
    expect(b).toMatch(/নিরাপত্তা-কপি/);
    expect(b).toMatch(/typed\.trim\(\) !== 'খালি'/);
    expect(b).toMatch(/আগে ব্যাকআপ ডাউনলোড করুন/);
  });
  it('restore shows a preview and needs an extra confirmation for a different shop', () => {
    const r = read('components/settings/RestoreFlow.tsx');
    expect(r).toMatch(/inspectBackup/);
    expect(r).toMatch(/differentShop && !otherShopOk/);
  });
  it('welcome screen offers restore from a backup file (new phone / reinstall)', () => {
    expect(read('components/onboarding/WelcomeScreen.tsx')).toMatch(/<RestoreFlow \/>/);
  });
  it('the app asks the browser for persistent storage at startup', () => {
    expect(read('context/JomarkhataContext.tsx')).toMatch(/st\.persist\(\)/);
  });
});
