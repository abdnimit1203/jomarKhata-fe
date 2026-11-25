"use client";

import React, { useState } from "react";
import {
  Bug,
  DatabaseBackup,
  FlaskConical,
  Hand,
  LifeBuoy,
  LogOut,
  PlayCircle,
  Mail,
  MessageCircle,
  RotateCcw,
  Save,
  Smartphone,
  Smile,
  Store,
  UserRound,
} from "lucide-react";
import { replayGuide } from "@/components/onboarding/FirstRunGuide";
import { appVersionLabel } from "@/lib/version";
import {
  GREETINGS,
  setGreetingKey,
  useGreetingKey,
  type GreetingKey,
} from "@/lib/greeting";
import { SegmentedControl } from "@/components/ui/segmented";
import { BackupSection } from "@/components/settings/BackupSection";
import { AccountSection } from "@/components/settings/AccountSection";
import { AuthScreen } from "@/components/onboarding/AuthScreen";
import { InstallCard } from "@/components/pwa/PwaPrompts";
import { supportEmailLink, supportLink } from "@/lib/support";
import { useServerConfig } from "@/lib/serverConfig";
import { PlanStatus } from "@/components/settings/PlanStatus";
import { ProfilePhoto } from "@/components/settings/ProfilePhoto";
import { TutorialSheet } from "@/components/support/TutorialVideos";
import { SettingsGroup } from "@/components/settings/SettingsGroup";
import { openBugReport } from "@/components/support/BugReport";
import { useJomarkhata } from "@/context/JomarkhataContext";
import { NumericInput } from "@/components/ui/NumericInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatBanglaNumber, parseNumericInput } from "@/lib/format";
import type { BusinessProfile } from "@/types/domain";

function SettingsProfileForm({ profile }: { profile: BusinessProfile }) {
  const { actions, showToast } = useJomarkhata();
  const [shopName, setShopName] = useState(profile.shopName);
  const [ownerName, setOwnerName] = useState(profile.ownerName);
  const [phone, setPhone] = useState(profile.phone);
  const [address, setAddress] = useState(profile.address);
  const [businessType, setBusinessType] = useState(profile.businessType);
  const [openCash, setOpenCash] = useState(
    String(profile.openingBalances.cash),
  );
  const [openBkash, setOpenBkash] = useState(
    String(profile.openingBalances.bkash),
  );
  const [openNagad, setOpenNagad] = useState(
    String(profile.openingBalances.nagad),
  );
  const [openBank, setOpenBank] = useState(
    String(profile.openingBalances.bank),
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(
    String(profile.defaultLowStockThreshold),
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
      showToast(
        err instanceof Error ? err.message : "সংরক্ষণ করা যায়নি।",
        "error",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-3.5">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-muted">
            দোকানের নাম *
          </label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              মালিকের নাম
            </label>
            <input
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              মোবাইল নম্বর
            </label>
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
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              ব্যবসার ধরন
            </label>
            <input
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="যেমন: মুদি ও জেনারেল স্টোর"
              className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-muted">
              ঠিকানা
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3.5 rounded-2xl bg-tile-sky-bg p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">শুরুতে কত টাকা ছিল</h2>
          <p className="text-xs text-ink-muted">
            বর্তমান ক্যাশ, বিকাশ, নগদ ও ব্যাংক ব্যালেন্স এই শুরুর ব্যালেন্স থেকে হিসাব হয়
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              শুরুর ক্যাশ
            </label>
            <NumericInput value={openCash} onChange={(r) => setOpenCash(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              শুরুর বিকাশ
            </label>
            <NumericInput value={openBkash} onChange={(r) => setOpenBkash(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">শুরুর নগদ</label>
            <NumericInput value={openNagad} onChange={(r) => setOpenNagad(r)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              শুরুর ব্যাংক
            </label>
            <NumericInput value={openBank} onChange={(r) => setOpenBank(r)} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">
            ডিফল্ট কম স্টক সতর্কতা সীমা
          </label>
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
          <span>{isSaving ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</span>
        </button>
      </div>
    </form>
  );
}

export function SettingsView() {
  const {
    data,
    actions,
    showToast,
    mode,
    auth,
    navigate,
    completeSignIn,
    signOut,
  } = useJomarkhata();
  const [showAuth, setShowAuth] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  // the guide points at the home screen and bottom bar
  const goHome = () => navigate("dashboard");
  const greetingKey = useGreetingKey();
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const server = useServerConfig(); // re-render when the helpline arrives from the server

  if (!data) return null;
  const shopName = data.businessProfile.shopName;
  const whatsapp = server.supportWhatsApp ? supportLink(shopName) : null;
  const email = server.supportEmail ? supportEmailLink(shopName) : null;

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      await actions.resetDemoData();
      setConfirmResetOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  // Owner (2026-11-25): shop settings open; everything else folded, one tap to open. Logout and
  // "খাতা খালি করুন" stay at the very bottom.
  return (
    <div className="mx-auto max-w-3xl space-y-3 pb-6">
      <section className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow-card">
        <ProfilePhoto name={shopName} />
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">{shopName}</h1>
          <p className="truncate text-xs text-ink-muted">
            {[data.businessProfile.ownerName, data.businessProfile.phone]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {data.businessProfile.businessType && (
            <p className="mt-0.5 text-xs text-primary-ink">
              {data.businessProfile.businessType}
            </p>
          )}
        </div>
      </section>

      <PlanStatus auth={auth} />

      <SettingsGroup
        title="দোকানের তথ্য"
        hint="নাম, মোবাইল, ঠিকানা, শুরুর ক্যাশ"
        icon={<Store className="h-5 w-5" />}
        tone="blue"
        defaultOpen
      >
        <SettingsProfileForm
          key={data.businessProfile.updatedAt}
          profile={data.businessProfile}
        />
      </SettingsGroup>

      <SettingsGroup
        title="অ্যাকাউন্ট ও সাবস্ক্রিপশন"
        hint={
          auth.status === "authenticated"
            ? auth.user.email || "আইডি, মেয়াদ, রেফারেল কোড"
            : "গেস্ট মোড — লগইন করা নেই"
        }
        icon={<UserRound className="h-5 w-5" />}
        tone="indigo"
      >
        <AccountSection auth={auth} onLogin={() => setShowAuth(true)} bare />
      </SettingsGroup>

      <SettingsGroup
        title="ব্যাকআপ"
        hint="ক্লাউড ও ফাইল ব্যাকআপ, ফেরত আনা"
        icon={<DatabaseBackup className="h-5 w-5" />}
        tone="green"
      >
        <BackupSection bare onLogin={() => setShowAuth(true)} />
      </SettingsGroup>

      {/* greeting on the home screen and in messages (shopkeepers of every faith) */}
      <SettingsGroup
        title="হোমে সম্ভাষণ"
        hint={GREETINGS.find((g) => g.key === greetingKey)?.text || "কিছু না"}
        icon={<Smile className="h-5 w-5" />}
        tone="purple"
      >
        <SegmentedControl
          aria-label="সম্ভাষণ"
          variant="chips"
          value={greetingKey}
          onValueChange={(v) => setGreetingKey(v as GreetingKey)}
          options={GREETINGS.map((g) => ({
            value: g.key,
            label: g.text || "কিছু না",
          }))}
        />
      </SettingsGroup>

      <SettingsGroup
        title="হেল্পলাইন"
        hint="WhatsApp বা ইমেলে সাহায্য নিন"
        icon={<LifeBuoy className="h-5 w-5" />}
        tone="orange"
      >
        <div className="space-y-2">
          {whatsapp && (
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-tile-green-fg text-sm font-bold text-on-primary"
            >
              <MessageCircle className="h-5 w-5" /> WhatsApp-এ লিখুন
            </a>
          )}
          {email && (
            <a
              href={email}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-ink"
            >
              <Mail className="h-5 w-5" /> ইমেল পাঠান
            </a>
          )}
          {server.bugReportEnabled && (
            <button
              type="button"
              onClick={openBugReport}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border-strong bg-white text-sm font-bold text-ink"
            >
              <Bug className="h-5 w-5" /> অ্যাপে সমস্যা জানান
            </button>
          )}
          {!whatsapp && !email && !server.bugReportEnabled && (
            <p className="text-sm text-ink-muted">
              হেল্পলাইন শিগগিরই যোগ হবে। ইন্টারনেট চালু রেখে একটু পরে আবার দেখুন।
            </p>
          )}
        </div>
      </SettingsGroup>

      <SettingsGroup
        title="অ্যাপ"
        hint={appVersionLabel()}
        icon={<Smartphone className="h-5 w-5" />}
        tone="sky"
      >
        <div className="space-y-2.5">
          <p className="text-xs leading-relaxed text-ink-muted">
            আপনার সব হিসাব এই ফোনেই রাখা আছে। নিয়মিত ব্যাকআপ নিন।
          </p>
          <button
            type="button"
            onClick={() => {
              goHome();
              replayGuide();
            }}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-sm font-bold text-on-primary"
          >
            <Hand className="h-4 w-4" />
            <span>অ্যাপ চালানো শিখুন</span>
          </button>
          {mode === "demo" ? (
            <button
              type="button"
              onClick={() => setConfirmResetOpen(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-danger-soft text-xs font-semibold text-danger"
            >
              <RotateCcw className="h-4 w-4" />
              <span>ডেমো খাতা রিসেট করুন</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void actions.enterDemo()}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-xs font-semibold text-ink"
            >
              <FlaskConical className="h-4 w-4" />
              <span>ডেমো খাতা দেখুন (আসল খাতা অক্ষত থাকবে)</span>
            </button>
          )}
          {server.tutorialVideos.length > 0 && (
            <button
              type="button"
              onClick={() => setTutorialOpen(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-bold text-ink"
            >
              <PlayCircle className="h-5 w-5 text-danger" /> ভিডিও টিউটোরিয়াল
            </button>
          )}
          <TutorialSheet open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
          <InstallCard dismissible={false} />
        </div>
      </SettingsGroup>

      {showAuth && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-canvas">
          <AuthScreen
            onBack={() => setShowAuth(false)}
            onSignedIn={async (state) => {
              await completeSignIn(state);
              setShowAuth(false);
              showToast("লগইন হয়েছে।");
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
          showToast("লগআউট হয়েছে।", "info");
        }}
      />

      {/* Bottom of the page: sign-out and the one dangerous action, away from everyday settings. */}
      <section className="space-y-2.5 pt-3">
        {auth.status === "authenticated" && (
          <button
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-danger text-sm font-bold text-on-primary shadow-card"
          >
            <LogOut className="h-4 w-4" />
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
