# CODEMAP: read this first

A compact map of the project for anyone (human or tool) starting work. Kept up to date with every step. Details are in [ARCHITECTURE.md](../ARCHITECTURE.md); progress is in [DEVELOPMENT_STATUS.md](../DEVELOPMENT_STATUS.md).

## What it is
- **Product:** জমারখাতা, an offline-first, Bengali-first bookkeeping PWA for small Bangladeshi shops.
- **Stack:** Next.js 16 App Router, React 19, Tailwind 4, Dexie (IndexedDB), Vitest.
- **Frontend only.** There's no backend yet: no login, sync or server. A separate `jomarKhata-be` repo comes later (Express + MongoDB; Firebase for auth only).

## Routes
| URL | File | What |
|---|---|---|
| `/` | `app/page.tsx` → `components/landing/` | Public landing page. Static, never opens the DB. Redirects to `/app` when it runs as an installed app. |
| `/app` | `app/app/layout.tsx` (provider) + `app/app/page.tsx` → `AppShell` | The app. **There is one Next route. Screens are state, not URLs:** `activeRoute` in context, with values `dashboard | sales | purchases | dues | ledger | cash | stock | reports | settings`. |
| `/manifest.webmanifest` | `app/manifest.ts` | The PWA manifest. `start_url /app`, `id /`. |
| `/sw.js` | `public/sw.js` | Offline app shell. **Bump `VERSION` when any file in `/icons` or `/brand` changes.** |

## Navigation (S2)
- **Mobile bottom bar:** হোম · বাকি · [+] · লেনদেন · আরও. "+" opens the `quick_add` sheet and "আরও" opens the `more` sheet (`components/layout/NavSheets.tsx`). Titles and আরও items live in `components/layout/navigation.ts`.
- **Back button:** `navigate`, `setSelectedPartyId` and `openSheet` push history entries; `popstate` in the context restores them. **Always write history through `pushEntry` / `replaceEntry`**, which keep Next's `__NA` key. Without it, Next reloads the page on back.
- **Unsaved-input guard:** `ModalSheet` marks the sheet dirty on input. Use `closeSheet()` (asks first) or `forceCloseSheet()`. A successful action calls `refresh()`, which clears dirty.

## Data flow (the one rule)
**UI → `useJomarkhata()` (`context/JomarkhataContext.tsx`) → `jomarkhataService` (`services/jomarkhataService.ts`) → Dexie (`db/jomarkhataDb.ts`).**
- **UI never writes to Dexie directly.**
- **Each service mutation is one Dexie transaction.** It writes the record, its linked rows (money movement, due transaction, stock movement), an `auditLogs` row and a `syncQueue` row.
- **After each action, the context reloads everything** (`loadAllData`) and shows a toast.
- **Derived numbers** (balances, profit, period flows, ledger) are pure functions in `services/financeCalculator.ts`.
- **`moneyMovements` is the single source of truth for cash, bKash, Nagad and bank balances.** Party balance: positive = পাবো (customer owes us), negative = দিবো (we owe).
- **Voids are soft** (`status: 'voided'`) and reverse every linked row. Nothing financial is hard-deleted.

## Folders
| Path | Contents |
|---|---|
| `components/layout/AppShell.tsx` | Top bar, desktop sidebar, mobile bottom nav, sheet host |
| `components/views/*View.tsx` | One file per screen |
| `components/sheets/*` | Bottom-sheet forms: sale, purchase, due, expense, product, party, details |
| `components/ui/*` | Shared primitives: Button, Card, `select.tsx` (Radix), `segmented.tsx` (Radix ToggleGroup), DateInput, AppIcon, FeatureIcon, ModalSheet, ConfirmDialog… |
| `components/landing/*` | Landing page |
| `components/onboarding/*` | Welcome screen + illustration |
| `lib/format.ts` | Bengali digits, `formatTaka`, dates (`dd/MM/yyyy`), payment-channel labels |
| `types/domain.ts` | All domain types |
| `db/seedData.ts` | Demo data |
| `public/icons/features/*.svg` | The owner's 19 colourful icons. Use `<AppIcon name=…>`; names are typed in `AppIcon.tsx`. |
| `public/brand/` | Logo mark and horizontal logo |
| `tests/` | See "Tests" below |

## Conventions (enforced by tests)
- **Colours:** tokens only (`app/globals.css` `@theme`). No raw hex in components. Use `text-primary-ink` for blue text (never `text-primary`) and `text-on-primary` on blue fills.
- **Controls:** no native `<select>` (use `SimpleSelect`) and no hand-made tab ternaries (use `SegmentedControl`).
- **Text:** minimum size `text-xs` (13px); no `text-[Npx]`.
- **Wording:**
  - Cash = **ক্যাশ**. **নগদ** = the Nagad wallet only.
  - The walk-in label "নগদ ক্রেতা" stays (AP-12 was rejected).
- **Dates:** displayed as `dd/MM/yyyy` in Bengali digits, stored as ISO. Date inputs have a left calendar icon.
- **Honesty:** no fake login, sync, cloud or prices. Anything a backend would do says so plainly.
- **Feature colour families:** green = sale/money-in, blue = purchase, orange = dues, red = expense/money-out, teal = supplier payment, indigo = stock, purple = parties, sky = reports, gold = cash, slate = settings.

## Tests (`npm test`; also `npm run typecheck` and `npx next build`)
| File | Covers |
|---|---|
| `service.*.test.ts`, `financeCalculator.test.ts` | Accounting behaviour and invariants, running the real Dexie on fake-indexeddb |
| `migration-preservation.test.ts` | Schema lock, data survives a restart or upgrade |
| `design-system.test.ts` | Tokens, contrast, conventions above |
| `pwa.test.ts` | Manifest, SW rules, icon/logo assets |
| `landing.test.ts` | Routing split, honest-claims guard |

## Workflow
- Work on the **`dev`** branch; pushes there don't deploy (`vercel.json`).
- Merge to **`main`** only when a phone check is needed; Vercel deploys `main`.
- **One commit per step:** tests + typecheck + build green, then update `CHANGELOG.md`, `DEVELOPMENT_STATUS.md` and this file if the structure changed.
- **Dexie changes are additive versions only** (`version(n).stores(...).upgrade(...)`). Never drop or rewrite user data.
- **Dev gotcha:** if the dev server shows stale styles, stop it, delete `.next/dev` and restart.
