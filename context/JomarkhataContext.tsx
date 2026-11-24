'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { SheetGuardContext } from '@/lib/sheet-guard';
import { toFriendlyError } from '@/lib/errors';
import { timed } from '@/lib/perf';
import { decideAccess, type AccessDecision, type CachedSubscription } from '@/lib/access-policy';
import { authFromSession, LOCAL_AUTH, type AuthState } from '@/lib/auth';
import { authProvider, refreshSession } from '@/lib/auth-firebase';

/** Actions that change records. Blocked when access is read-only (view + export always work). */
const WRITE_ACTION = /^(create|edit|void|record|update|adjust|set|restore|clear)/;
export const READ_ONLY_MESSAGE = 'সাবস্ক্রিপশনের মেয়াদ শেষ — এখন শুধু হিসাব দেখা ও ব্যাকআপ নেওয়া যাবে।';
const DAY_MS = 24 * 60 * 60 * 1000;
import type { BackupPreview } from '@/lib/backup';
import {
  jomarkhataService,
  type AppDataSnapshot,
  type CreateExpenseInput,
  type CreatePurchaseInput,
  type CreateSaleInput,
  type RecordDueEntryInput,
  type NewShopInput,
  type StartupPhase,
  type StartupState,
} from '@/services/jomarkhataService';
import { computeCurrentBalances } from '@/services/financeCalculator';
import type {
  AppRoute,
  ChannelOpeningBalances,
  CurrentBalancesSummary,
  DbMode,
  DueTransaction,
  ExpenseRecord,
  Party,
  PartyRole,
  Product,
  PurchaseRecord,
  SaleRecord,
  SyncQueueItem,
} from '@/types/domain';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export type ActiveSheet =
  | { type: 'none' }
  | { type: 'sale'; editSale?: SaleRecord | null; returnTo?: ActiveSheet }
  | { type: 'purchase'; editPurchase?: PurchaseRecord | null; returnTo?: ActiveSheet }
  | {
      type: 'due';
      partyId?: string | null;
      defaultEntryType?: RecordDueEntryInput['entryType'];
      editDue?: DueTransaction | null;
      returnTo?: ActiveSheet;
    }
  | { type: 'expense'; editExpense?: ExpenseRecord | null; returnTo?: ActiveSheet }
  | { type: 'product'; editProduct?: Product | null }
  | { type: 'stock_adjust'; product: Product }
  | { type: 'party'; defaultRole?: PartyRole; editParty?: Party | null }
  | { type: 'quick_add' }
  | { type: 'sync_status' }
  | { type: 'more' }
  | {
      type: 'transaction_detail';
      sourceType: 'sale' | 'purchase' | 'due_transaction' | 'expense';
      sourceId: string;
    };

interface JomarkhataContextValue {
  data: AppDataSnapshot | null;
  isLoading: boolean;
  /** S3 startup phase: welcome (no shop yet), legacy_choice (older build's data), ready. */
  phase: StartupPhase;
  /** Which database is active: the owner's real khata, or the separate demo khata. */
  mode: DbMode;
  /** navigator.storage.persist() result: true = the browser won't evict data under storage pressure. */
  storagePersisted: boolean | null;
  /** `local` = guest / test mode (this phone only); `authenticated` = real backend session. */
  auth: AuthState;
  /** Call after a successful provider sign-in: caches the session on the phone. */
  completeSignIn: (state: AuthState) => Promise<void>;
  /** Firebase sign-out + forget the cached session. The khata on this phone is kept. */
  signOut: () => Promise<void>;
  /** S10 access policy (7-day grace → read-only). Local mode is always full. */
  access: AccessDecision;
  error: string | null;
  currentBalances: CurrentBalancesSummary;
  activeRoute: AppRoute;
  selectedPartyId: string | null;
  activeSheet: ActiveSheet;
  toasts: ToastMessage[];
  navigate: (route: AppRoute, options?: { partyId?: string | null }) => void;
  setSelectedPartyId: (partyId: string | null) => void;
  openSheet: (sheet: ActiveSheet) => void;
  /** Close the open sheet; asks first when the form has unsaved input. */
  closeSheet: () => void;
  /** Close without asking (used by the discard confirmation). */
  forceCloseSheet: () => void;
  discardPrompt: boolean;
  cancelDiscard: () => void;
  /** Go back one step (sheet, then party, then previous screen), like the Android back button. */
  goBack: () => void;
  showToast: (text: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  refresh: () => Promise<void>;
  actions: {
    updateBusinessProfile: (updates: {
      shopName: string;
      ownerName: string;
      phone: string;
      address: string;
      businessType: string;
      openingBalances: ChannelOpeningBalances;
      defaultLowStockThreshold: number;
    }) => Promise<void>;
    createParty: (input: {
      name: string;
      phone: string;
      address?: string;
      role: PartyRole;
      openingDue?: number;
    }) => Promise<Party>;
    updateParty: (
      partyId: string,
      updates: { name: string; phone: string; address?: string; dueReminderDate?: string | null }
    ) => Promise<void>;
    setPartyDueReminder: (partyId: string, dueReminderDate: string | null) => Promise<void>;
    createProduct: (input: {
      name: string;
      category: string;
      unit: string;
      purchasePrice: number;
      sellingPrice: number;
      stockQty: number;
      lowStockThreshold: number;
    }) => Promise<Product>;
    updateProduct: (
      productId: string,
      updates: {
        name: string;
        category: string;
        unit: string;
        purchasePrice: number;
        sellingPrice: number;
        lowStockThreshold: number;
      }
    ) => Promise<void>;
    adjustProductStock: (productId: string, deltaQty: number, note?: string) => Promise<void>;
    createSale: (input: CreateSaleInput) => Promise<SaleRecord>;
    editSale: (saleId: string, input: CreateSaleInput, reason?: string) => Promise<SaleRecord>;
    voidSale: (saleId: string, reason?: string) => Promise<void>;
    createPurchase: (input: CreatePurchaseInput) => Promise<PurchaseRecord>;
    editPurchase: (purchaseId: string, input: CreatePurchaseInput, reason?: string) => Promise<PurchaseRecord>;
    voidPurchase: (purchaseId: string, reason?: string) => Promise<void>;
    recordDueEntry: (input: RecordDueEntryInput) => Promise<DueTransaction>;
    editDueEntry: (
      dueId: string,
      updates: { amount: number; paymentMethod?: RecordDueEntryInput['paymentMethod']; note?: string; date?: string },
      reason?: string
    ) => Promise<void>;
    voidDueEntry: (dueId: string, reason?: string) => Promise<void>;
    createExpense: (input: CreateExpenseInput) => Promise<ExpenseRecord>;
    editExpense: (expenseId: string, input: CreateExpenseInput, reason?: string) => Promise<void>;
    voidExpense: (expenseId: string, reason?: string) => Promise<void>;
    resetDemoData: () => Promise<void>;
    exportBackupJson: (password?: string) => Promise<string>;
    inspectBackup: (text: string, password?: string) => Promise<BackupPreview>;
    restoreBackup: (text: string, password?: string) => Promise<void>;
    clearKhata: () => Promise<void>;
    getLastBackupAt: () => Promise<string | null>;
    getSyncStatus: () => Promise<{ counts: Record<string, number>; items: SyncQueueItem[] }>;
    getRecordSyncState: (entityId: string) => Promise<'local' | 'synced' | 'needs_review'>;
    getSafetyCopy: () => Promise<{ reason: string; createdAt: string; json: string } | null>;
    createShop: (input: NewShopInput) => Promise<void>;
    keepLegacyAsMine: () => Promise<void>;
    moveLegacyToDemo: () => Promise<void>;
    enterDemo: () => Promise<void>;
    exitDemo: () => Promise<void>;
  };
}

const JomarkhataContext = createContext<JomarkhataContextValue | null>(null);

interface HistoryEntry {
  jk?: boolean;
  /** The first entry of the session: back from here leaves the app. */
  root?: boolean;
  route?: AppRoute;
  partyId?: string | null;
  sheet?: boolean;
}

/**
 * Next.js's App Router reloads the page on popstate when an entry lacks its `__NA` marker, so
 * every entry we write keeps Next's own keys (copied from the current entry).
 */
function withNextState(entry: HistoryEntry): HistoryEntry & Record<string, unknown> {
  const cur = (window.history.state ?? {}) as Record<string, unknown>;
  const keep: Record<string, unknown> = {};
  for (const k of ['__NA', '__PRIVATE_NEXTJS_INTERNALS_TREE']) if (k in cur) keep[k] = cur[k];
  return { ...keep, ...entry };
}
const pushEntry = (entry: HistoryEntry) => window.history.pushState(withNextState(entry), '');
const replaceEntry = (entry: HistoryEntry) => window.history.replaceState(withNextState(entry), '');

const currentEntry = (): HistoryEntry =>
  (typeof window !== 'undefined' ? (window.history.state as HistoryEntry | null) : null) ?? {};

const EMPTY_BALANCES: CurrentBalancesSummary = {
  channelBalances: { cash: 0, bkash: 0, nagad: 0, bank: 0 },
  cashInHand: 0,
  digitalAndBankTotal: 0,
  totalLiquidBalance: 0,
  totalReceivables: 0,
  totalPayables: 0,
  netDuePosition: 0,
  totalStockQty: 0,
  totalStockValue: 0,
  lowStockCount: 0,
};

export function JomarkhataProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppDataSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [phase, setPhase] = useState<StartupPhase>('welcome');
  const [mode, setMode] = useState<DbMode>('real');
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [access, setAccess] = useState<AccessDecision>(() => decideAccess(null));
  const [auth, setAuth] = useState<AuthState>(LOCAL_AUTH);
  // Cached session first (works offline), then a quiet online refresh.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const cached = await jomarkhataService.getSession().catch(() => null);
      if (!alive || !cached) return;
      setAuth(authFromSession(cached));
      const fresh = await refreshSession();
      if (!alive || !fresh || fresh.status !== 'authenticated') return;
      await jomarkhataService.saveSession(fresh.user).catch(() => {});
      setAuth(fresh);
    })();
    return () => {
      alive = false;
    };
  }, []);
  const completeSignIn = useCallback(async (state: AuthState) => {
    if (state.status !== 'authenticated') return;
    await jomarkhataService.saveSession(state.user);
    setAuth(state);
  }, []);
  const signOut = useCallback(async () => {
    await authProvider.signOut().catch(() => {});
    await jomarkhataService.saveSession(null);
    setAuth(LOCAL_AUTH);
  }, []);
  const accessRef = useRef(access);
  useEffect(() => {
    accessRef.current = access; // read by write guards outside render
  }, [access]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      let sub: CachedSubscription | null = null;
      try {
        sub = await jomarkhataService.getCachedSubscription();
      } catch {
        sub = null;
      }
      // Development-only override to test the banners and the read-only guard (never in production).
      if (process.env.NODE_ENV === 'development') {
        const o = window.localStorage.getItem('jk_dev_access');
        if (o === 'grace' || o === 'read_only') {
          const days = o === 'grace' ? 2 : 10;
          sub = { status: 'expired', expiresAt: new Date(Date.now() - days * DAY_MS).toISOString(), serverTime: new Date().toISOString() };
        }
      }
      if (alive) setAccess(decideAccess(sub));
    })();
    return () => {
      alive = false;
    };
  }, [phase, auth]);
  useEffect(() => {
    // Ask the browser to keep IndexedDB even when the phone is low on space (plan 7.1).
    const st = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    if (!st?.persist) return;
    st.persisted()
      .then((already) => (already ? true : st.persist()))
      .then(setStoragePersisted)
      .catch(() => setStoragePersisted(false));
  }, []);
  const [error, setError] = useState<string | null>(null);
  const applyStartup = useCallback((st: StartupState) => {
    setPhase(st.phase);
    setMode(st.mode);
    setData(st.snapshot);
    setError(null);
  }, []);
  const [activeRoute, setActiveRoute] = useState<AppRoute>('dashboard');
  const [selectedPartyId, setSelectedPartyIdState] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>({ type: 'none' });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [discardPrompt, setDiscardPrompt] = useState(false);

  // ---- S2: history / Android back integration ----
  // Screens and sheets are React state, not URLs. Each screen change or opened sheet pushes one
  // history entry (tagged `jk`), so the hardware back button closes the sheet, leaves the party,
  // then returns to the previous screen.
  const sheetDirtyRef = useRef(false);
  const activeSheetRef = useRef<ActiveSheet>({ type: 'none' });
  const screenRef = useRef<{ route: AppRoute; partyId: string | null }>({ route: 'dashboard', partyId: null });
  useEffect(() => {
    activeSheetRef.current = activeSheet;
    screenRef.current = { route: activeRoute, partyId: selectedPartyId };
  });

  useEffect(() => {
    // Wait one tick so Next.js has written its own history entry first, then tag it.
    const tagRoot = window.setTimeout(
      () => replaceEntry({ jk: true, root: true, route: 'dashboard', partyId: null, sheet: false }),
      0
    );
    const onPop = (e: PopStateEvent) => {
      const st = (e.state ?? {}) as HistoryEntry;
      if (activeSheetRef.current.type !== 'none' && !st.sheet) {
        if (sheetDirtyRef.current) {
          // Keep the sheet: put its entry back and ask first.
          pushEntry({ jk: true, ...screenRef.current, sheet: true });
          setDiscardPrompt(true);
          return;
        }
        activeSheetRef.current = { type: 'none' };
        setActiveSheet({ type: 'none' });
      }
      if (st.jk) {
        screenRef.current = { route: st.route ?? 'dashboard', partyId: st.partyId ?? null };
        setActiveRoute(st.route ?? 'dashboard');
        setSelectedPartyIdState(st.partyId ?? null);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.clearTimeout(tagRoot);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const markDirty = useCallback(() => {
    if (activeSheetRef.current.type !== 'none') sheetDirtyRef.current = true;
  }, []);
  const sheetGuard = useMemo(() => ({ markDirty }), [markDirty]);

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-2), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refresh = useCallback(async () => {
    try {
      // AP-8: re-read only what the save changed (falls back to a full read when needed).
      const snap = await timed('loadChanges', () => jomarkhataService.loadChanges());
      setData(snap);
      setError(null);
      // Every successful action reloads data, so the open form's input has been saved.
      sheetDirtyRef.current = false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ডেটা লোড করতে সমস্যা হয়েছে।');
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const st = await jomarkhataService.bootstrap(); // read-only: never seeds or deletes
        if (active) applyStartup(st);
      } catch (err) {
        if (active) setError(toFriendlyError(err).message);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [applyStartup]);

  const navigate = useCallback((route: AppRoute, options?: { partyId?: string | null }) => {
    const partyId = options && 'partyId' in options ? options.partyId ?? null : null;
    const same = screenRef.current.route === route && screenRef.current.partyId === partyId;
    const entry: HistoryEntry = { jk: true, route, partyId, sheet: false };
    // Navigating from inside a sheet (e.g. the আরও menu) replaces the sheet's entry.
    if (currentEntry().sheet) replaceEntry(entry);
    else if (!same) pushEntry(entry);
    sheetDirtyRef.current = false;
    activeSheetRef.current = { type: 'none' };
    screenRef.current = { route, partyId };
    setActiveSheet({ type: 'none' });
    setActiveRoute(route);
    setSelectedPartyIdState(partyId);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  const setSelectedPartyId = useCallback((partyId: string | null) => {
    if (partyId) {
      pushEntry({ jk: true, route: screenRef.current.route, partyId, sheet: false });
      screenRef.current = { ...screenRef.current, partyId };
      setSelectedPartyIdState(partyId);
    } else if (currentEntry().partyId) {
      window.history.back(); // popstate restores the list
    } else {
      setSelectedPartyIdState(null);
    }
  }, []);

  const openSheet = useCallback((sheet: ActiveSheet) => {
    if (activeSheetRef.current.type === 'none') {
      pushEntry({ jk: true, ...screenRef.current, sheet: true });
    }
    sheetDirtyRef.current = false;
    activeSheetRef.current = sheet;
    setActiveSheet(sheet);
  }, []);

  const forceCloseSheet = useCallback(() => {
    sheetDirtyRef.current = false;
    setDiscardPrompt(false);
    if (currentEntry().sheet) {
      window.history.back(); // popstate closes it
    } else {
      activeSheetRef.current = { type: 'none' };
      setActiveSheet({ type: 'none' });
    }
  }, []);

  const closeSheet = useCallback(() => {
    if (sheetDirtyRef.current) return setDiscardPrompt(true);
    // An edit opened from a detail sheet goes back to that detail (S7), keeping the same history entry.
    const back = (activeSheetRef.current as { returnTo?: ActiveSheet }).returnTo;
    if (back) {
      activeSheetRef.current = back;
      setActiveSheet(back);
      return;
    }
    forceCloseSheet();
  }, [forceCloseSheet]);

  const cancelDiscard = useCallback(() => setDiscardPrompt(false), []);

  const goBack = useCallback(() => {
    const entry = currentEntry();
    const atHome = screenRef.current.route === 'dashboard' && !screenRef.current.partyId;
    if (entry.jk && !atHome && !entry.root) window.history.back();
    else navigate('dashboard');
  }, [navigate]);

  const currentBalances = useMemo(() => {
    if (!data) return EMPTY_BALANCES;
    return computeCurrentBalances(
      data.businessProfile,
      data.parties,
      data.moneyMovements,
      data.products
    );
  }, [data]);

  const actions = useMemo(
    () => ({
      updateBusinessProfile: async (updates: Parameters<typeof jomarkhataService.updateBusinessProfile>[0]) => {
        await jomarkhataService.updateBusinessProfile(updates);
        await refresh();
        showToast('দোকানের তথ্য সংরক্ষণ করা হয়েছে।');
      },
      createParty: async (input: Parameters<typeof jomarkhataService.createParty>[0]) => {
        const created = await jomarkhataService.createParty(input);
        await refresh();
        showToast(`${created.name} যোগ করা হয়েছে।`);
        return created;
      },
      updateParty: async (
        partyId: string,
        updates: Parameters<typeof jomarkhataService.updateParty>[1]
      ) => {
        await jomarkhataService.updateParty(partyId, updates);
        await refresh();
        showToast('তথ্য আপডেট করা হয়েছে।');
      },
      setPartyDueReminder: async (partyId: string, dueReminderDate: string | null) => {
        await jomarkhataService.setPartyDueReminder(partyId, dueReminderDate);
        await refresh();
        showToast(dueReminderDate ? 'পরিশোধের তারিখ সেট করা হয়েছে।' : 'পরিশোধের তারিখ সরানো হয়েছে।');
      },
      createProduct: async (input: Parameters<typeof jomarkhataService.createProduct>[0]) => {
        const created = await jomarkhataService.createProduct(input);
        await refresh();
        showToast(`${created.name} প্রোডাক্ট লিস্টে যোগ হয়েছে।`);
        return created;
      },
      updateProduct: async (
        productId: string,
        updates: Parameters<typeof jomarkhataService.updateProduct>[1]
      ) => {
        await jomarkhataService.updateProduct(productId, updates);
        await refresh();
        showToast('পণ্যের তথ্য আপডেট হয়েছে।');
      },
      adjustProductStock: async (productId: string, deltaQty: number, note?: string) => {
        await jomarkhataService.adjustProductStock(productId, deltaQty, note);
        await refresh();
        showToast('স্টক হালনাগাদ করা হয়েছে।');
      },
      createSale: async (input: CreateSaleInput) => {
        const created = await jomarkhataService.createSale(input);
        await refresh();
        showToast(`বিক্রি ${created.invoiceNo} সংরক্ষণ হয়েছে।`);
        return created;
      },
      editSale: async (saleId: string, input: CreateSaleInput, reason?: string) => {
        const updated = await jomarkhataService.editSale(saleId, input, reason);
        await refresh();
        showToast(`বিক্রি ${updated.invoiceNo} সংশোধন হয়েছে।`);
        return updated;
      },
      voidSale: async (saleId: string, reason?: string) => {
        await jomarkhataService.voidSale(saleId, reason);
        await refresh();
        showToast('বিক্রি বাতিল করা হয়েছে এবং ব্যালেন্স সমন্বয় হয়েছে।', 'info');
      },
      createPurchase: async (input: CreatePurchaseInput) => {
        const created = await jomarkhataService.createPurchase(input);
        await refresh();
        showToast(`ক্রয় ${created.billNo} সংরক্ষণ হয়েছে।`);
        return created;
      },
      editPurchase: async (purchaseId: string, input: CreatePurchaseInput, reason?: string) => {
        const updated = await jomarkhataService.editPurchase(purchaseId, input, reason);
        await refresh();
        showToast(`ক্রয় ${updated.billNo} সংশোধন হয়েছে।`);
        return updated;
      },
      voidPurchase: async (purchaseId: string, reason?: string) => {
        await jomarkhataService.voidPurchase(purchaseId, reason);
        await refresh();
        showToast('ক্রয় বাতিল করা হয়েছে এবং হিসাব সমন্বয় হয়েছে।', 'info');
      },
      recordDueEntry: async (input: RecordDueEntryInput) => {
        const created = await jomarkhataService.recordDueEntry(input);
        await refresh();
        showToast('বাকি লেনদেন সংরক্ষণ হয়েছে।');
        return created;
      },
      editDueEntry: async (
        dueId: string,
        updates: { amount: number; paymentMethod?: RecordDueEntryInput['paymentMethod']; note?: string; date?: string },
        reason?: string
      ) => {
        await jomarkhataService.editDueEntry(dueId, updates, reason);
        await refresh();
        showToast('বাকি লেনদেন সংশোধন হয়েছে।');
      },
      voidDueEntry: async (dueId: string, reason?: string) => {
        await jomarkhataService.voidDueEntry(dueId, reason);
        await refresh();
        showToast('বাকি লেনদেন বাতিল করা হয়েছে এবং ব্যালেন্স সমন্বয় হয়েছে।', 'info');
      },
      createExpense: async (input: CreateExpenseInput) => {
        const created = await jomarkhataService.createExpense(input);
        await refresh();
        showToast('খরচ সংরক্ষণ হয়েছে।');
        return created;
      },
      editExpense: async (expenseId: string, input: CreateExpenseInput, reason?: string) => {
        await jomarkhataService.editExpense(expenseId, input, reason);
        await refresh();
        showToast('খরচ সংশোধন হয়েছে।');
      },
      voidExpense: async (expenseId: string, reason?: string) => {
        await jomarkhataService.voidExpense(expenseId, reason);
        await refresh();
        showToast('খরচ বাতিল করা হয়েছে এবং ব্যালেন্স ফেরত এসেছে।', 'info');
      },
      createShop: async (input: NewShopInput) => {
        const snap = await jomarkhataService.createShop(input);
        applyStartup({ phase: 'ready', mode: 'real', snapshot: snap });
        showToast(`${snap.businessProfile.shopName}-এর খাতা শুরু হলো।`);
      },
      keepLegacyAsMine: async () => {
        const snap = await jomarkhataService.keepLegacyAsMine();
        applyStartup({ phase: 'ready', mode: 'real', snapshot: snap });
        showToast('এই হিসাব আপনার দোকানের খাতা হিসেবে রাখা হলো।');
      },
      moveLegacyToDemo: async () => {
        await jomarkhataService.moveLegacyToDemo();
        applyStartup({ phase: 'welcome', mode: 'real', snapshot: null });
        showToast('আগের হিসাব ডেমো খাতায় সরানো হয়েছে। এবার আপনার খাতা শুরু করুন।', 'info');
      },
      enterDemo: async () => {
        const snap = await jomarkhataService.enterDemo();
        applyStartup({ phase: 'ready', mode: 'demo', snapshot: snap });
        setActiveRoute('dashboard');
        showToast('ডেমো খাতা খোলা হয়েছে। এখানের কিছুই আপনার আসল খাতায় যাবে না।', 'info');
      },
      exitDemo: async () => {
        const st = await jomarkhataService.exitDemo();
        applyStartup(st);
        setActiveRoute('dashboard');
        setSelectedPartyIdState(null);
      },
      resetDemoData: async () => {
        const fresh = await jomarkhataService.resetDemoData();
        setData(fresh);
        setSelectedPartyIdState(null);
        setActiveRoute('dashboard');
        showToast('ডেমো ডেটা পুনরায় রিসেট করা হয়েছে।', 'info');
      },
      exportBackupJson: async (password?: string) => jomarkhataService.exportBackupJson(password),
      inspectBackup: async (text: string, password?: string) => jomarkhataService.inspectBackup(text, password),
      restoreBackup: async (text: string, password?: string) => {
        const snap = await jomarkhataService.restoreBackup(text, password);
        applyStartup({ phase: 'ready', mode: 'real', snapshot: snap });
        setActiveRoute('dashboard');
        showToast(`ব্যাকআপ থেকে “${snap.businessProfile.shopName}”-এর খাতা ফিরিয়ে আনা হয়েছে।`);
      },
      clearKhata: async () => {
        const snap = await jomarkhataService.clearKhata();
        setData(snap);
        showToast('খাতা খালি করা হয়েছে। আগের হিসাবের একটি কপি এই ফোনে রাখা আছে।', 'info');
      },
      getLastBackupAt: () => jomarkhataService.getLastBackupAt(),
      getSyncStatus: () => jomarkhataService.getSyncStatus(),
      getRecordSyncState: (entityId: string) => jomarkhataService.getRecordSyncState(entityId),
      getSafetyCopy: () => jomarkhataService.getSafetyCopy(),
    }),
    [refresh, showToast, applyStartup]
  );
  const safeActions = useMemo(() => {
    const out: Record<string, unknown> = {};
    // The ref is read inside each returned action (when the owner taps), not during render;
    // the compiler rule can't see that through Object.entries.
    // eslint-disable-next-line react-hooks/refs
    for (const [k, fn] of Object.entries(actions)) {
      out[k] = async (...args: unknown[]) => {
        if (!accessRef.current.canWrite && WRITE_ACTION.test(k)) throw new Error(READ_ONLY_MESSAGE);
        try {
          return await timed(`action ${k}`, () => (fn as (...a: unknown[]) => Promise<unknown>)(...args));
        } catch (err) {
          throw toFriendlyError(err);
        }
      };
    }
    return out as typeof actions;
  }, [actions]);

  const value = useMemo<JomarkhataContextValue>(
    () => ({
      data,
      isLoading,
      phase,
      mode,
      error,
      currentBalances,
      activeRoute,
      selectedPartyId,
      activeSheet,
      toasts,
      navigate,
      setSelectedPartyId,
      openSheet,
      closeSheet,
      forceCloseSheet,
      discardPrompt,
      cancelDiscard,
      goBack,
      showToast,
      dismissToast,
      refresh,
      actions: safeActions,
      storagePersisted,
      auth,
      completeSignIn,
      signOut,
      access,
    }),
    [
      auth,
      completeSignIn,
      signOut,
      access,
      storagePersisted,
      safeActions,
      phase,
      mode,
      forceCloseSheet,
      discardPrompt,
      cancelDiscard,
      goBack,
      setSelectedPartyId,
      data,
      isLoading,
      error,
      currentBalances,
      activeRoute,
      selectedPartyId,
      activeSheet,
      toasts,
      navigate,
      openSheet,
      closeSheet,
      showToast,
      dismissToast,
      refresh,
    ]
  );

  return (
    <JomarkhataContext.Provider value={value}>
      <SheetGuardContext.Provider value={sheetGuard}>{children}</SheetGuardContext.Provider>
    </JomarkhataContext.Provider>
  );
}

export function useJomarkhata() {
  const ctx = useContext(JomarkhataContext);
  if (!ctx) throw new Error('useJomarkhata must be used within JomarkhataProvider');
  return ctx;
}
