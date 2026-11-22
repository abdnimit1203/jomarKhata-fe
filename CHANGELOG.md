# Changelog

All notable changes to the Jomarkhata frontend. Steps refer to the approved frontend plan (S0–S13).

## [Unreleased]

### S0 — Safety net (tests only, no app behaviour change) — 2026-11-22
**Added**
- Vitest and fake-indexeddb (dev dependencies). Scripts: `npm test` (`vitest run`) and `npm run typecheck` (`tsc --noEmit`).
- `tests/helpers/app.ts`: boots the real Dexie DB, service and calculator on an isolated in-memory IndexedDB. A same-storage reboot simulates an app restart, reload or PWA relaunch.
- `tests/helpers/invariants.ts`: cross-table accounting invariant checker.
- **49 tests in 4 files:**
  - `financeCalculator.test.ts` (11): period bounds, all-time balances, period flows, honest profit, running balances.
  - `service.sales-purchases.test.ts` (14): sale and purchase create/edit/void, credit guard atomicity, stock, invoice numbering.
  - `service.dues-expenses.test.ts` (11): parties and opening dues, all four due entry types, edit/void, the sale-sourced-due guard, expenses.
  - `migration-preservation.test.ts` (13): schema lock (DB name, version, tables, indexes); every record (customers, suppliers, sales, purchases, dues, money, stock, audit, outbox) is identical after restarts; data written by an older build opens unchanged; additive v2 migration harness; backup completeness.
- Characterisation tests that document current behaviour flagged in the plan (not fixed): AP-9 stock clamp, demo auto-seed and `resetDemoData` wiping user data, the backup omitting outbox items, and voids not queueing child outbox ops (AP-4).

### Repository setup — 2026-11-22
**Changed**
- This folder is now its own git repository (the backend will be a separate repository).
- `.gitignore`: secrets, build output and all AI-tool / coding-agent artifacts are ignored.
- `next.config.ts`: removed the tool-specific webpack HMR block and the unused remote-image allowance; disabled `AGENTS.md` auto-generation.
- `package.json`: renamed to `jomarkhata-fe`; removed the unused `@google/genai` dependency.
- `README.md` and `.env.example` rewritten for this project.

### Pre-plan fixes — 2026-11-22
- Dev server startup on Next 16 (`turbopack: {}`) and LAN phone access (`allowedDevOrigins`).
- Dev-only font switcher (`components/FontSwitcher.tsx`), to be removed in S1 (font decision: Hind Siliguri).
