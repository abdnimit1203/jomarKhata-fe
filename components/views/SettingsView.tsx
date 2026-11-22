'use client';

import React, { useState } from 'react';
import { Database, Download, RotateCcw, Save, Store } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { NumericInput } from '@/components/ui/NumericInput';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { downloadTextFile, formatBanglaNumber, parseNumericInput } from '@/lib/format';
import type { BusinessProfile } from '@/types/domain';

function SettingsProfileForm({ profile }: { profile: BusinessProfile }) {
  const { actions, showToast } = useJomarkhata();
  const [shopName, setShopName] = useState(profile.shopName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [businessType, setBusinessType] = useState(profile.businessType);
  const [openCash, setOpenCash] = useState(String(profile.openingBalances.cash));
  const [openBkash, setOpenBkash] = useState(String(profile.openingBalances.bkash));
  const [openNagad, setOpenNagad] = useState(String(profile.openingBalances.nagad));
  const [openBank, setOpenBank] = useState(String(profile.openingBalances.bank));
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(profile.defaultLowStockThreshold)
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await actions.updateBusinessProfile({
        shopName,
        ownerName,
        phone,
        address,
        businessType,
        openingBalances: {
          cash: parseNumericInput(openCash),
          bkash: parseNumericInput(openBkash),
          nagad: parseNumericInput(openNagad),
          bank: parseNumericInput(openBank),
        },
        defaultLowStockThreshold: parseNumericInput(lowStockThreshold),
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <section className="space-y-3.5 rounded-3xl bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-[#0F1F18]">দোকানের তথ্য</h2>

        <div>
          <label className="mb-1 block text-xs font-medium text-[#4A5F55]">দোকানের নাম *</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="h-12 w-full rounded-xl border border-[#DCE6E0] bg-[#F8FBF9] px-3.5 text-sm text-[#0F1F18] focus:border-[#0D7A56] focus:bg-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#4A5F55]">মালিকের নাম</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#DCE6E0] bg-[#F8FBF9] px-3.5 text-sm text-[#0F1F18] focus:border-[#0D7A56] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#4A5F55]">মোবাইল নম্বর</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#DCE6E0] bg-[#F8FBF9] px-3.5 text-sm text-[#0F1F18] focus:border-[#0D7A56] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#4A5F55]">ব্যবসার ধরন</label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="যেমন: মুদি ও জেনারেল স্টোর"
              className="h-12 w-full rounded-xl border border-[#DCE6E0] bg-[#F8FBF9] px-3.5 text-sm text-[#0F1F18] focus:border-[#0D7A56] focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[#4A5F55]">ঠিকানা</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-12 w-full rounded-xl border border-[#DCE6E0] bg-[#F8FBF9] px-3.5 text-sm text-[#0F1F18] focus:border-[#0D7A56] focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3.5 rounded-3xl bg-white p-5 shadow-card">
        <div>
          <h2 className="text-sm font-semibold text-[#0F1F18]">শুরুর ব্যালেন্স (Opening Balances)</h2>
          <p className="text-xs text-[#586B62]">
            বর্তমান নগদ, বিকাশ, নগদ (MFS) ও ব্যাংক ব্যালেন্স এই শুরুর ব্যালেন্স থেকে হিসাব হয়
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-[#4A5F55]">শুরুর নগদ ক্যাশ</label>
            <NumericInput value={openCash} onChange={(r) => setOpenCash(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#4A5F55]">শুরুর বিকাশ</label>
            <NumericInput value={openBkash} onChange={(r) => setOpenBkash(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#4A5F55]">শুরুর নগদ (MFS)</label>
            <NumericInput value={openNagad} onChange={(r) => setOpenNagad(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#4A5F55]">শুরুর ব্যাংক</label>
            <NumericInput value={openBank} onChange={(r) => setOpenBank(r)} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-[#4A5F55]">ডিফল্ট কম স্টক সতর্কতা সীমা</label>
          <NumericInput
            value={lowStockThreshold}
            onChange={(r) => setLowStockThreshold(r)}
            suffix="টি"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0D7A56] text-sm font-semibold text-white shadow-sm hover:bg-[#096244] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}</span>
        </button>
      </section>
    </form>
  );
}

export function SettingsView() {
  const { data, actions, showToast } = useJomarkhata();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (!data) return null;

  const handleExportJson = async () => {
    const json = await actions.exportBackupJson();
    downloadTextFile(
      `jomarkhata-backup-${new Date().toISOString().slice(0, 10)}.json`,
      json,
      'application/json'
    );
    showToast('সম্পূর্ণ ব্যাকআপ JSON ডাউনলোড হয়েছে।');
  };

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      await actions.resetDemoData();
      setConfirmResetOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-6">
      <section className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-card">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#0D7A56] text-white">
          <Store className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-[#0F1F18]">
            {data.businessProfile.shopName}
          </h1>
          <p className="truncate text-xs text-[#586B62]">
            {data.businessProfile.ownerName} · {data.businessProfile.phone}
          </p>
          <p className="mt-0.5 text-xs text-[#0D7A56]">{data.businessProfile.businessType}</p>
        </div>
      </section>

      <SettingsProfileForm
        key={data.businessProfile.updatedAt}
        profile={data.businessProfile}
      />

      <section className="space-y-3.5 rounded-3xl bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#E6F4EE] text-[#0D7A56]">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[#0F1F18]">
              লোকাল অফলাইন ডেটাবেস (IndexedDB · Dexie)
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#586B62]">
              বর্তমান ফ্রন্টএন্ড পর্যায়ে আপনার সব হিসাব নিরাপদভাবে এই ডিভাইসের ব্রাউজারে (IndexedDB) সংরক্ষিত হচ্ছে।
              ক্লাউড ব্যাকআপ ও লগইন পরবর্তী ব্যাকএন্ড পর্যায়ে যুক্ত হবে।
            </p>
            <p className="mt-1.5 text-xs font-medium text-[#354B41] tabular-nums">
              লোকাল সিঙ্ক কিউ: {formatBanglaNumber(data.pendingSyncCount)}টি রেকর্ড · মোট অডিট লগ:{' '}
              {formatBanglaNumber(data.auditLogs.length)}টি
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 pt-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#E6F4EE] text-xs font-semibold text-[#0D7A56] hover:bg-[#D5ECE1]"
          >
            <Download className="h-4 w-4" />
            <span>ব্যাকআপ ডাউনলোড (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmResetOpen(true)}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#FEF2F2] text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2]"
          >
            <RotateCcw className="h-4 w-4" />
            <span>ডেমো ডেটা রিসেট করুন</span>
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmResetOpen}
        title="ডেমো ডেটা রিসেট করবেন?"
        description="আপনার বর্তমান লোকাল হিসাব মুছে গিয়ে নতুন ডেমো দোকানের হিসাব পুনরায় লোড হবে। প্রয়োজনে আগে JSON ব্যাকআপ ডাউনলোড করে নিন।"
        confirmLabel="হ্যাঁ, রিসেট করুন"
        tone="danger"
        isSubmitting={isResetting}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={handleResetDemo}
      />
    </div>
  );
}
