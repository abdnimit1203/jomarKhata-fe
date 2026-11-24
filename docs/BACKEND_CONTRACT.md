# Backend contract

This is what the `jomarKhata-be` repository must provide so the existing frontend can switch on accounts, cloud sync and subscriptions. The frontend side is already built and tested against this contract with fakes. See `lib/auth.ts`, `lib/sync/engine.ts` and `lib/access-policy.ts`.

**Stack decisions:** Express + MongoDB Atlas hold all data; Firebase is used **only** for authentication (D30). The super admin works from a separate panel, with roles checked on the server (D31).

## 1. Authentication

| Item | Rule |
|---|---|
| Sign-in methods | Google first. Bangladeshi mobile OTP only if an affordable SMS provider is confirmed (D26). |
| Token | The client sends the Firebase ID token as `Authorization: Bearer <token>`. The server verifies it with the Firebase Admin SDK on every request. |
| Session | Persistent. The user logs in again only after an explicit logout, or when the token expires or is revoked (D12). |
| Account ID | A server-generated, unique, easy-to-read ID such as `JK-4827-1935` (D29). It's for support only and is **never** a login credential. |
| Email | Mandatory (D27). Google provides it; OTP sign-ups must add it. The profile form re-opens until shop name, owner name, mobile and email are set (D28). |
| Client hook | Implement `AuthProvider` (`lib/auth.ts`). The app only ever leaves `local` through a real provider. |

**Endpoints**
- `GET /me` returns `{ accountId, email, displayName, phone?, tenantId, role, referralCode, referralStats }` (see §8)
- `PUT /me/profile` sets shop name, owner name, mobile and email

## 2. Tenancy and ownership

- Every record belongs to a `tenantId`. **The server derives the tenant from the verified token and never trusts a `tenantId` sent by the client.**
- **Per-account local databases (AP-7, designed now, built with the backend):**
  - Each account gets its own IndexedDB namespace: `jomarkhata_<tenantId>`.
  - Today's `jomarkhata_db` is claimed by the first account that signs in on the phone (§4).
  - A second account on the same phone never sees or overwrites the first one's data.

## 3. Sync API

The client outbox item (`SyncQueueItem`) has these fields:

| Field | Meaning |
|---|---|
| `opId` | Idempotency key |
| `entityType`, `entityId` | Which record. Entity IDs are client-generated UUIDs and are kept. |
| `operation` | `upsert` or `void` |
| `payload` | The JSON record |
| `baseRevision` | Revision the change was based on |
| `queuedAt` | When the change was queued |

**Push: `POST /sync/push`** with body `{ items: SyncQueueItem[] }` (at most 50 per batch, oldest first).

The response is `{ results: [{ opId, status: 'ok' | 'conflict' | 'error', error? }] }`.

- **A repeated `opId` is a no-op that returns the original result.** The client may resend after lost acknowledgements, and records must never be duplicated.
- **Financial records** (sales, purchases, due entries, expenses) are never overwritten. If `baseRevision` differs from the server revision, return `conflict`; the client marks the item `needs_review` and shows both versions. Voids and corrections stay append-only.
- **Profile-type records** (party, product, shop profile) follow per-field latest-wins, recorded in the audit log, or `conflict` when both sides changed the same field.
- **A void arrives as a void op on the parent** (for example a sale) **plus ops for every linked row**: money movement void, due void, party, stock reversal and product.

**Pull: `GET /sync/pull?cursor=<serverCursor>`** returns `{ changes: [...], cursor }`. It's a delta by server cursor. The client applies it in one Dexie transaction and **never overwrites a local record that still has a pending outbox item**.

**Client rule:** an item becomes `synced` only on an `ok` acknowledgement. Nothing is ever deleted from the outbox.

**Client hook:** implement `SyncTransport` (`lib/sync/engine.ts`), return it from `getSyncTransport()`, and start `startSyncRunner` after login.

## 4. Claiming the local khata on first login

1. On first login the server returns the tenant.
2. **If the tenant is empty:** bind `appMeta.workspace.workspaceId` to the tenant, then upload the outbox and existing records. Uploads are idempotent.
3. **If the tenant already has data and the phone has a local khata: never merge automatically.** The user chooses between "upload this phone's khata", "keep separate" or "back up first". The design is on `/preview` in development.
4. Demo data lives in a separate database (`jomarkhata_demo`) and is never uploaded.

## 5. Logout

- **Logout is blocked while outbox items are pending or failed.** The user can sync now, export a backup, or cancel. The design is on `/preview`.
- "Remove data from this device" is a separate, explicit action. It's allowed only when everything is synced, and it needs a typed confirmation and a backup offer.

## 6. Subscription and access

**`GET /subscription`** returns `{ status: 'trial' | 'active' | 'expired', expiresAt, serverTime }`. The client caches it in `appMeta.subscription`.

- **Trial length, prices and payment settings are super-admin configuration. Never hard-code them** (AGENTS rule 12). The default trial is 6 months.
- **Policy (D4), already implemented in `lib/access-policy.ts`:**
  - after expiry: 7 days of grace (full access with a banner), then read-only
  - read-only blocks writes but **viewing, search and backup export always work**
  - the client never shows "active" past a known expiry
  - the client's clock is never trusted before the last `serverTime` it saw
- **Final enforcement is on the server:** writes from an expired tenant are rejected.
- **Local mode** (no account) has no subscription and is never restricted (D16). The trial starts only after an account is created **and** the backend confirms it.

## 7. Backup format

The backup file v2 (`lib/backup.ts`) is the client's offline recovery path, and it stays supported after sync exists. The server doesn't need to read it, but an admin "import backup into tenant" tool may reuse the same validation rules.

## 8. Referral (owner request, 2026-11-23)

The UI is ready: `components/settings/AccountSection.tsx` (ID and code with copy buttons, WhatsApp share), the optional field in `AuthScreen`, and `lib/referral.ts`. Nothing is shown until a real login exists.

| Item | Rule |
|---|---|
| User ID | `accountId` (§1), unique and server-generated, shown in the profile with a copy button. |
| Referral code | **One per account, generated by the server, unique** (case-insensitive), e.g. `JK7Q4M2X`. Use 4–16 characters, `A–Z0–9`, and skip look-alike characters (`0/O`, `1/I`). It never changes once it has been used. |
| Using a code | **Optional** at sign-up: `signInWithGoogle({ referralCode })` / `verifyOtp(..., { referralCode })`. Accept it **only when a new account is created**; later logins ignore it. An unknown code doesn't block sign-up: return a soft error and create the account without a referrer. **A user can't refer themselves** (same user, email or phone). |
| Link | `/app?ref=CODE` (the shared link) pre-fills the field (`referralFromSearch`). |
| Tracking | Store `referredBy` (the referrer's user ID) on the new account. It's set once and never changed by the client. |
| Commission | **20% of every subscription payment** the referred user makes is credited to the referrer. Calculate it on the server when the payment is confirmed, in a `referralCommissions` ledger (`referrerId`, `referredUserId`, `paymentId`, `amount`, `rate`, `status: pending \| paid \| reversed`). Refunds reverse it. The rate is **super-admin configuration**; 20% is the default. |
| Two kinds of referrer (owner, 2026-11-23) | **Promoter** (e.g. the owner's field promoter): a **cash** commission, by default 20% for the referred user's first 6 months, then 10%. **Regular user:** no cash; earns **free subscription time** (default: 1 free month for each referred user who pays). Each account has a `referrerType: 'regular' \| 'promoter'`, set by the super admin. All numbers are super-admin configuration. |
| Changing the rate | A rate change applies **only to payments after the change**. Every commission row stores the `rate` it was calculated with, so past rows are never recalculated. |
| Launch offer (optional) | A referred new user may get extra trial days (e.g. 45 instead of 30), as super-admin configuration. |
| Report | `GET /me` → `referralStats: { referredUsers, commissionEarned, commissionRate, freeDaysEarned? }`. The app only displays these numbers. |
| Admin | The super-admin panel lists referrers, referred users and commissions, and marks payouts as paid. |

## 9. Admin dashboard and Telegram alerts (owner, 2026-11-24)

**The admin panel is built together with the backend (phase 3), not at the end.** Subscription approval, referral payouts and support all need it from day one.

| Area | What the super admin can do |
|---|---|
| Users | Search by account ID, email, phone or shop name. See trial or subscription status and the device's last sync. Block or unblock. Set `referrerType` (regular / promoter). |
| Payments | List of submitted payments (bKash, Nagad, bank; TrxID, amount, screenshot). **Approve** → the subscription is extended automatically; **Reject** with a reason. |
| Requests | Help or feature requests sent from the app (one simple form). Status: new / in progress / done. |
| Referrals | Referrers, the users they brought, and commission or free-day rows; mark a payout as paid. |
| Settings (no code change needed) | Trial days, prices per plan, referral rates and reward days, payment numbers shown in the app, and the WhatsApp help number. |
| Audit | Every admin action is logged (who, what, when). |

**Automation:**
- A payment the user submits stays **pending** until it is approved.
- On approval, the subscription dates update and the app sees the change on its next `GET /subscription`.
- Optional later: auto-match bKash TrxIDs.

**Telegram alerts** (the same pattern as the owner's e-commerce site):
- The backend calls the Telegram Bot API `sendMessage` whenever one of these events happens:
  - a new account is created (and which referral code it used)
  - a payment is submitted
  - a help or feature request is sent
  - a promoter payout is due
- Each message is short Bangla text plus a **direct link to that item in the admin panel**, e.g. `💰 নতুন পেমেন্ট — ৳999, বিকাশ, TrxID 8N7…, দোকান: মায়ের দোয়া স্টোর → https://<admin>/payments/<id>`.
- **Env (backend only, never in the frontend):** `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` (one ID, or a comma-separated list).
- Sending goes through a small outbox with retry. A failed Telegram call never blocks the user's request.
- Later, optional: inline **Approve / Reject** buttons through a bot webhook, checked against the admin's Telegram ID.

