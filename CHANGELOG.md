# Changelog

All notable changes to the Jomarkhata frontend. Steps refer to the approved frontend plan (S0–S13).

## [Unreleased]

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
