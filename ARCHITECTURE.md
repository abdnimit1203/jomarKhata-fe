# জমারখাতা (Jomarkhata) — Architecture & Developer Documentation

**Tagline:** দোকানের সব হিসাব, এক খাতায়।  
**Target Users:** Ordinary small and medium Bangladeshi retail shopkeepers (generic retail — groceries, general stores, hardware, stationery, daily goods).  
**Primary Language:** Bengali (Bangla) with Bengali digits (`২,৪০০ ৳`).

---

## 1. Flexible Sibling-Folder Deployment Architecture

This frontend repository is intentionally kept standalone and export-ready so the full production workspace can live in clean sibling folders without forcing an `apps/web` monorepo wrapper:

```text
Workspace Root/
├── Jomarkhata FE/        # This repository (Next.js App Router + TypeScript + Tailwind CSS + Dexie/IndexedDB) → Vercel
├── Jomarkhata BE/        # Future backend (Node.js + Express.js + TypeScript + MongoDB Atlas + Mongoose + Firebase Auth)
└── Instructions/         # Shared product specs, accounting contracts, and operational notes
```

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

- Database name: `jomarkhata_db` (`db/jomarkhataDb.ts`), schema `version(1)` with upgrade hook readiness for `version(2+)`.
- All multi-table mutations execute inside real `db.transaction('rw', [...], async () => { ... })` blocks.
- Every record uses a stable UUID `id` (`crypto.randomUUID()`), ISO timestamps (`createdAt`, `updatedAt`), and `revision` counter.
- A local `syncQueue` outbox records pending `upsert` / `void` mutations so future synchronization with `Jomarkhata BE` (Express + Mongoose) can plug in cleanly without changing UI components. In Phase 1, all storage is strictly local to the browser (no mock cloud sync or fake authentication).
