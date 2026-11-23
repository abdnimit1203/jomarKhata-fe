# জমারখাতা (Jomarkhata) — Frontend

**দোকানের সব হিসাব, এক খাতায়।**

A mobile-first, offline-first bookkeeping app for small and medium retail shops in Bangladesh. The UI is in Bengali, and it installs on a phone as an app (PWA).

> **Status:** early development, **local mode only**. All data stays on the device. There's no login, backend or cloud sync yet; they come in later phases from a separate backend repository. Don't use it with real customer data yet.

## Features (working today, offline)

| Area | What you can do |
|---|---|
| **Dashboard** | Cash in hand, bKash / Nagad / bank balances, total receivable (পাবো) and payable (দিবো), today/month summary, quick actions, recent transactions, a hide-balance toggle |
| **বেচা (sales)** | Quick sale (amount only) or a product sale with stock deduction; cash, digital or credit (বাকি); edit and void with reason |
| **কেনা (purchases)** | Purchase from suppliers with stock increase; paid or on credit; edit and void |
| **বাকি (dues)** | Customer and supplier ledgers, collect dues, pay suppliers, due reminder date, per-party history |
| **খরচ (expenses)** | Expenses by category and payment channel; edit and void |
| **ক্যাশ বক্স** | Money in/out per channel: ক্যাশ · বিকাশ · নগদ · ব্যাংক |
| **স্টক** | Products, stock quantity, manual stock adjustment with history |
| **লেনদেন** | One unified ledger of every transaction with detail view |
| **রিপোর্ট** | Profit and loss, last 7 days sales vs expenses, expense categories, current balances |
| **সেটিংস** | Shop profile, opening balances, JSON backup export, demo data reset |
| **Installable app** | Installs from Chrome ("Install app"), opens and works with **no internet** after the first visit |

Dates are shown as `dd/MM/yyyy` with Bengali digits. Money is shown in Taka (৳).

**Not built yet:** login (Firebase), cloud backup/sync, multi-device, subscription, landing page. See [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).

## Stack
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4 with design tokens; Radix UI (shadcn pattern) for selects and toggle bars
- Dexie 4 on IndexedDB (local-first storage)
- A service worker for the offline app shell
- Vitest + fake-indexeddb for tests

## Codebase at a glance
```
app/              layout, page, PWA manifest, global theme tokens (globals.css)
components/
  layout/         AppShell: top bar, sidebar, bottom navigation
  views/          one screen per tab (Dashboard, Sales, Dues, Stock, Reports…)
  sheets/         bottom-sheet forms (sale, purchase, due, expense, details)
  ui/             shared building blocks (Button, Card, Select, AppIcon…)
  onboarding/     welcome screen (shown before login, later)
  pwa/            service-worker registration
context/          JomarkhataContext: app state + actions for the UI
services/
  jomarkhataService.ts   all reads/writes to IndexedDB (one transaction per action)
  financeCalculator.ts   balance, profit and due calculations (pure functions)
lib/              formatting (Bengali numbers, Taka, dates)
public/           service worker, app icons, brand logo, feature icons
tests/            accounting, data-preservation, design-system and PWA tests
```
Rule of thumb: **UI never writes to the database directly.** Screens call the context, the context calls `jomarkhataService`, and every change also writes an audit log and a sync-queue entry (for the future backend). Deeper detail is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Security and data notes
- **Data lives only on this device** (browser IndexedDB). It isn't encrypted, so anyone who can open the phone and the app can see it. Clearing browser data or uninstalling removes it. Use **সেটিংস → backup** to keep a copy.
- **Backup files contain all shop data.** Treat them as private and don't share them.
- **No accounts or passwords exist yet.** Nothing claims you're "logged in", and nothing is sent to a server.
- **The service worker caches only the app's own files** (pages, scripts, icons). It never reads or caches business data, and it ignores other websites and non-GET requests.
- **No secrets are in this repository.** No environment variables are needed today. `.env*` files and AI-tool/editor folders are git-ignored.
- **Preview deployments must use demo data only**, never real customer records.
- **Known issue (release blocker):** selling more than the available stock isn't blocked yet (AP-9). It must be fixed before real shops use sales.

To report a security problem, contact the maintainer privately; please don't open a public issue.

## Run locally
**Prerequisite:** Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
```

To open it on a phone on the same Wi-Fi, use the "Network" URL that `npm run dev` prints. Add that IP to `allowedDevOrigins` in `next.config.ts` if it differs.

The offline/install features only run in a production build:
```bash
npm run build && npm start
```

## Checks
```bash
npm test           # Vitest: accounting, data-preservation, design-system and PWA tests
npm run typecheck  # TypeScript (tsc --noEmit)
```

## Branches and deploys
- **`dev`**: day-to-day work. Pushes here **don't** deploy (see `vercel.json`).
- **`main`**: merge `dev` into `main` only when a phone check or release is needed. Every push to `main` deploys to Vercel.
