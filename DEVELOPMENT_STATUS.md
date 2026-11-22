# Development Status — Jomarkhata Frontend

_Last updated: 2026-11-22 (after S0)_

## Step tracker (approved plan, one step at a time with owner approval)

| Step | Name | Status |
|---|---|---|
| S0 | Safety net (tests) | ✅ Done, awaiting owner review |
| S1 | Design system foundation + ক্যাশ/নগদ terminology | ⏸ Not started (needs approval) |
| S2 | App shell & navigation | ⏸ |
| S3 | First run, local mode, business profile | ⏸ |
| S4 | Dashboard & cash summary | ⏸ |
| S5 | Customers, suppliers & Due Book | ⏸ |
| S6 | Sales, purchases, expenses | ⏸ |
| S7 | Corrections & history | ⏸ |
| S8 | Backup, restore & data safety | ⏸ |
| S9 | Sync queue & connection status | ⏸ |
| S10 | Account interfaces & access policy | ⏸ |
| S11 | ~~Optional PIN lock~~ | ❌ Removed by owner decision |
| S12 | Android PWA | ⏸ |
| S13 | Performance, real-device testing, MVP acceptance | ⏸ |

## What works today
- **Fully local bookkeeping in IndexedDB:** sales, purchases, customers and suppliers, due collection and payment, expenses, stock, reports, edit/void with audit history, and JSON backup export.
- **No backend, login or cloud sync.** The sync outbox is recorded locally and never sent.

## Quality gates
| Check | Command | Result (S0) |
|---|---|---|
| Unit / integration tests | `npm test` | 49 / 49 passed (4 files) |
| TypeScript | `npm run typecheck` | 0 errors |
| Mutation check of the test suite | manual | 3 / 3 deliberate breakages were detected (void not reversing money, an unmigrated schema change, startup re-seeding over existing data) |

## Known issues (documented by tests, not yet fixed)
| Issue | Plan item |
|---|---|
| Overselling clamps `stockQty` at 0 but the stock movement keeps the full −qty, so they diverge | AP-9 (owner decision pending) |
| A fresh install auto-seeds demo data; "Reset demo" also deletes user-entered records | S3 (AP-1/AP-2), S8 |
| The JSON backup does not include sync outbox items | S8 |
| Edits and voids queue only the parent record, not the changed money movement, due, stock or running-balance rows | S9 (AP-4) |
| Invoice/bill numbers use `count + 1001` (will collide across devices) | AP-5 (backend phase) |
| `npm audit` reports 23 advisories (12 moderate, 8 high, 3 critical) in existing dependencies, mainly in the dev-only toolchain | to review separately; not changed in S0 |

## Not tested yet
- UI components (no component or E2E tests yet). Each UI step adds manual 360px and desktop checks.
- Real browsers and devices. S0 tests use fake-indexeddb in Node, not Chrome/Android IndexedDB; real-device checks are in S12/S13.
