# জমারখাতা (Jomarkhata) — Architecture & Developer Documentation

**Tagline:** দোকানের সব হিসাব, এক খাতায়।  
**Target Users:** Ordinary small and medium Bangladeshi retail shopkeepers (generic retail — groceries, general stores, hardware, stationery, daily goods).  
**Primary Language:** Bengali (Bangla) with Bengali digits (`২,৪০০ ৳`).

---

## 1. Repositories

The frontend and backend live in **separate Git repositories**. This repository is the frontend only.

```text
jomarKhata-fe   # This repository: Next.js App Router + TypeScript + Tailwind CSS + Dexie/IndexedDB → Vercel
jomarKhata-be   # Separate repository (future): Node.js + Express.js + TypeScript + MongoDB Atlas + Mongoose + Firebase Auth
```

The product specs and plans are kept outside both repositories as working documentation.

### Target Full Production Stack
- **Frontend (`Jomarkhata FE`)**: Next.js (App Router), React, TypeScript, Tailwind CSS, Dexie (IndexedDB offline-first primary store), hosted on **Vercel**.
- **Backend (`Jomarkhata BE`)**: **Node.js**, **Express.js**, **TypeScript**, **MongoDB Atlas**, **Mongoose** (ODM), and **Firebase Auth**.
- **Subscription & Trial Policy**: Single-tier feature access for all subscribers; six-month configurable trial and subscription enforcement will be built in the backend phase. No Super Admin panel exists inside the shopkeeper UI.

---

## 2. Five Mandatory Accounting Invariants

All financial math and state transitions live exclusively inside `services/financeCalculator.ts` and `services/jomarkhataService.ts` (never inside React UI components):

1. **Single Source of Truth for Money Movements (`moneyMovements`)**:
   - Every actual inflow or outflow across `cash`, `bkash`, `nagad`, and `bank` exists as exactly **one** canonical `MoneyMovement` record.
   - `SaleRecord`, `PurchaseRecord`, `ExpenseRecord`, and money-bearing `DueTransaction` records link to their `moneyMovementId`.
   - Cash-collected totals and channel balances are computed strictly from active `moneyMovements` + opening balances, making double-counting impossible.
2. **Unassigned Credit Prevention**:
   - Any sale or purchase with `dueAmount > 0` strictly requires an existing or newly created `partyId` (enforced in both UI validation and `jomarkhataService`).
   - Fully paid walk-in sales (`dueAmount === 0`) remain effortless 2-tap transactions with zero customer details required.
3. **Honest Profit Calculation**:
   - Missing unit purchase costs (`unitCostSnapshot == null`) are **never** treated as `0 ৳` cost.
   - `computeHonestProfit()` calculates gross/net profit strictly from costed sales only (`costedSalesRevenue - knownCOGS`) and reports explicit completeness (`complete` | `partial` | `unavailable` | `no_sales`) along with the exact count and revenue of uncosted sales.
4. **Strict Separation of Period Flows vs. Current Cumulative Balances**:
   - **Current Cumulative Balances** (`computeCurrentBalances`) always sum `openingBalances` + all active `moneyMovements` (or all active `dueTransactions`) across **all time**.
   - **Period Flows** (`computePeriodFlows`) are strictly scoped to the selected date range (`today` | `week` | `month` | `year` | `all`).
5. **Append-Only Audit Safety (No Silent Hard-Deletes)**:
   - Financial records are never silently deleted. Edits recalculate deltas and running balances atomically; cancellations mark records `status: 'voided'`, reverse linked `moneyMovements`, `dueTransactions`, and `stockMovements`, and append an immutable record to `auditLogs` inside the same Dexie read-write transaction.

---

## 3. Local Offline-First Storage (Dexie + IndexedDB)

There are two databases:
- **`jomarkhata_db`:** the real khata, plus `appMeta` (workspace, mode, last backup, cached subscription).
- **`jomarkhata_demo`:** the demo khata only (AP-2). It's never uploaded.

`getJomarkhataDb()` returns the active one; see `db/jomarkhataDb.ts`.

**Schema v3**, additive only:
- **v1:** the original tables
- **v2:** `appMeta` (AP-3)
- **v3:** outbox v2 indexes `status` and `opId`, with an in-place upgrade of existing items (AP-4)

Dexie's query cache is disabled (`cache: 'disabled'`). The app doesn't use liveQuery, and the cache made bulk writes about 10× slower (S13).

**How data is written and protected:**
- **Every multi-table mutation runs inside one `db.transaction('rw', …)`.** It writes the record, its linked rows, an audit log entry and an outbox item.
- **Every record has a stable UUID `id`,** ISO timestamps and a `revision` counter.
- **Startup is read-only** (`bootstrap()`). It never seeds, writes or deletes.
- **The outbox (`syncQueue`) is append-only.** The sync engine (`lib/sync/engine.ts`) sits behind a `SyncTransport` interface and marks an item synced only when the server acknowledges it. **There's no transport until the backend exists, so nothing is sent.** See `docs/BACKEND_CONTRACT.md`.
- **Backups (`lib/backup.ts`):** v2 with a checksum and optional AES-GCM password. Restore is validated and atomic, and saves a safety copy of the current data first.

---

## 4. Testing & Data-Preservation Guard

- **Commands:** `npm test` (Vitest) and `npm run typecheck`. Tests run in Node against `fake-indexeddb` with the **real** Dexie DB, `jomarkhataService` and `financeCalculator`. Nothing is mocked.
- **Helpers:**
  - `tests/helpers/app.ts`: `bootApp()` is a fresh device; `bootApp(sameFactory)` is the same device after a restart.
  - `tests/helpers/invariants.ts`: the accounting invariants in §2, **including stock = Σ stock movements (always on since AP-9)**.
  - `tests/helpers/shop.ts`: a realistic small shop.
  - `tests/helpers/fixtures.ts`: a **test-only** large khata for performance work.
- **Schema lock (`tests/migration-preservation.test.ts`):** the DB name, version 3, tables and indexes are pinned. It also checks the real v1 → v3 and v2 → v3 upgrades and that records survive restarts.
- **Behaviour tests:** each step has its own file (first-run, dues, forms, history, backup, sync, accounts, navigation, dashboard, landing, pwa, performance).
- **Browser end-to-end checks:** run against the production build (headless Edge at 360px). The results are recorded in `CHANGELOG.md`.

---

## 5. Design System (S1)

- **Tokens** live only in the `@theme` block of `app/globals.css`, and components use them as Tailwind classes (`bg-primary`, `text-ink-muted`, `border-border-strong`, `bg-danger-soft`, …). **No raw hex in components**, enforced by `tests/design-system.test.ts`.
- **The type scale is set through theme variables** (`--text-xs` … `--text-3xl`), mobile-first with a desktop override, so sizes change globally without editing screens.
- **Shared UI components** are in `components/ui/` (`Button`, `Card`, `AmountWithState`, `StatusBadge`, `Banner`, `DateInput`), and the welcome screen is in `components/onboarding/`.
- **Font:** Noto Sans Bengali via `next/font` (CSS variable `--font-noto-sans-bengali`).
- **Packaged controls** follow the shadcn/ui pattern: component code lives in `components/ui/`, built on Radix primitives (`@radix-ui/react-select`, `@radix-ui/react-toggle-group`). They're bundled locally, so there's no runtime CDN and they work offline. Use `SimpleSelect` instead of a native `<select>`, and `SegmentedControl` for any horizontal option bar.
- **Multicolour feature tiles:** `FeatureIcon` with `--color-tile-*` tokens.
- **Specs:** `Instructions/DESIGN_SYSTEM.md` and `UI_GUIDELINES.md` (outside this repo).
