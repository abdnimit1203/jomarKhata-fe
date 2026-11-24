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

## Startup & databases (S3)
- **Two IndexedDB databases:** `jomarkhata_db` (the real khata, plus `appMeta`) and `jomarkhata_demo` (demo only). `db/jomarkhataDb.ts` provides `getJomarkhataDb()`, which returns the active one, plus `getRealDb()`, `getDemoDb()` and `setActiveDbMode()`.
- **Schema is v3** (v1 tables + `appMeta` + outbox indexes). Locked by tests.
- **`jomarkhataService.bootstrap()` is read-only** and returns a phase:
  - `welcome` (no shop) → `WelcomeScreen` → `ShopSetupScreen` → `createShop`
  - `legacy_choice` (an older build's data, no `workspace` meta) → `LegacyChoiceScreen` → `keepLegacyAsMine` or `moveLegacyToDemo`
  - `ready`
- **Demo:** `enterDemo` / `exitDemo`; `resetDemoData` works only in demo mode.

## Sync (S9)
- **Every mutation appends an outbox item** (`syncQueue`, v2 fields: `opId`, `status`, `retryCount`, `lastError`, `baseRevision`, `tenantId`). Voids also queue their linked rows.
- **`lib/sync/engine.ts`** runs a `SyncTransport`. It marks an item synced only on ack, never deletes, and sets conflicts to `needs_review`.
- **`lib/sync/runner.ts`** decides when to run (triggers plus a lock). `getSyncTransport()` returns `null` today, so nothing is ever sent.
- **Backend phase:** implement an HTTP `SyncTransport` (POST the batch; respond per `opId`; treat a repeated `opId` as a no-op) and start the runner after login.

## Data flow (the one rule)
**UI → `useJomarkhata()` (`context/JomarkhataContext.tsx`) → `jomarkhataService` (`services/jomarkhataService.ts`) → Dexie (`db/jomarkhataDb.ts`).**
- **UI never writes to Dexie directly.**
- **Each service mutation is one Dexie transaction.** It writes the record, its linked rows (money movement, due transaction, stock movement), an `auditLogs` row and a `syncQueue` row.
- **After each action, the context refreshes and shows a toast.** The refresh is `loadChanges` (AP-8): it re-reads only the rows written since the last load and merges them in the same order a full read gives. It falls back to `loadAllData` after a range delete or clear, a khata switch, or a first load.
  - `db/changeTracker.ts`: a DBCore middleware that records written keys and never reads anything.
  - `lib/snapshot-merge.ts`: the merge.
  - Tables that a save didn't touch keep the same array.
  - Startup, restore, clear, demo and seed still use `loadAllData`.
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
| `lib/dues.ts` | Due Book helpers: দিচ্ছি/নিচ্ছি × টাকা/বাকি → entryType, search normalisation, WhatsApp number, reminder text |
| `components/ui/PartyPicker.tsx` | Shared searchable party picker with inline add (due, sale and purchase forms) |
| `lib/backup.ts` | Backup file v2 (build/encrypt/parse/validate/integrity). The service does the DB side: `exportBackupJson`, `inspectBackup`, `restoreBackup`, `clearKhata` |
| `lib/errors.ts` | Plain-Bangla storage errors; every context action is wrapped with `toFriendlyError` |
| `lib/format.ts` | Bengali digits, `formatTaka`, dates (`dd/MM/yyyy`), payment-channel labels |
| `types/domain.ts` | All domain types |
| `db/seedData.ts` | Demo data |
| `public/icons/features/*.svg` | The owner's 19 colourful icons. Use `<AppIcon name=…>`; names are typed in `AppIcon.tsx`. |
| `public/brand/` | Logo mark and horizontal logo |
| `tests/` | See "Tests" below |

## Conventions (enforced by tests)
- **Colours:** tokens only (`app/globals.css` `@theme`). No raw hex in components. Use `text-primary-ink` for blue text (never `text-primary`) and `text-on-primary` on blue fills.
- **Controls:** no native `<select>` (use `SimpleSelect`) and no hand-made tab ternaries (use `SegmentedControl`).
- **Wording:** all user-facing domain words come from `lib/terms.ts`, our own wording (পাওনা / দেনা / পাওনা-দেনা / লেনদেন লিখুন). **Never reuse another khata app's labels or layout.** `tests/identity.test.ts` bans them.
- **Balance colours:** পাওনা = green (`text-success`), দেনা = red (`text-danger`).
- **Months:** use `MonthYearPicker` + `lib/months.ts` for any "which month" choice.
- **Help:** WhatsApp support appears only when `NEXT_PUBLIC_SUPPORT_WHATSAPP` is set (`lib/support.ts`).
- **Text:** minimum size `text-xs` (13px); no `text-[Npx]`.
- **Wording:**
  - Cash = **ক্যাশ**. **নগদ** = the Nagad wallet only.
  - The walk-in label "নগদ ক্রেতা" stays (AP-12 was rejected).
- **Dates:** displayed as `dd/MM/yyyy` in Bengali digits, stored as ISO. Date inputs have a left calendar icon.
- **Honesty:** no fake login, sync, cloud or prices. Anything a backend would do says so plainly.
- **Feature colour families:** green = sale/money-in, blue = purchase, orange = dues, red = expense/money-out, teal = supplier payment, indigo = stock, purple = parties, sky = reports, gold = cash, slate = settings.

- **Login:** `lib/auth-firebase.ts` (Firebase via dynamic import → `POST /auth/session` on jomarKhata-be) and `lib/api.ts`. The session is cached in `appMeta.session` (`jomarkhataService.getSession/saveSession`). Context exposes `auth`, `completeSignIn` and `signOut`. Guest / test mode = `auth.status === 'local'`. Backend: `../jomarKhata-be` (README there).
- **Lock:** `AppShell` shows ONLY `AuthScreen` when there is no session and no guest choice (`guestMode`, `appMeta.guestMode`; cleared by `signOut`). **Greeting:** `lib/greeting.ts` (per-phone choice).
- **Admin:** `app/admin/login` + `app/admin/(panel)/{dashboard,payments,orders,users,users/[accountId],settings}` (layout = `AdminShell` sidebar) + `components/admin/*` (online-only, SW-excluded, noindex). Calls the backend with `currentIdToken()`. `/admin` itself is a 404. Never import admin code from `/app`.
- **First screens:** `WelcomeScreen` (one button → `AuthScreen`; banner `/brand/welcome-banner.webp`, precached in `public/sw.js`). `AuthScreen.onTryWithoutLogin` is TEMPORARY: it shows only while `provider.available` is false.
- **First-run guide:** `components/onboarding/FirstRunGuide.tsx`. A step = a row in `STEPS` + a `data-guide="<id>"` on the element. Replay with `replayGuide()`.
- **Version:** bump `package.json` "version" for every phone release (`lib/version.ts` reads it; shown in Settings, used on tutorial videos).
- **Future (not built): tutorial "দেখুন" links.** Plan: one registry `lib/tutorials.ts` (`{ feature: 'sale' | 'dues' | …, url, version }`) and one `<TutorialLink feature="…" />` that renders nothing offline or when no URL is set. Feature screens only add that one tag.
- **Referral / user ID:** `components/settings/AccountSection.tsx` (profile) and `lib/referral.ts`. The values always come from the server (`AuthUser.referralCode`, `referralStats`), never from the app. Sign-up sends an optional `referralCode`. Contract: BACKEND_CONTRACT §8.
- **Date filters:** any list filtered by date uses `usePeriodFilter` + `<PeriodFilter>` (`components/ui/PeriodFilter.tsx`), which includes any month + year. Don't add a new period selector.

## Tests (`npm test`; also `npm run typecheck` and `npx next build`)
- On Windows, use `npm test`, not bare `npx vitest`. `scripts/test.mjs` fixes the drive-letter case that breaks Vitest 5.
| File | Covers |
|---|---|
| `service.*.test.ts`, `financeCalculator.test.ts` | Accounting behaviour and invariants, running the real Dexie on fake-indexeddb |
| `migration-preservation.test.ts` | Schema lock, data survives a restart or upgrade |
| `design-system.test.ts` | Tokens, contrast, conventions above |
| `pwa.test.ts` | Manifest, SW rules, icon/logo assets |
| `landing.test.ts` | Routing split, honest-claims guard |

## Accounts & access (S10)
- **`lib/auth.ts`:** the `AuthProvider` interface. Today it's `noBackendAuthProvider` (refuses honestly). The context's `auth` is always `local`.
- **`lib/access-policy.ts`:** `decideAccess(cachedSub)` gives full / grace / read_only. Context actions that change records throw `READ_ONLY_MESSAGE` when read-only.
- **`/preview`** (development only) shows the OTP, logout-guard and claim-flow designs.
- **[docs/BACKEND_CONTRACT.md](BACKEND_CONTRACT.md)** is everything the backend must implement.

## Performance (S13)
- **Long lists use `usePaged` + `<ShowMore>`** (100 rows per page). **Keep this for any new long list.**
- **Dexie is opened with `cache: 'disabled'`.** Don't re-enable it without measuring restore time.
- **Timing log:** set `localStorage.jk_perf = '1'` in the browser console.
- **AP-8 is done.** What's left on 20k-sale khatas is React recompute (≈380 ms per save at 4× throttle).
- **Large-data tests** use `tests/helpers/fixtures.ts` (test-only).
- **Owner checklists:** [REAL_DEVICE_TEST.md](REAL_DEVICE_TEST.md) and [MVP_ACCEPTANCE.md](MVP_ACCEPTANCE.md).

## Workflow
- Work on the **`dev`** branch; pushes there don't deploy (`vercel.json`).
- Merge to **`main`** only when a phone check is needed; Vercel deploys `main`.
- **One commit per step:** tests + typecheck + build green, then update `CHANGELOG.md`, `DEVELOPMENT_STATUS.md` and this file if the structure changed.
- **Dexie changes are additive versions only** (`version(n).stores(...).upgrade(...)`). Never drop or rewrite user data.
- **Dev gotcha:** if the dev server shows stale styles, stop it, delete `.next/dev` and restart.
