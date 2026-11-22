# জমারখাতা (Jomarkhata) — Frontend

**দোকানের সব হিসাব, এক খাতায়।**

A mobile-first, offline-first bookkeeping app for small and medium retail shops in Bangladesh. Bengali-first UI.

## Stack
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- Dexie 4 on IndexedDB (local-first storage)
- Vitest + fake-indexeddb (tests)

## Current status
- **Local mode only.** All data is stored on the device in IndexedDB.
- **No backend, cloud sync or login yet.** Those are separate later phases with a separate backend repository.
- See [ARCHITECTURE.md](ARCHITECTURE.md), [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md) and [CHANGELOG.md](CHANGELOG.md).

## Run locally
**Prerequisite:** Node.js 20+.

```bash
npm install
npm run dev        # http://localhost:3000
```

To open it on a phone on the same Wi-Fi, use the "Network" URL that `npm run dev` prints. Add that IP to `allowedDevOrigins` in `next.config.ts` if it differs.

## Checks
```bash
npm test           # Vitest: accounting, data-preservation and migration tests
npm run typecheck  # TypeScript (tsc --noEmit)
```
