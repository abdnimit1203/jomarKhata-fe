# Development Status — Jomarkhata Frontend

_Last updated: 2026-11-23 (after the S1 revision: amber main colour)_

## Step tracker (approved plan, one step at a time with owner approval)

| Step | Name | Status |
|---|---|---|
| S0 | Safety net (tests) | ✅ Accepted by owner |
| S1 | Design system foundation (colours, type, font, shared components, welcome screen design, ক্যাশ/নগদ wording) + revisions D22/D23 (amber) → **D24 blue redesign** (reference style, multicolour tiles, Radix Select/ToggleGroup) | ✅ Done, awaiting owner review |
| S2 | App shell & navigation | ✅ Done: bottom bar with + and আরও, top bar back/title/online pill, Android back integration, unsaved-form guard |
| S3 | First run, local mode, business profile (+ wiring the welcome screen) | ✅ Done: welcome → shop setup (empty khata), separate demo DB, legacy choice (D15), Dexie v2 appMeta (AP-1/2/3) |
| S4 | Dashboard & cash summary | ✅ Done: compact hero with পাবো/দিবো, বেচা/কেনা above the fold at 360×640 (measured), duplicate grid removed |
| S5 | Customers, suppliers & Due Book | ✅ Done: due list/search/filter, party detail with call + তাগাদা (WhatsApp/SMS/copy), role-aware form with preview + date, shared PartyPicker |
| S6 | Sales, purchases, expenses | ✅ Done: date on all forms, discount on paid sales, typed qty/price, over-stock warning |
| S7 | Corrections & history | ✅ Done: before → after history, optional edit reason (AP-6), plain wording, void error toast, return to detail after edit |
| S8 | Backup, restore & data safety | ✅ Done: backup v2 (checksum, optional password), validated atomic restore with safety copy, v1 compatible, guarded clear, reminder, storage.persist, friendly quota errors (AP-10/11) |
| S9 | Sync queue & connection status | ✅ Done: outbox v2 (Dexie v3, in-place upgrade), linked void ops, sync engine + runner behind a transport (fake only), সিঙ্ক অবস্থা sheet, per-record badge (AP-4) |
| S10 | Account interfaces & access policy | ✅ Done: sign-in screen (honest, no session), AuthProvider interface, access policy (grace → read-only, clock-safe), dev-only /preview designs, docs/BACKEND_CONTRACT.md |
| S11 | ~~Optional PIN lock~~ | ❌ Removed by owner decision |
| S12 | Android PWA | ✅ Done in code: manifest, offline shell (v4), update prompt (waits for owner), install card (Android prompt / iOS steps). Real-phone check is in the S13 checklist |
| S13 | Performance, real-device testing, MVP acceptance | ✅ Done: large-data fixtures, measured budgets (typical shop within budget), paging + Dexie cache fix, real-device checklist, MVP acceptance report. Pending: owner's real-phone run, AP-8 decision |

## What works today
- **Fully local bookkeeping in IndexedDB:** sales, purchases, customers and suppliers, due collection and payment, expenses, stock, reports, edit/void with audit history, and JSON backup export.
- **New visual system:** ivory canvas, **Royal Blue theme with a gradient top bar, multicolour feature tiles, and packaged (Radix) dropdowns and chip bars**, larger and bolder type, outlined cards, Noto Sans Bengali.
- **Welcome screen designed;** viewable only as a dev preview at `/?preview=welcome`.
- **No backend, login or cloud sync.** The sync outbox is recorded locally and never sent.

## Quality gates
| Check | Command | S0 | S1 |
|---|---|---|---|
| Tests | `npm test` | 49 / 49 | **225 / 225** (22 files) |
| TypeScript | `npm run typecheck` | 0 errors | **0 errors** |
| Production build | `npm run build` | — | **✓ compiled, 3/3 static pages** |
| Mobile render check (360px, Edge via puppeteer) | manual | — | Welcome and Dashboard render with **0px horizontal overflow** |

## ⚠ Business-critical: release blocker
| Issue | Rule |
|---|---|
| ~~**AP-9: overselling corrupts stock.**~~ | ✅ **Fixed 2026-11-23 (D33):** no clamp, oversell allowed with a warning, `stockQty` always equals Σ movements (always-on test invariant). Release blocker cleared. |

## Other known issues (documented by tests, not yet fixed)
| Issue | Plan item |
|---|---|
| A fresh install auto-seeds demo data; "Reset demo" also deletes user-entered records | S3 (AP-1/AP-2), S8 |
| The JSON backup does not include sync outbox items | S8 |
| Edits and voids queue only the parent record, not the changed money movement, due, stock or running-balance rows | S9 (AP-4) |
| Invoice/bill numbers use `count + 1001` (will collide across devices) | AP-5 (backend phase) |

## Dependency audit review (2026-11-22, read-only; nothing upgraded)
`npm audit`: 23 advisories (3 critical, 8 high, 12 moderate). **`npm audit --omit=dev`: 0.** Nothing that ships to users is affected.

| Severity | Package (path) | Advisory (summary) | Real exposure | Recommendation (needs owner approval) |
|---|---|---|---|---|
| **critical** | `tar` ← `firebase-tools` (devDependency) | Path traversal / arbitrary file overwrite when extracting crafted archives | Only if the Firebase CLI extracts an attacker's archive. **The CLI isn't used**: there's no `firebase.json`, deployment is Vercel, and it's a leftover of the original generator. | **Remove `firebase-tools`** (not upgrade). This also clears all 8 high advisories and most moderates (`superstatic`, `router`, `path-to-regexp`, `proxy-agent`/`basic-ftp`, `google-gax`, …). Firebase *client* SDKs for auth are a separate, future backend-phase decision. |
| **critical** | `vitest` (devDependency, added in S0) | Path traversal via `@vitest/mocker` redirect mocks | Local test runner only; we don't use mock redirects | **Upgrade vitest 3 → 5** as its own small change, verified by the full test suite. It's a major version, so it's not done blindly. |
| **critical** | `tinypool` ← `vitest` | Prototype-pollution gadget in worker options | Needs attacker-controlled worker options; local test runs only | Fixed by the same vitest upgrade |

## Not tested yet
- No component or E2E tests. The UI is checked with headless 360px screenshots and the static design-system tests.
- Real Android devices and browsers. S0/S1 tests run in Node with fake-indexeddb; real-device checks are in S12/S13.
- The `DateInput` native-picker opening (`showPicker`) on real Android Chrome. It was verified to compile and display only.
