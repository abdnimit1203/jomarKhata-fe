# MVP acceptance report (frontend)

**Date:** 2026-11-23 · **Branch:** `dev` · **Tests:** 211 passing (`npm test`), `tsc` clean, production build OK.

**Scope:** the frontend MVP from `Instructions/FRONTEND_IMPROVEMENT_PLAN.md` (L1, S0–S13).

**Status:**
- **Done:** every step except the owner's real-phone check.
- **Needs the owner:** the real-phone check ([REAL_DEVICE_TEST.md](REAL_DEVICE_TEST.md)) and the decisions in §5.

## 1. Feature status

| Feature | Class | Status |
|---|---|---|
| Landing page at `/`, app at `/app` | LOCAL | ✅ L1 |
| Bottom bar, "+", "আরও", back button, unsaved-form guard | LOCAL | ✅ S2 |
| First run: empty khata, separate demo DB, legacy-data choice | LOCAL | ✅ S3 |
| Dashboard above the fold | LOCAL | ✅ S4 |
| Due Book: search, party ledger, তাগাদা (WhatsApp/SMS), দিচ্ছি/নিচ্ছি form | LOCAL | ✅ S5 |
| Sale, purchase and expense forms: dates, discount, typed quantity, over-stock warning | LOCAL | ✅ S6 + AP-9 |
| Change history before → after, edit reason | LOCAL | ✅ S7 |
| Backup v2 (checksum, password), validated atomic restore, clear khata | LOCAL | ✅ S8 |
| Outbox v2, sync engine (fake transport only), sync status, record badge | LOCAL status / BE-LATER sending | ✅ S9 |
| Sign-in screens (honest, no session), access policy, backend contract | UI-NOW / BE-LATER | ✅ S10 |
| Installable PWA, offline shell, update prompt, install card | LOCAL | ✅ S12 (browser-verified; phone check pending) |
| Large data and performance | LOCAL | ✅ S13 (§3) |
| Real login, cloud sync, server subscription, super admin | BACKEND | Not in the frontend MVP. See [BACKEND_CONTRACT.md](BACKEND_CONTRACT.md) |

## 2. Approved logic and DB changes (D32–D34)

| Item | Change |
|---|---|
| AP-1/2/3 | No auto-seed; demo in its own DB; `appMeta` (Dexie v2) |
| AP-4 | Outbox v2 (Dexie v3, in-place upgrade); voids queue their linked rows |
| AP-6 | Optional edit reason |
| AP-9 | Oversell allowed with a warning; stock = Σ movements |
| AP-10/11 | Restore, clear khata, backup v2 |

**Every migration is additive and every existing record is kept.** Each is proven by tests.

## 3. Performance (plan 8.3)

Measured on the production build in headless Edge at 360px **with 4× CPU throttling**.

| Metric | Budget | Typical shop (2,000 sales, 500 parties) | Very large (20,000 sales, 5,000 parties, 2,003-row ledger) |
|---|---|---|---|
| App open → usable | ≤ 3 s | **0.76 s** ✅ | **1.9 s** ✅ |
| Save a sale and see it | ≤ 300 ms | **302 ms** ✅ (at the limit) | 1.42 s ❌ |
| Party search while typing | ≤ 100 ms | **38 ms** ✅ | **44 ms** ✅ |
| Open a 2,000-row party ledger | smooth | 181 ms ✅ | **190 ms** ✅ |
| Restore from a backup file | — | 0.8 s | 8.5 s (was 88 s before the fix) |
| JS shipped | report | landing 175 KB gzip; app 349 KB gzip (cached offline after the first visit) | |

**Fixes made because of these measurements:**
- **Lists render 100 rows at a time** with "আরও দেখুন" (party list, party ledger, ledger, sales, purchases, expenses, stock). Search went from 337 → 44 ms and the big ledger from 2.4 s → 0.19 s.
- **Dexie's query cache is off.** Restore went from 88 s → 8.5 s, and the app doesn't use the cache.

**Still over budget:** saving on a very large khata, because every save reloads all data (`loadAllData` ≈ 1 s at 20k sales with 4× throttling). The fix is **AP-8 (incremental loading)**, a data-layer change that needs owner approval. It only matters for very large khatas (roughly 10,000+ transactions), not for launch.

## 4. Known limitations (honest)
- **Data lives only on the phone** until the backend exists. Recovery after losing the phone is only possible from a backup file.
- **The local data isn't encrypted** (D5); a password-protected backup is available.
- **Document numbers** (`INV-1001`) can collide across devices once multi-device sync exists. This is AP-5, deferred to the backend phase.
- **Products that the old code clamped at 0 keep their stored stock.** New activity is exact (AP-9).
- **Real-phone behaviour** (install, cold offline start, iOS) is not yet verified on a physical device.

## 5. Decisions waiting for the owner
1. **AP-8** incremental loading, for very large khatas. Recommended later, not needed for launch.
2. **npm audit:**
   - remove the unused `firebase-tools` dev dependency
   - upgrade `vitest` 3 → 5 (dev only; production has 0 vulnerabilities)
3. **Name check:** "জমারখাতা / Jomarkhata" is close to "JomaKhata" (an Indian product). Run a trademark check before a public launch.
4. **Landing page content:** WhatsApp support number, privacy and terms text, pricing wording.
5. **Login testing approach** before the backend exists (D26): a dev-only test mode, or Firebase in the frontend.

## 6. Owner sign-off
- [ ] Real-phone checklist passed ([REAL_DEVICE_TEST.md](REAL_DEVICE_TEST.md))
- [ ] Decisions in §5 made
- [ ] Merge `dev` → `main` for the production deployment
