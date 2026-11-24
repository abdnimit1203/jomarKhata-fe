/**
 * Referral UI (UI-NOW / BE-LATER): user ID + own referral code with copy buttons, optional code at
 * sign-up, 20% commission shown from the server. Nothing is invented before a real login exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AccountSection } from '@/components/settings/AccountSection';
import { LOCAL_AUTH, type AuthState } from '@/lib/auth';
import { normalizeReferralCode, REFERRAL_COMMISSION_RATE, referralFromSearch, referralLink, referralShareText } from '@/lib/referral';

const read = (p: string) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');

describe('referral code format', () => {
  it('normalises case, spaces, dashes and Bengali digits; rejects junk', () => {
    expect(normalizeReferralCode(' jk7q-4m2x ')).toBe('JK7Q4M2X');
    expect(normalizeReferralCode('jk১২৩৪')).toBe('JK1234');
    expect(normalizeReferralCode('ab')).toBeNull();
    expect(normalizeReferralCode('JK7Q4M2X!')).toBeNull();
    expect(normalizeReferralCode('')).toBeNull();
  });
  it('a shared link pre-fills the sign-up field', () => {
    expect(referralFromSearch('?ref=jk7q4m2x')).toBe('JK7Q4M2X');
    expect(referralFromSearch('?x=1')).toBeNull();
    expect(referralLink('JK7Q4M2X', 'https://jomarkhata.app/')).toBe('https://jomarkhata.app/app?ref=JK7Q4M2X');
    expect(referralShareText('JK7Q4M2X', 'https://jomarkhata.app')).toContain('JK7Q4M2X');
  });
  it('default commission is 20%', () => {
    expect(REFERRAL_COMMISSION_RATE).toBe(0.2);
  });
});

describe('profile: account & referral section', () => {
  it('before login exists: explains, shows no ID or code (no fake values)', () => {
    const html = renderToStaticMarkup(React.createElement(AccountSection, { auth: LOCAL_AUTH }));
    expect(html).toContain('অ্যাকাউন্ট ও রেফারেল');
    expect(html).toContain('ফ্রি মাস');
    expect(html).toContain('কোনো আইডি বা কোড এখনও নেই');
    expect(html).not.toContain('<button'); // nothing to copy yet
  });

  it('with a real (server) account: ID and code each with a copy button, stats, WhatsApp share', () => {
    const auth: AuthState = {
      status: 'authenticated',
      user: {
        accountId: 'JK-4827-1935', email: 'a@b.c', displayName: 'X', referralCode: 'JK7Q4M2X',
        referralStats: { referredUsers: 3, referrerType: 'promoter', commissionEarned: 360, commissionRate: 0.25 },
      },
    };
    const html = renderToStaticMarkup(React.createElement(AccountSection, { auth }));
    expect(html).toContain('JK-4827-1935');
    expect(html).toContain('JK7Q4M2X');
    expect(html).toContain('aria-label="ইউজার আইডি কপি করুন"');
    expect(html).toContain('aria-label="আমার রেফারেল কোড কপি করুন"');
    expect(html).toContain('২৫%'); // the server's rate wins
    expect(html).toContain('৩ জন');
    expect(html).toMatch(/href="https:\/\/wa\.me\/\?text=/);
  });

  it('a regular user earns free time, not cash', () => {
    const auth: AuthState = {
      status: 'authenticated',
      user: { accountId: 'JK-1', email: 'a@b.c', displayName: 'X', referralCode: 'JK7Q4M2X', referralStats: { referredUsers: 2, commissionEarned: 0, freeDaysEarned: 60 } },
    };
    const html = renderToStaticMarkup(React.createElement(AccountSection, { auth }));
    expect(html).toContain('৬০ দিন');
    expect(html).not.toContain('মোট কমিশন');
  });

  it('is on the profile (settings) screen', () => {
    expect(read('components/views/SettingsView.tsx')).toMatch(/<AccountSection auth=\{auth\} \/>/);
  });
});

describe('sign-up: optional referral code', () => {
  const src = read('components/onboarding/AuthScreen.tsx');
  it('has an optional field and sends the code with both sign-in methods', () => {
    expect(src).toMatch(/রেফারেল কোড <span[^>]*>\(ঐচ্ছিক\)/);
    expect(src).toMatch(/provider\.signInWithGoogle\(opt\)/);
    expect(src).toContain('referralFromSearch(window.location?.search');
  });
  it('an empty field never blocks sign-up', () => {
    expect(src).toMatch(/if \(!referral\.trim\(\)\) return \{\};/);
  });
});
