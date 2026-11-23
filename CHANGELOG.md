# Changelog

All notable changes to the Jomarkhata frontend. Steps refer to the approved frontend plan (S0–S13).

## [Unreleased]

### S7: corrections & history, 2026-11-23
AP-6 approved under D32.

**Added / changed**
- **পরিবর্তনের ইতিহাস** (previously "অডিট ইতিহাস"):
  - every entry carries an action badge (তৈরি / সংশোধন / বাতিল)
  - **edits show before → after for each changed field**: মোট, টাকা, ছাড়, জমা, বাকি, পণ্য, মাধ্যম, তারিখ, পার্টি, খাত, বিবরণ, নোট
  - the diff comes from the stored snapshots via `lib/audit-diff.ts`, a pure function; broken snapshots show nothing rather than crash
- **AP-6: optional edit reason.**
  - `editSale`, `editPurchase`, `editDueEntry` and `editExpense` take an optional `reason`, stored trimmed on the audit entry. Without one it stays `null`, as before.
  - All 4 edit forms have "সংশোধনের কারণ (ঐচ্ছিক)".
- **Plain wording:** "বাতিল (Void)" → "বাতিল করুন". The void dialog now says the entry isn't deleted and stays in the history marked বাতিল. The ledger hint and settings copy are updated too.
- **A failed void shows an error toast** and keeps the dialog open; it never fails silently.
- **After an edit you return to the detail sheet:** edit sheets carry `returnTo`, and `closeSheet` goes back to it within the same history entry.
- `tests/history.test.ts` (9).

**Verified e2e:** sale ৳500 → detail → edit to ৳650 with a reason → saved → back on the detail, and the history shows সংশোধন, the reason and ৫০০ → ৬৫০.

### AP-9 fixed: no stock clamp, oversell allowed with a warning (D33), 2026-11-23
**Release blocker D20 cleared.**

**What was wrong**
- Four service paths clamped `stockQty` at 0 while the stock movement recorded the full quantity, so product stock and its history disagreed:
  - create sale
  - edit sale
  - edit purchase
  - void purchase
- Reproduced in the browser: selling 999 against stock 18 left stock at **0** instead of **−981**.

**Fix (owner policy D33)**
- Those 4 clamps are removed. Stock may go negative, and **`stockQty` always equals the sum of its stock movements.**
- The sale form already warns before saving (S6). The stock screen shows negative stock in red: **"স্টক মাইনাস — কেনা লিখুন"**.
- Unchanged:
  - **opening stock** at product creation is still ≥ 0 (input validation)
  - **manual stock adjustment** still floors at 0 but records the actual applied delta, so it stays consistent

**Tests**
- The characterisation test was replaced with 3 tests:
  - oversell gives −3 with the movements matching
  - a later purchase restores stock correctly
  - a mixed sequence of sale edit, purchase, purchase void and sale void passes through negative stock and stays consistent
- **The stock invariant in `assertLedgerInvariants` is now always on**, so every accounting test checks `stockQty == Σ movements`.
- 154/154 tests pass.

**Existing data:** products already clamped by the old code keep their stored value; nothing is rewritten. New activity is exact from now on.

### S6: sale, purchase and expense forms, 2026-11-23
**Added / changed**
- **A date field on every entry form** (sale, purchase, expense, due), shown as `dd/MM/yyyy` with the left calendar icon.
  - Defaults to today. Backdated entries keep their day.
  - Editing without changing the day keeps the original timestamp (`dateInputToIso` in `lib/format.ts`).
- **Sale:**
  - **discount is available on fully paid sales too**, with a "মোট − ছাড় = …" line
  - partial payment shows "বাকি থাকবে ৳X"
  - **product mode lets you type the quantity (decimals like 2.5 kg) and edit the unit price** per chosen item
  - **a non-blocking over-stock warning** (D33)
- **Purchase:** typed quantity and editable purchase price in product mode, plus the date. There's no discount, because the purchase service has none; a service change wasn't wanted for it.
- `tests/forms.test.ts` (9): date helper, form wiring, discount on a paid sale (real service: no due, cash = total), backdated sale/purchase/expense counted on their day, decimal quantity.

**Verified e2e:** a product sale of 999 against stock 18 shows the warning and still saves; discount works on a paid sale; the date field is present.
- **This also reproduced AP-9 in the browser:** stock went 18 → **0** instead of −981. Fixed in the next commit.

### S5: simpler Due Book, role-aware due form, searchable party picker, 2026-11-23
**Added / changed**
- **Due list:**
  - compact পাবো/দিবো summary, with **search right below it** (name or mobile, Bengali digits OK)
  - one row with the role tabs, a filter icon (শুধু বাকি আছে + sort) and a new-party button
  - a sticky **"নতুন বাকি"** button above the bottom bar
- **Party detail:**
  - name, role, mobile, and a big balance that always says **পাবো / দিবো**
  - **কল করুন**, plus **তাগাদা পাঠান** with WhatsApp (`wa.me`, Bangladeshi number normalised), SMS (`sms:` with prefilled body) and copy as a fallback. The result message is honest: "WhatsApp খোলা হয়েছে — বার্তা পাঠানো হলো কিনা সেখানে দেখে নিন".
  - payment-date row
  - readable ledger rows: দিয়েছি/নিয়েছি amount, and a running balance that carries the word
  - sticky **দিচ্ছি / নিচ্ছি** buttons
- **Role-aware due form:**
  - From a party screen there's no picker; দিচ্ছি or নিচ্ছি is preset.
  - **"টাকা দিয়ে / শুধু বাকিতে"** toggle, with a role-based default.
  - A plain-Bangla explanation line, a **"এরপর: পাবো ৳X" preview**, and a **date field** for backdated entries.
  - **These map to the same 4 service entry types (`lib/dues.ts`). No service change.**
- **`PartyPicker`** (shared) replaces the dropdowns in the due, sale and purchase forms.
  - Search by name or mobile; shows at most 30 rows (fast with thousands of parties).
  - Add a new party inline; "নগদ ক্রেতা / নগদ সরবরাহকারী" is the empty choice where allowed.
  - The old inline-create code in the sale/purchase forms was removed.
- `lib/dues.ts`: pure helpers (mapping, search normalisation, WhatsApp number, reminder text).
- `tests/dues.test.ts` (8):
  - all 4 mappings, both ways
  - **the real service confirms the direction of the balance and cash change for each combination**
  - backdated date
  - search, including **5,000 parties in under 100 ms**
  - labels, WhatsApp number, reminder text

**Verified e2e** (360px):
- search narrows the list
- party detail → তাগাদা panel with a valid `wa.me` link
- নিচ্ছি: no picker, explanation, preview; saved, পাবো ২,৪০০ → ২,৩০০
- back → list
- নতুন বাকি → search the picker → choose → choices shown
- no page reload

### S4: Dashboard above the fold, 2026-11-23
**Changed**
- **New mobile order (plan 3.1):**
  1. Compact hero: হাতে ক্যাশ with a বিকাশ · নগদ · ব্যাংক line, then a **পাবো / দিবো** row (taps open the বাকির খাতা).
  2. **বেচা / কেনা** big buttons.
  3. 4 quick actions (বাকি আদায়, খরচ, পরিশোধ, স্টক).
  4. আজ/মাস 2×2 summary.
  5. খাতা (the 4 book tiles).
  6. Recent transactions.
- **Desktop:** two columns (actions + summary on the left, recent transactions on the right).
- **Removed the duplicate "আপনার ব্যবসার জন্য" grid (plan 3.2).** পার্টি, রিপোর্ট and সেটিংস are in the আরও menu. The 4 খাতা book tiles stay on home, because the owner made those icons for it.
- `tests/dashboard.test.ts` (3): section order, no duplicate grid, compact hero.

**Verified:** at **360×640**, বেচা/কেনা end at **470px**, above the bottom bar at 575px, even with the demo banner showing. No page errors.

**Not changed:** calculations and services. Same data, new layout.

### S3: first run, separate demo khata, shop setup, 2026-11-23
Approved under D32: AP-1, AP-2 and AP-3.

**Added**
- **Dexie v2, additive (AP-3):** a new `appMeta` table (`workspace`, `prefs`). Every v1 table and index is unchanged. Existing v1 databases upgrade in place with every row kept (tested).
- **Separate demo database `jomarkhata_demo` (AP-2).**
  - `getJomarkhataDb()` returns the real or the demo DB depending on the active mode, which is remembered in the real DB's `appMeta.prefs`.
  - Demo work never touches the real khata or its outbox.
- **No auto-seed (AP-1):** a fresh device shows the Welcome screen.
  - **"আমার খাতা শুরু করুন"** opens the shop setup form, which starts an **empty** khata. Only the shop name is required; mobile is validated in Bangladeshi format (Bengali digits OK); opening balances are optional.
  - **"আগে ডেমো দেখুন"** opens the demo khata, with a banner and an "আসল খাতায় যান" button.
- **Existing installs (D15):** data from an older build triggers a choice screen.
  - **"আমার ব্যবসার হিসাব"** keeps every row exactly as it is.
  - **"ডেমো হিসাব"** **moves** the data into the demo DB: copy → verify counts → only then clear the real DB.
  - Startup itself is **read-only** (`bootstrap()`) and never writes, seeds or deletes.
- **Settings:** "ডেমো রিসেট" exists **only inside demo mode** and resets only the demo DB. The real khata offers "ডেমো খাতা দেখুন" instead.
- New service functions: `bootstrap`, `createShop`, `keepLegacyAsMine`, `moveLegacyToDemo`, `enterDemo`, `exitDemo`, `isValidBdMobile`.
- New screens: `ShopSetupScreen`, `LegacyChoiceScreen`; the Welcome screen gets start + demo actions. The dev-only `?preview=welcome` is removed.
- `tests/first-run.test.ts` (20).

**Fixed (known risks closed)**
- `resetDemoData` used to wipe user-entered records. It now refuses in the real khata.
- A fresh device used to be auto-seeded with demo data mixed into the real khata.

**Verified e2e** (headless Edge at 360px):
- fresh device → welcome → validation → setup → empty dashboard with ৳৫,০০০ cash → survives reload
- demo in/out with a separate `jomarkhata_demo` DB
- a raw v1 database written like the old build → choice screen → keep → old shop dashboard

**Note for testers:** phones that used the earlier preview will see the choice screen once.

### S2: app shell & navigation, 2026-11-23
**Added**
- **Bottom bar (D2):** হোম · বাকি · **[+]** · লেনদেন · আরও.
  - **"+"** is a raised blue button that opens a quick-add sheet: বেচা, কেনা, বাকি আদায়, পরিশোধ, খরচ.
  - **"আরও"** opens a menu with every other screen. With the tabs, every screen is reachable in at most 2 taps.
- **Top bar:** home shows the greeting. Other screens show a back button and the screen title (the party name inside a party ledger). An **online/offline pill** (`hooks/use-online.ts`) shows on every screen; tapping it says plainly that everything is saved on this phone and the cloud isn't on yet.
- **Android back button:** screens, party detail and sheets push history entries.
  - Back closes a sheet first, then leaves the party, then returns to the previous screen.
  - From home, back exits the app as usual.
  - Opening a screen from the আরও menu replaces the sheet's entry, so there are no dead back presses.
- **Unsaved-form guard:** typing in any sheet marks it unsaved (a native `input` listener in `ModalSheet`).
  - Back, ✕ or tapping outside then asks: "লেখা তথ্য বাদ দেবেন?"
  - After a successful save the guard clears, so there's no prompt.
- `components/layout/navigation.ts` (titles + আরও items), `NavSheets.tsx` (quick-add + আরও), `lib/sheet-guard.ts`.
- `tests/navigation.test.ts` (8).

**Fixed while building**
- **Next.js App Router reloads the page on popstate when a history entry lacks its `__NA` marker.** Every entry now keeps Next's keys (`pushEntry` / `replaceEntry`), and the first entry is tagged after Next writes it. A test checks that no other history writes exist.

**Verified** (headless Edge at 360px, with a reload detector):
- tab → back → home
- আরও → স্টক → back → home
- typed sale → back → prompt → cancel keeps the form → confirm closes it
- an untouched form closes without asking
- saving closes the form without a prompt
- **no page reload in the whole run**

**Not changed:** service, accounting, Dexie.

### L1: landing page, app moves to /app, 2026-11-23
Owner decision D34: landing at `/`, app at `/app`.

**Added**
- The `/` landing page (`components/landing/LandingPage.tsx`) is static and Bengali-only. Sections: header, hero (2 CTAs), trust strip, 8 feature tiles with the owner's icons, 3 steps, install instructions (Android/iPhone), FAQ, final CTA, footer.
- **Only true claims.** No cloud, sync, encryption, prices, counts or testimonials. The FAQ says plainly that data lives only on the phone for now. There's no "login-free" promise either (D26).
- `StandaloneRedirect`: phones that installed earlier (start_url `/`) jump straight to `/app`.
- `docs/CODEMAP.md`: a one-page map for anyone starting on the code.
- `tests/landing.test.ts` (7): routing split, the database opens only under `/app`, CTAs, honest-claims guard.

**Changed**
- The app moved to `/app`. `JomarkhataProvider` moved from the root layout to `app/app/layout.tsx`, so the landing page never opens IndexedDB or seeds demo data.
- Manifest `start_url` is now `/app`; `id` stays `/`, so existing installs update in place.
- Service worker `jk-shell-v3`:
  - precaches `/app`
  - offline navigation under `/app` falls back to the cached app, everything else to `/`
- Service-worker registration also caches the app's scripts when the first visit is the landing page.

**Verified** (production build, headless Edge at 360px):
- Landing renders with no errors at 360px and 1280px.
- Offline `/app` e2e passed: all tabs, plus an offline sale that survives an offline reload.
- **Landing-first visit, then offline `/app`, renders the dashboard.**

### Brand: owner's logo and 19 feature icons, 2026-11-23
**Added**
- `public/icons/features/*.svg`: the owner's 19 colourful icons. The source files were each a **whole traced icon sheet** cropped by `viewBox` (~105–165 KB each, 2.4 MB in total). Paths outside each icon's viewBox were removed: **266 KB total, pixel-identical render** (verified by canvas diff, max difference 0).
- `components/ui/AppIcon.tsx`: typed `AppIcon` (name list `APP_ICONS`). `FeatureIcon` sizes `<img>` icons larger than line icons.
- The Dashboard uses the custom icons (বেচা, কেনা, quick actions, খাতা সমূহ, business tools, recent transactions). Bottom-nav icons (`nav-home`, `nav-transactions`, `add-plus`, `cashbox`) are ready for S2.
- The real logo replaces the "জ" placeholder (top bar, desktop sidebar, welcome screen): `public/brand/logo-mark.png` (128 px).
- PWA icons regenerated from the owner's 3072 px master: `icon-192`, `icon-512`, the owner's maskable 512 (content within the safe zone), opaque `apple-touch-icon` (180), `favicon.ico` (16/32/48).
- `public/brand/logo-horizontal.webp`: the horizontal logo, cropped to the content (was 16:9 with large empty margins), 1200×551, 42 KB. For the landing page and marketing.
- `vercel.json`: pushes to the `dev` branch don't deploy; only `main` deploys.
- README: feature list, codebase overview, security and data notes, branch workflow.

**Changed**
- Service worker `jk-shell-v1` → `jk-shell-v2` (old caches held the placeholder icons cache-first) and it now precaches the logo and all feature icons, so they show offline on screens not visited yet.

**Not used:** `logo-mark.svg` (10.9 MB). It's two embedded raster images inside an SVG wrapper, not a vector, so it gives no benefit over the PNG.

**Tests:** +4 (icons precached, icon files are small real vectors, no stray icons, logo files exist and are web-sized). 100/100.

### S12 (core) pulled forward: installable PWA + offline app shell, 2026-11-23
Owner needed to demo installing on a phone and using it offline today.

**Added**
- `app/manifest.ts` → `/manifest.webmanifest`: name জমারখাতা, standalone, portrait, theme `#4664E0`, background `#F5F7FE`, icons 192, 512 and maskable 512.
- `public/icons/*`: **temporary placeholder icons** (blue gradient "জ"). They'll be replaced by the owner's final logo with the same file names.
- `public/sw.js`, the service worker for the offline app shell:
  - **Pages:** network-first, with a cached fallback when offline.
  - **Hashed `/_next/static` assets and icons:** cache-first.
  - **Only same-origin GET requests are handled. It never touches IndexedDB or business data.** Old caches are removed on activate.
  - The first page load sends its resource list so the app works offline after **one** visit.
- `components/pwa/ServiceWorkerRegister.tsx`: registers the worker in **production builds only**, so dev keeps hot reload.
- `app/layout.tsx`: application name, Apple web-app meta, icons.
- `tests/pwa.test.ts` (6): manifest fields and icon files, service-worker rules (same-origin GET only, no IndexedDB/API caching, navigate fallback, cache cleanup), production-only registration.

**Verified end-to-end** (production build, headless Edge at 360px, `localhost`):
- The manifest is linked and the service worker activates; 15 entries cached after the first visit.
- **Offline reload renders the dashboard.** All 5 bottom-nav tabs work offline.
- **A sale recorded offline (৳777) is saved and still there after an offline reload.** Cash moved 16,540 → 17,317.
- No page errors.

**Not yet done (rest of S12):** a custom install-prompt UI, an "update available" prompt, and a **real Android phone test over HTTPS (Vercel Preview)**.

### S1 revision 3: Blue redesign from the owner's reference (D24), 2026-11-23
**Changed (visual only; no accounting, schema or service-behaviour change)**
- **Theme:** Royal Blue `#4664E0` on a light lavender canvas `#F5F7FE`, a blue gradient (`#4C6BE6 → #3F5BD9 → #3448BE`), and soft blue-tinted card shadows. **The amber and emerald accents were removed.** New `success` green for money in. `themeColor` is blue.
- **Top bar:** colourful blue gradient with decorative shapes, a white logo tile, the greeting "আসসালামু আলাইকুম," and the shop name, plus translucent icon buttons.
- **Multicolour feature tiles (`FeatureIcon`):**
  - 10 families with tokens `--color-tile-*`.
  - Applied to the Dashboard quick actions, খাতা সমূহ, ব্যবসার টুলস, the কেনা button and recent-transaction icons.
  - Same family = same colour.
- **Packaged controls instead of browser defaults (shadcn pattern):**
  - `select.tsx` (Radix Select) replaced all 9 native `<select>` elements.
  - `segmented.tsx` (Radix ToggleGroup) replaced all hand-made tab and toggle bars: 7 period/filter bars, the Dues role tabs, the Sale/Purchase mode toggles, the paid/due toggles, the stock add/remove toggle and the party role toggle.
- **Welcome illustration** is now multicolour (new decorative token `--color-highlight` `#FFC94D`).
- **Hero and labels on blue** use full white (no faded white), for contrast.

**Added dependencies (owner-requested):** `@radix-ui/react-select`, `@radix-ui/react-toggle-group`. They're bundled with the app and work offline; `npm audit --omit=dev` = 0.

**Tests:**
- New palette and 23 contrast pairs.
- New checks: all 10 tile families are ≥3:1, the old amber/emerald are gone, there are no native `<select>` elements, and there are no hand-made active-tab ternaries.
- The gradient is used on the hero and the top bar.
- 90 tests in total.

### S1 revision 2 — Lighter amber + gradient (owner decision D23) — 2026-11-23
**Changed (visual only)**
- Primary lightened `#E9A23B` → **`#F5BC5C`**; secondary `#FCEBCB` → `#FDF0D6`; hover `#EDA645`, deep `#E49A33`; new `--color-primary-light` `#FAD48A`. Text on amber gets more readable (9.6:1).
- **New utility `bg-primary-gradient`** (light → amber → deeper amber, 135°). It's applied to 35 main surfaces: the hero card, primary CTAs and the `Button` primary variant, sheet submit buttons, logo tiles, header buttons and the welcome CTA. Hover is `brightness(0.97)`. Small tabs, toggles, chips and toasts stay flat amber.
- `themeColor` → `#F5BC5C`.

**Tests**
- Palette updated, plus contrast for text on the gradient start. The white-text guard now also covers gradient surfaces. New check that the gradient utility exists and the hero uses it. 88 tests.

**Dev note:** after editing theme tokens in `globals.css`, restart `npm run dev` with `.next/dev` cleared. Turbopack's running Tailwind cache kept serving the old token values twice in this step (the production build was unaffected).

### S1 revision — Amber main colour, emerald accent (owner decision D22) — 2026-11-23
**Changed (visual only; no accounting, schema or service-behaviour change)**
- **Tokens:**
  - `--color-primary` is now **Amber `#E9A23B`**; `--color-accent` is now **Deep Emerald `#145C46`**; secondary is Soft Amber `#FCEBCB`.
  - New `--color-on-primary` `#2B1D05` (text on amber, 7.6:1) and `--color-primary-ink` `#8A5A00` (amber as text or outline, ≥5:1).
  - The browser `themeColor` is now amber.
- **Class migration:**
  - 53 `text-white` on amber fills → `text-on-primary`; 82 `text-primary` → `text-primary-ink`; 47 stand-alone `border-primary` → `border-primary-ink`.
  - The hero card children were converted by hand.
  - Conditional buttons (the due form submit, the confirm dialog) now carry their text colour per branch.
- **Warnings keep their warm colour:** former amber-accent uses (low stock, unknown cost, supplier payable, the purchase-due toggle) moved to the `warning` tokens.
- **Focus ring** uses `primary-ink`.
- **Removed:** the temporary `?theme=amber` preview override and its switch.

**Tests**
- `design-system.test.ts`: updated palette and contrast pairs (now 22 pairs). New guards: **no white text on an amber fill** and **no amber used as text** (bare `text-primary` banned). 37 tests.

### S1 — Design system foundation — 2026-11-22
**Changed (visual only; no accounting, schema or service-behaviour change)**
- **Colour tokens:** `app/globals.css` `@theme` holds the owner palette (Warm Ivory `#F7F5EF`, Deep Emerald `#145C46`, Soft Sage `#DCECE4`, Amber `#E9A23B`, Soft Red `#FCE7E5`, White cards) plus contrast-verified supporting tokens.
- **All 903 hardcoded hex colours replaced by tokens** (884 in 21 files; 19 removed with the font switcher). The only literal left is the browser `themeColor`.
- **Type scale** raised for mobile (13 / 15 / 16 / 18 / 21 / 25 / 32 px) through the theme, so every screen got larger text at once. All `text-[11px]` / `text-[10px]` became `text-xs` (13px). The body weight is 500.
- **Cards** now carry a visible 1px outline plus a soft shadow (`shadow-card`). Focus rings use the primary colour.
- **Font:** a single generic font, **Noto Sans Bengali** (variable). Hind Siliguri, Plus Jakarta Sans, the 5 candidate fonts and the dev `FontSwitcher` were removed.
- **Wording (D10):** cash is "ক্যাশ" (হাতে ক্যাশ, আজ ক্যাশ এসেছে/গেছে, শুরুর ক্যাশ). "নগদ" now means only the Nagad wallet, with "(MFS)" dropped. The payment channels read ক্যাশ · বিকাশ · নগদ · ব্যাংক. **The walk-in labels "নগদ ক্রেতা" / "নগদ সরবরাহকারী" are unchanged** (AP-12 rejected).
- **The due-reminder date field** now displays dd/MM/yyyy with a left calendar icon (`DateInput`).

**Added**
- Shared components: `Button`, `Card`, `AmountWithState`, `StatusBadge`, `Banner`, `DateInput`.
- `onboarding/WelcomeScreen` (first page when not logged in, modelled on the reference theme) with an original token-only SVG illustration. In S1 it's a **development preview only** (`/?preview=welcome`); it's wired to the first run in S3. "লগইন করুন" only explains that accounts aren't available yet, with no fake login.
- `lib/format.ts`: `toDateInputValue()` and `formatDateInputDisplay()` (dd/MM/yyyy, Bengali digits).
- `tests/design-system.test.ts` (32 tests): no raw hex, the exact owner palette, WCAG contrast for 20 token pairs (plus proof that the forbidden pairs fail), the card outline, no px font sizes, the single font with the switcher gone, the D10 wording, the "নগদ ক্রেতা" label unchanged, and the date display format.

**Fixed during S1**
- `--color-ink-subtle` darkened from `#6B756F` to `#626C66`. The new contrast test showed 4.38:1 on ivory; it's now 5.0:1, and at least 4.6:1 on every background.

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
