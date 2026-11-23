'use client';

import React, { useState } from 'react';
import { ArrowLeft, Store } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { NumericInput } from '@/components/ui/NumericInput';
import { Button } from '@/components/ui/Button';
import { SimpleSelect } from '@/components/ui/select';
import { parseNumericInput } from '@/lib/format';
import { isValidBdMobile } from '@/services/jomarkhataService';

const BUSINESS_TYPES = ['মুদি দোকান', 'সাধারণ খুচরা', 'পাইকারি', 'অন্যান্য'];

const inputClass =
  'h-12 w-full rounded-2xl border border-border-strong bg-white px-4 text-base text-ink placeholder:text-ink-subtle focus:border-primary-ink focus:outline-none';

/**
 * S3 shop setup: starts an EMPTY real khata (D3). Only the shop name is required now;
 * owner name / mobile help later (account linking, মনে করানো). Opening balances are optional.
 */
export function ShopSetupScreen({ onBack }: { onBack: () => void }) {
  const { actions } = useJomarkhata();
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [cash, setCash] = useState('');
  const [bkash, setBkash] = useState('');
  const [nagad, setNagad] = useState('');
  const [bank, setBank] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!shopName.trim()) return setError('দোকানের নাম লিখুন।');
    if (!isValidBdMobile(phone)) return setError('সঠিক মোবাইল নম্বর লিখুন (যেমন 01712345678)।');
    setSaving(true);
    try {
      await actions.createShop({
        shopName,
        ownerName,
        phone,
        businessType,
        openingBalances: {
          cash: parseNumericInput(cash),
          bkash: parseNumericInput(bkash),
          nagad: parseNumericInput(nagad),
          bank: parseNumericInput(bank),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'খাতা শুরু করা যায়নি।');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <button
          type="button"
          onClick={onBack}
          aria-label="পিছনে যান"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-card"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="mt-5 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-gradient text-on-primary">
            <Store className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-ink">দোকানের তথ্য দিন</h1>
            <p className="text-sm text-ink-muted">পরে সেটিংস থেকে বদলানো যাবে।</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5" noValidate>
          <section className="space-y-4 rounded-3xl bg-white p-5 shadow-card">
            <div>
              <label htmlFor="setup-shop" className="mb-1.5 block text-sm font-semibold text-ink">
                দোকানের নাম *
              </label>
              <input
                id="setup-shop"
                className={inputClass}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder="যেমন: মায়ের দোয়া স্টোর"
                autoComplete="organization"
              />
            </div>
            <div>
              <label htmlFor="setup-owner" className="mb-1.5 block text-sm font-semibold text-ink">
                মালিকের নাম
              </label>
              <input
                id="setup-owner"
                className={inputClass}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label htmlFor="setup-phone" className="mb-1.5 block text-sm font-semibold text-ink">
                মোবাইল নম্বর
              </label>
              <input
                id="setup-phone"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="01XXXXXXXXX"
                autoComplete="tel"
              />
            </div>
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-ink">ব্যবসার ধরন</span>
              <SimpleSelect
                aria-label="ব্যবসার ধরন"
                value={businessType}
                onValueChange={setBusinessType}
                options={BUSINESS_TYPES.map((t) => ({ value: t, label: t }))}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-3xl bg-white p-5 shadow-card">
            <div>
              <h2 className="text-base font-bold text-ink">এখন হাতে কত টাকা আছে?</h2>
              <p className="text-sm text-ink-muted">না জানলে খালি রাখুন, পরে দেওয়া যাবে।</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  ['ক্যাশ', cash, setCash],
                  ['বিকাশ', bkash, setBkash],
                  ['নগদ', nagad, setNagad],
                  ['ব্যাংক', bank, setBank],
                ] as const
              ).map(([label, value, set]) => (
                <div key={label}>
                  <span className="mb-1 block text-sm font-semibold text-ink-muted">{label}</span>
                  <NumericInput value={value} onChange={(raw) => set(raw)} />
                </div>
              ))}
            </div>
          </section>

          {error && (
            <p role="alert" className="rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}

          <Button type="submit" size="xl" fullWidth disabled={saving}>
            {saving ? 'শুরু হচ্ছে…' : 'খাতা শুরু করুন'}
          </Button>
          <p className="text-center text-xs text-ink-muted">
            আপনার হিসাব এই ফোনেই সংরক্ষিত থাকবে। খালি খাতা দিয়ে শুরু হবে।
          </p>
        </form>
      </div>
    </div>
  );
}
