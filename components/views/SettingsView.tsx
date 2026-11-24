'use client';

import React, { useState } from 'react';
import { Database, FlaskConical, Hand, LogOut, RotateCcw, Save, Store } from 'lucide-react';
import { replayGuide } from '@/components/onboarding/FirstRunGuide';
import { appVersionLabel } from '@/lib/version';
import { GREETINGS, setGreetingKey, useGreetingKey, type GreetingKey } from '@/lib/greeting';
import { SegmentedControl } from '@/components/ui/segmented';
import { BackupSection } from '@/components/settings/BackupSection';
import { AccountSection } from '@/components/settings/AccountSection';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { InstallCard } from '@/components/pwa/PwaPrompts';
import { supportLink } from '@/lib/support';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { NumericInput } from '@/components/ui/NumericInput';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatBanglaNumber, parseNumericInput } from '@/lib/format';
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
        <h2 className="text-sm font-semibold text-ink">দোকানের তথ্য</h2>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">দোকানের নাম *</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">মালিকের নাম</label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">মোবাইল নম্বর</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">ব্যবসার ধরন</label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="যেমন: মুদি ও জেনারেল স্টোর"
              className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">ঠিকানা</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3.5 rounded-3xl bg-tile-sky-bg p-5 shadow-card">
        <div>
          <h2 className="text-sm font-semibold text-ink">শুরুতে কত টাকা ছিল</h2>
          <p className="text-xs text-ink-muted">
            বর্তমান ক্যাশ, বিকাশ, নগদ ও ব্যাংক ব্যালেন্স এই শুরুর ব্যালেন্স থেকে হিসাব হয়
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">শুরুর ক্যাশ</label>
            <NumericInput value={openCash} onChange={(r) => setOpenCash(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">শুরুর বিকাশ</label>
            <NumericInput value={openBkash} onChange={(r) => setOpenBkash(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">শুরুর নগদ</label>
            <NumericInput value={openNagad} onChange={(r) => setOpenNagad(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">শুরুর ব্যাংক</label>
            <NumericInput value={openBank} onChange={(r) => setOpenBank(r)} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">ডিফল্ট কম স্টক সতর্কতা সীমা</label>
          <NumericInput
            value={lowStockThreshold}
            onChange={(r) => setLowStockThreshold(r)}
            suffix="টি"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-gradient text-sm font-semibold text-on-primary shadow-sm hover:brightness-[0.97] disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          <span>{isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ করুন'}</span>
        </button>
      </section>
    </form>
  );
}

export function SettingsView() {
  const { data, actions, showToast, mode, auth, navigate, completeSignIn, signOut } = useJomarkhata();
  const [showAuth, setShowAuth] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // the guide points at the home screen and bottom bar
  const goHome = () => navigate('dashboard');
  const greetingKey = useGreetingKey();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (!data) return null;

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
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-gradient text-on-primary">
          <Store className="h-7 w-7" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">
            {data.businessProfile.shopName}
          </h1>
          <p className="truncate text-xs text-ink-muted">
            {data.businessProfile.ownerName} · {data.businessProfile.phone}
          </p>
          <p className="mt-0.5 text-xs text-primary-ink">{data.businessProfile.businessType}</p>
        </div>
      </section>






      <SettingsProfileForm
        key={data.businessProfile.updatedAt}
        profile={data.businessProfile}
      />

      {/* greeting on the home screen and in messages (shopkeepers of every faith) */}
      <section className="space-y-2.5 rounded-3xl bg-tile-purple-bg p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink">হোমে সম্ভাষণ</h2>
        <SegmentedControl
          aria-label="সম্ভাষণ"
          variant="chips"
          value={greetingKey}
          onValueChange={(v) => setGreetingKey(v as GreetingKey)}
          options={GREETINGS.map((g) => ({ value: g.key, label: g.text || 'কিছু না' }))}
        />
      </section>

      <BackupSection />

      <AccountSection auth={auth} onLogin={() => setShowAuth(true)} />
      {showAuth && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-canvas">
          <AuthScreen
            onBack={() => setShowAuth(false)}
            onSignedIn={async (state) => {
              await completeSignIn(state);
              setShowAuth(false);
              showToast('লগইন হয়েছে।');
            }}
          />
        </div>
      )}
      <ConfirmDialog
        open={confirmLogout}
        title="লগআউট করবেন?"
        description="এই ফোনের হিসাব মুছবে না। আবার লগইন করলে আগের মতো চলবে।"
        confirmLabel="হ্যাঁ, লগআউট"
        onCancel={() => setConfirmLogout(false)}
        onConfirm={async () => {
          await signOut();
          setConfirmLogout(false);
          showToast('লগআউট হয়েছে।', 'info');
        }}
      />

      {supportLink(data.businessProfile.shopName) && (
        <a
          href={supportLink(data.businessProfile.shopName) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-tile-green-bg text-base font-bold text-tile-green-fg shadow-card"
        >
          সাহায্য দরকার? WhatsApp-এ লিখুন
        </a>
      )}

      <section className="space-y-3.5 rounded-3xl border-accent border-2 p-5 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">
              অ্যাপ ও সাহায্য
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              আপনার সব হিসাব এই ফোনেই রাখা আছে। নিয়মিত ব্যাকআপ নিন।
            </p>
            <p className="mt-1.5 text-xs font-medium text-ink-muted tabular-nums">{appVersionLabel()}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              goHome();
              replayGuide();
            }}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-on-primary"
          >
            <Hand className="h-4 w-4" />
            <span>অ্যাপ চালানো শিখুন</span>
          </button>
          {mode === 'demo' ? (
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-danger-soft text-xs font-semibold text-danger hover:bg-danger-soft"
            >
              <RotateCcw className="h-4 w-4" />
              <span>ডেমো খাতা রিসেট করুন</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void actions.enterDemo()}
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-surface-muted text-xs font-semibold text-ink hover:bg-secondary"
            >
              <FlaskConical className="h-4 w-4" />
              <span>ডেমো খাতা দেখুন (আসল খাতা অক্ষত থাকবে)</span>
            </button>
          )}
        </div>
      </section>

      <InstallCard dismissible={false} />

      {/* Bottom of the page: sign-out and the one dangerous action, away from everyday settings. */}
      <section className="space-y-2.5 pt-2">

        {auth.status === 'authenticated' && (

          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex h-11 w-full items-center justify-center rounded-2xl bg-danger text-sm font-bold text-white shadow-card"
          >
            <LogOut className='h-4 w-4 m-2' />
            লগআউট
          </button>
        )}
        <BackupSection part="danger" />
      </section>

      <ConfirmDialog
        open={confirmResetOpen}
        title="ডেমো খাতা রিসেট করবেন?"
        description="শুধু ডেমো খাতার হিসাব আবার শুরুর অবস্থায় ফিরবে। আপনার আসল খাতায় কোনো পরিবর্তন হবে না।"
        confirmLabel="হ্যাঁ, রিসেট করুন"
        tone="danger"
        isSubmitting={isResetting}
        onCancel={() => setConfirmResetOpen(false)}
        onConfirm={handleResetDemo}
      />
    </div>
  );
}
