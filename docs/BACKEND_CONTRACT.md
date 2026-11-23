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
- `GET /me` returns `{ accountId, email, displayName, phone?, tenantId, role }`
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
