'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  WifiOff,
  BarChart3,
  BookOpen,
  BookText,
  Home,
  MoreHorizontal,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useOnline } from '@/hooks/use-online';
import { formatBanglaNumber } from '@/lib/format';
import { MORE_ROUTES, ROUTE_TITLES } from './navigation';
import { MoreSheet, QuickAddSheet } from './NavSheets';
import { SyncStatusSheet } from './SyncStatusSheet';
import { UpdateBanner } from '@/components/pwa/PwaPrompts';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { DashboardSkeleton, ToastContainer } from '@/components/ui/StateBlocks';
import { SaleFormSheet } from '@/components/sheets/SaleFormSheet';
import { PurchaseFormSheet } from '@/components/sheets/PurchaseFormSheet';
import { DueEntrySheet } from '@/components/sheets/DueEntrySheet';
import { ExpenseFormSheet } from '@/components/sheets/ExpenseFormSheet';
import {
  PartyFormSheet,
  ProductFormSheet,
  StockAdjustSheet,
} from '@/components/sheets/ProductAndPartySheets';
import { TransactionDetailSheet } from '@/components/sheets/TransactionDetailSheet';
import { DashboardView } from '@/components/views/DashboardView';
import { DuesView } from '@/components/views/DuesView';
import { SalesView } from '@/components/views/SalesView';
import { PurchasesView } from '@/components/views/PurchasesView';
import { LedgerView } from '@/components/views/LedgerView';
import { CashExpenseView } from '@/components/views/CashExpenseView';
import { StockView } from '@/components/views/StockView';
import { ReportsView } from '@/components/views/ReportsView';
import { SettingsView } from '@/components/views/SettingsView';
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen';
import { ShopSetupScreen } from '@/components/onboarding/ShopSetupScreen';
import { LegacyChoiceScreen } from '@/components/onboarding/LegacyChoiceScreen';
import type { AppRoute } from '@/types/domain';

const DESKTOP_NAV: Array<{ id: AppRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'হোম (ড্যাশবোর্ড)', icon: Home },
  { id: 'sales', label: 'বিক্রির হিসাব', icon: ShoppingBag },
  { id: 'purchases', label: 'কেনার হিসাব', icon: ShoppingCart },
  { id: 'dues', label: 'বাকি', icon: BookOpen },
  { id: 'ledger', label: 'সব লেনদেন (লেজার)', icon: BookText },
  { id: 'cash', label: 'দৈনিক ক্যাশ ও খরচ', icon: Wallet },
  { id: 'stock', label: 'স্টকের হিসাব', icon: Package },
  { id: 'reports', label: 'ব্যবসার রিপোর্ট', icon: BarChart3 },
  { id: 'settings', label: 'বিজনেস সেটিংস', icon: Settings },
];

/**
 * Connection indicator: just a softly pulsing green dot when online, a Wi-Fi-off icon when offline.
 * Hover (desktop) or tap (phone) shows a tiny label for a moment. Never claims cloud backup.
 */
function ConnectionDot() {
  const online = useOnline();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!show) return;
    const t = window.setTimeout(() => setShow(false), 2500);
    return () => window.clearTimeout(t);
  }, [show]);
  const label = online ? 'অনলাইন' : 'অফলাইন — হিসাব ফোনে সংরক্ষিত হচ্ছে';
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        aria-label={online ? 'অনলাইন' : 'অফলাইন'}
        className="flex h-10 w-10 items-center justify-center rounded-full"
      >
        {online ? (
          <span aria-hidden="true" className="jk-pulse relative h-2.5 w-2.5 rounded-full bg-success ring-2 ring-white/70" />
        ) : (
          <WifiOff aria-hidden="true" className="h-5 w-5 text-on-primary" />
        )}
      </button>
      {show && (
        <span
          role="status"
          className="absolute top-1/2 right-full z-[100] mr-1 -translate-y-1/2 rounded-xl bg-ink px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-hero"
        >
          {label}
        </span>
      )}
    </span>
  );
}

export function AppShell() {
  const {
    data,
    isLoading,
    error,
    activeRoute,
    activeSheet,
    toasts,
    navigate,
    openSheet,
    closeSheet,
    dismissToast,
    refresh,
    selectedPartyId,
    goBack,
    discardPrompt,
    cancelDiscard,
    forceCloseSheet,
    showToast,
    phase,
    mode,
    actions,
    access,
  } = useJomarkhata();
  const [setupOpen, setSetupOpen] = useState(false);
  const pending = data?.pendingSyncCount ?? 0;
  const isHome = activeRoute === 'dashboard';

  // S3 first run: welcome → shop setup (empty khata), or the D15 choice for an older build's data.
  if (!isLoading && !error && phase === 'welcome') {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        {setupOpen ? (
          <ShopSetupScreen onBack={() => setSetupOpen(false)} />
        ) : (
          <WelcomeScreen
            onStart={() => setSetupOpen(true)}
            onDemo={() => void actions.enterDemo()}
          />
        )}
      </>
    );
  }
  if (!isLoading && !error && phase === 'legacy_choice') {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <LegacyChoiceScreen />
      </>
    );
  }

  const renderActiveView = () => {
    switch (activeRoute) {
      case 'dashboard':
        return <DashboardView />;
      case 'sales':
        return <SalesView />;
      case 'purchases':
        return <PurchasesView />;
      case 'dues':
        return <DuesView />;
      case 'ledger':
        return <LedgerView />;
      case 'cash':
        return <CashExpenseView />;
      case 'stock':
        return <StockView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
    }
  };

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex min-h-dvh">
        {/* Desktop Left Sidebar (lg+) */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-border lg:bg-white">
          <div className="flex h-16 items-center gap-3 border-b border-border px-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0" />
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-ink">জমারখাতা</p>
              <p className="truncate text-xs text-ink-muted">
                {data?.businessProfile.shopName || 'দোকানের সব হিসাব'}
              </p>
            </div>
          </div>

          {/* Primary Desktop Quick CTA */}
          <div className="px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={() => openSheet({ type: 'sale' })}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary-gradient text-sm font-semibold text-on-primary shadow-xs transition-colors hover:brightness-[0.97] active:scale-[0.99]"
            >
              <Plus className="h-4 w-4" />
              <span>নতুন বিক্রি</span>
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="প্রধান মেনু">
            {DESKTOP_NAV.map((item) => {
              const Icon = item.icon;
              const active = activeRoute === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  className={`flex min-h-[44px] w-full items-center gap-3 rounded-2xl px-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-secondary font-semibold text-primary-ink'
                      : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-border px-4 py-3 text-xs text-ink-subtle">
            দোকানের সব হিসাব, এক খাতায়।
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          {/* Colourful sticky top bar. Home: greeting. Other screens: back + title. Always: online/offline pill. */}
          <header className="sticky top-0 z-30 overflow-hidden bg-primary-gradient text-on-primary shadow-hero lg:rounded-none">
            {/* soft decorative shapes, like the reference card waves */}
            <span aria-hidden="true" className="pointer-events-none absolute -top-10 right-10 h-28 w-28 rounded-full bg-white/10" />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 right-[-1.5rem] h-28 w-28 rounded-full bg-white/10" />
            <div className="relative flex h-16 items-center justify-between gap-3 px-4 lg:px-8">
              {isHome ? (
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/logo-mark.png"
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-[0.7rem] ring-2 ring-white/80 lg:hidden"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-on-primary">আসসালামু আলাইকুম,</p>
                    <p className="truncate text-base font-bold text-on-primary">
                      {data?.businessProfile.shopName || 'জমারখাতা'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label="পিছনে যান"
                    className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20 text-on-primary transition-colors hover:bg-white/30"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <h1 className="truncate text-lg font-bold text-on-primary">
                    {activeRoute === 'dues' && selectedPartyId
                      ? data?.parties.find((p) => p.id === selectedPartyId)?.name ?? ROUTE_TITLES.dues
                      : ROUTE_TITLES[activeRoute]}
                  </h1>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-2">
                <ConnectionDot />
                <button
                  type="button"
                  onClick={() => openSheet({ type: 'expense' })}
                  className="hidden h-10 items-center gap-1.5 rounded-xl bg-white/20 px-3.5 text-sm font-semibold text-on-primary transition-colors hover:bg-white/30 lg:inline-flex"
                >
                  <Receipt className="h-4 w-4" />
                  <span>সহজ খরচ</span>
                </button>
                {isHome && (
                  <button
                    type="button"
                    onClick={() => navigate('settings')}
                    aria-label="সেটিংস"
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 text-on-primary transition-colors hover:bg-white/30"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Main Scrollable Viewport */}
          <main className="flex-1 px-4 pt-4 pb-24 lg:px-8 lg:pt-6 lg:pb-10">
            <UpdateBanner />
            {access.level !== 'full' && !isLoading && (
              <div
                role="status"
                className={`mx-auto mb-4 max-w-6xl rounded-2xl px-4 py-3 text-sm font-semibold ${
                  access.level === 'grace' ? 'bg-warning-soft text-warning-ink' : 'bg-danger-soft text-danger'
                }`}
              >
                {access.level === 'grace'
                  ? `সাবস্ক্রিপশনের মেয়াদ শেষ। আরও ${formatBanglaNumber(access.graceDaysLeft ?? 0)} দিন সব কাজ চলবে — এর মধ্যে নবায়ন করুন।`
                  : 'সাবস্ক্রিপশনের মেয়াদ শেষ। আপনার সব হিসাব দেখা ও ব্যাকআপ নেওয়া যাবে, কিন্তু নতুন কিছু লেখা যাবে না।'}
              </div>
            )}
            {mode === 'demo' && !isLoading && (
              <div
                role="status"
                className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-2 rounded-2xl bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-ink"
              >
                <span>ডেমো খাতা দেখছেন — এখানের কিছুই আপনার আসল খাতায় যাবে না।</span>
                <button
                  type="button"
                  onClick={() => void actions.exitDemo()}
                  className="rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-warning-ink shadow-sm"
                >
                  আসল খাতায় যান
                </button>
              </div>
            )}
            {isLoading ? (
              <DashboardSkeleton />
            ) : error ? (
              <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-card">
                <p className="text-base font-semibold text-danger">ডেটা লোড করতে সমস্যা হয়েছে</p>
                <p className="mt-1 text-xs text-ink-muted">{error}</p>
                <button
                  type="button"
                  onClick={refresh}
                  className="mt-4 h-11 rounded-2xl bg-primary-gradient px-6 text-sm font-semibold text-on-primary"
                >
                  আবার চেষ্টা করুন
                </button>
              </div>
            ) : (
              renderActiveView()
            )}
          </main>
        </div>
      </div>

      {/* Mobile bottom bar (S2, D2): হোম · বাকি · [+] · লেনদেন · আরও */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-border bg-white/95 backdrop-blur-md lg:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-center pb-safe">
          {([
            { id: 'dashboard', label: 'হোম', icon: Home, active: activeRoute === 'dashboard', onClick: () => navigate('dashboard') },
            { id: 'dues', label: 'বাকি', icon: BookOpen, active: activeRoute === 'dues', onClick: () => navigate('dues') },
            { id: 'add', label: 'নতুন', icon: Plus, active: false, onClick: () => openSheet({ type: 'quick_add' }) },
            { id: 'ledger', label: 'লেনদেন', icon: BookText, active: activeRoute === 'ledger', onClick: () => navigate('ledger') },
            {
              id: 'more',
              label: 'আরও',
              icon: MoreHorizontal,
              active: MORE_ROUTES.includes(activeRoute),
              onClick: () => openSheet({ type: 'more' }),
            },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            if (tab.id === 'add') {
              return (
                <div key={tab.id} className="flex justify-center">
                  <button
                    type="button"
                    onClick={tab.onClick}
                    aria-label="নতুন লেনদেন যোগ করুন"
                    className="-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary-gradient text-on-primary shadow-hero ring-4 ring-white transition-transform active:scale-95"
                  >
                    <Plus className="h-7 w-7" strokeWidth={2.5} />
                  </button>
                </div>
              );
            }
            return (
              <button
                key={tab.id}
                type="button"
                onClick={tab.onClick}
                aria-current={tab.active ? 'page' : undefined}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  tab.active ? 'text-primary-ink' : 'text-ink-subtle'
                }`}
              >
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                    tab.active ? 'bg-secondary' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className={`text-xs leading-tight ${tab.active ? 'font-bold' : 'font-medium'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Global Action Sheets (conditionally mounted so state initializes cleanly on open) */}
      {activeSheet.type === 'sale' && (
        <SaleFormSheet
          key={activeSheet.editSale?.id ?? 'new-sale'}
          open
          editSale={activeSheet.editSale ?? null}
          onClose={closeSheet}
        />
      )}
      {activeSheet.type === 'purchase' && (
        <PurchaseFormSheet
          key={activeSheet.editPurchase?.id ?? 'new-purchase'}
          open
          editPurchase={activeSheet.editPurchase ?? null}
          onClose={closeSheet}
        />
      )}
      {activeSheet.type === 'due' && (
        <DueEntrySheet
          key={activeSheet.editDue?.id ?? `${activeSheet.partyId ?? 'any'}-${activeSheet.defaultEntryType ?? 'coll'}`}
          open
          initialPartyId={activeSheet.partyId ?? null}
          defaultEntryType={activeSheet.defaultEntryType}
          editDue={activeSheet.editDue ?? null}
          onClose={closeSheet}
        />
      )}
      {activeSheet.type === 'expense' && (
        <ExpenseFormSheet
          key={activeSheet.editExpense?.id ?? 'new-expense'}
          open
          editExpense={activeSheet.editExpense ?? null}
          onClose={closeSheet}
        />
      )}
      {activeSheet.type === 'product' && (
        <ProductFormSheet
          key={activeSheet.editProduct?.id ?? 'new-product'}
          open
          editProduct={activeSheet.editProduct ?? null}
          onClose={closeSheet}
        />
      )}
      {activeSheet.type === 'stock_adjust' && (
        <StockAdjustSheet
          key={activeSheet.product.id}
          open
          product={activeSheet.product}
          onClose={closeSheet}
        />
      )}
      {activeSheet.type === 'party' && (
        <PartyFormSheet
          key={activeSheet.editParty?.id ?? `new-party-${activeSheet.defaultRole ?? 'customer'}`}
          open
          defaultRole={activeSheet.defaultRole ?? 'customer'}
          editParty={activeSheet.editParty ?? null}
          onClose={closeSheet}
        />
      )}
      {activeSheet.type === 'quick_add' && <QuickAddSheet onClose={closeSheet} />}
      {activeSheet.type === 'more' && <MoreSheet onClose={closeSheet} />}
      {activeSheet.type === 'sync_status' && <SyncStatusSheet onClose={closeSheet} />}

      <ConfirmDialog
        open={discardPrompt}
        title="লেখা তথ্য বাদ দেবেন?"
        description="এই ফর্মে যা লিখেছেন তা সংরক্ষণ হয়নি। বন্ধ করলে মুছে যাবে।"
        confirmLabel="হ্যাঁ, বন্ধ করুন"
        cancelLabel="ফর্মে ফিরে যান"
        onCancel={cancelDiscard}
        onConfirm={forceCloseSheet}
      />

      {activeSheet.type === 'transaction_detail' && (
        <TransactionDetailSheet
          key={`${activeSheet.sourceType}-${activeSheet.sourceId}`}
          open
          sourceType={activeSheet.sourceType}
          sourceId={activeSheet.sourceId}
          onClose={closeSheet}
        />
      )}
    </div>
  );
}
