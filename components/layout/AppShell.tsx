'use client';

import React from 'react';
import {
  BarChart3,
  BookOpen,
  BookText,
  Home,
  Package,
  Plus,
  Receipt,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Wallet,
} from 'lucide-react';
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
import type { AppRoute } from '@/types/domain';

const DESKTOP_NAV: Array<{ id: AppRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'হোম (ড্যাশবোর্ড)', icon: Home },
  { id: 'sales', label: 'বেচার খাতা (বিক্রি)', icon: ShoppingBag },
  { id: 'purchases', label: 'কেনার খাতা (ক্রয়)', icon: ShoppingCart },
  { id: 'dues', label: 'বাকির খাতা', icon: BookOpen },
  { id: 'ledger', label: 'সব লেনদেন (লেজার)', icon: BookText },
  { id: 'cash', label: 'দৈনিক ক্যাশ ও খরচ', icon: Wallet },
  { id: 'stock', label: 'স্টকের হিসাব', icon: Package },
  { id: 'reports', label: 'ব্যবসার রিপোর্ট', icon: BarChart3 },
  { id: 'settings', label: 'বিজনেস সেটিংস', icon: Settings },
];

const MOBILE_TABS: Array<{ id: AppRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'dashboard', label: 'হোম', icon: Home },
  { id: 'dues', label: 'বাকি', icon: BookOpen },
  { id: 'ledger', label: 'লেনদেন', icon: BookText },
  { id: 'stock', label: 'স্টক', icon: Package },
  { id: 'reports', label: 'রিপোর্ট', icon: BarChart3 },
];

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
  } = useJomarkhata();

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
    <div className="min-h-dvh bg-[#F5F8F6] text-[#0F1F18]">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <div className="flex min-h-dvh">
        {/* Desktop Left Sidebar (lg+) */}
        <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-[#E2EAE5] lg:bg-white">
          <div className="flex h-16 items-center gap-3 border-b border-[#EDF3F0] px-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0D7A56] text-lg font-bold text-white">
              জ
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-[#0F1F18]">জমারখাতা</p>
              <p className="truncate text-[11px] text-[#586B62]">
                {data?.businessProfile.shopName || 'দোকানের সব হিসাব'}
              </p>
            </div>
          </div>

          {/* Primary Desktop Quick CTA */}
          <div className="px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={() => openSheet({ type: 'sale' })}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#0D7A56] text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[#096244] active:scale-[0.99]"
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
                      ? 'bg-[#E6F4EE] font-semibold text-[#0D7A56]'
                      : 'text-[#3F564B] hover:bg-[#F3F7F5] hover:text-[#0F1F18]'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-[#EDF3F0] px-4 py-3 text-[11px] text-[#667B71]">
            দোকানের সব হিসাব, এক খাতায়।
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          {/* Mobile Sticky Top App Bar (56px — stays well within 15% mobile sticky cap with bottom bar) */}
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[#E5EDE8] bg-white/95 px-4 backdrop-blur-md lg:h-16 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0D7A56] text-sm font-bold text-white lg:hidden">
                জ
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-[#0F1F18]">
                  {data?.businessProfile.shopName || 'জমারখাতা'}
                </p>
                <p className="hidden text-xs text-[#586B62] lg:block">
                  দোকানের সব হিসাব, এক খাতায়।
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openSheet({ type: 'expense' })}
                className="hidden h-10 items-center gap-1.5 rounded-xl bg-[#EEF5F1] px-3.5 text-xs font-semibold text-[#0D7A56] hover:bg-[#DFECE6] lg:inline-flex"
              >
                <Receipt className="h-4 w-4" />
                <span>সহজ খরচ</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('settings')}
                aria-label="সেটিংস"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F3F7F5] text-[#2F463B] transition-colors hover:bg-[#E6F4EE] hover:text-[#0D7A56]"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* Main Scrollable Viewport */}
          <main className="flex-1 px-4 pt-4 pb-24 lg:px-8 lg:pt-6 lg:pb-10">
            {isLoading ? (
              <DashboardSkeleton />
            ) : error ? (
              <div className="mx-auto max-w-md rounded-3xl bg-white p-6 text-center shadow-card">
                <p className="text-base font-semibold text-[#DC2626]">ডেটা লোড করতে সমস্যা হয়েছে</p>
                <p className="mt-1 text-xs text-[#586B62]">{error}</p>
                <button
                  type="button"
                  onClick={refresh}
                  className="mt-4 h-11 rounded-2xl bg-[#0D7A56] px-6 text-sm font-semibold text-white"
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

      {/* Mobile Fixed 5-Tab Bottom Bar (< lg) — Reference Image 1 Clean Emerald Active Tabs */}
      <nav
        aria-label="মোবাইল নেভিগেশন"
        className="fixed right-0 bottom-0 left-0 z-40 border-t border-[#E4ECE7] bg-white/95 backdrop-blur-md lg:hidden"
      >
        <div className="grid h-16 grid-cols-5 items-center pb-safe">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeRoute === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => navigate(tab.id)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 transition-colors ${
                  active ? 'text-[#0D7A56]' : 'text-[#6A7F75]'
                }`}
              >
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                    active ? 'bg-[#E6F4EE]' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className={`text-[11px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>
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
          defaultEntryType={activeSheet.defaultEntryType ?? 'customer_collection'}
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
