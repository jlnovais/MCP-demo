# MindShaker Wallet API FAQ

Reference for the **MindShaker Wallet API** (v1.0) as documented at
`http://localhost:3000/docs`. The API provides user management, authentication,
exchange rates, wallet operations, and payment requests. Most endpoints accept
either **session-based authentication** (cookie) or **API key authentication**
(`x-wallet-api-key` header).

---

## What is the MindShaker Wallet API?

A REST API for the MindShaker Wallet platform. It lets you manage users and API
keys, read and update wallet credit balances, configure exchange rates, and
create or track payment requests. When a payment completes, the user's wallet is
credited automatically and a wallet log entry is created.

Base URL (local development): `http://localhost:3000`

---

## Who developed the Wallet API?

The MindShaker Wallet API was developed by **José Novais**, a developer at
**Mindshaker**.

---

## How do I authenticate?

Two methods are supported:

| Method | How | Used for |
| --- | --- | --- |
| **Session cookie** | Log in via `POST /api/auth/login` then `POST /api/auth/verify`; the server sets a `wallet-session-id` cookie | Browser / interactive admin flows |
| **API key** | Send the `x-wallet-api-key` header on each request | Programmatic access (e.g. MCP tools) |

Some endpoints accept both; others are restricted to one method (see Demo API
below). Unauthenticated requests return HTTP 401.

---

## What is the difference between admin and merchant accounts?

Many endpoints behave differently depending on account type:

- **Admin accounts** can act on any `merchantId`, must supply `merchantId` when
  creating payments, and can manage users.
- **Non-admin (merchant) accounts** have `merchantId` fields **ignored** on
  wallet, payment, exchange-rate, and log endpoints — the API scopes operations
  to the authenticated merchant automatically.

---

## Tools

### How do I check if the API is running?

`GET /api` — Health check (no authentication required).

Returns `{ "status": "ok", "timestamp": "..." }`.

### How do I get the current authenticated user profile?

`GET /api/profile` — Requires session cookie or API key.

Returns `userId`, `email`, `type`, `username`, `name`, `active`, and `authType`
(`session` or `api-key`).

---

## Administration — Authentication

### How does login work?

Login is a two-step email verification flow:

1. **`POST /api/auth/login`** — Submit `username` and `password`. A verification
   code is sent to the user's email.
2. **`POST /api/auth/verify`** — Submit `email` and `code` (4–8 characters). On
   success, a session cookie is set and user info is returned.

### How do I log out?

`POST /api/auth/logout` — Destroys the current session (session cookie required).

### How do I get the current session user?

`GET /api/auth/me` — Returns `id`, `username`, `email`, and `type` for the
authenticated session user.

---

## Administration — Users

User management is **admin only**. All endpoints require session cookie or API
key.

### How do I list users?

`GET /api/users` — Optional query filters:

- `type` — `user`, `admin`, or `merchant`
- `page`, `pageSize` — pagination (1-based page)
- `email`, `username` — partial match filters
- `sortBy`, `sortOrder` (`ASC` / `DESC`)

Paginated responses include headers: `X-Total-Count`, `X-Page`, `X-Page-Size`,
`X-Total-Pages`, `X-Has-Next-Page`, `X-Has-Previous-Page`.

### How do I create a user?

`POST /api/users` — Body fields: `name`, `username` (min 3 chars), `email`,
`password` (min 6 chars), `type` (`user` | `admin` | `merchant`).

### How do I get, update, or delete a user?

| Action | Endpoint | Notes |
| --- | --- | --- |
| Get by ID | `GET /api/users/{id}` | `id` is a GUID |
| Update | `PATCH /api/users/{id}` | Partial update; all body fields optional |
| Delete | `DELETE /api/users/{id}` | Permanently removes the user |

---

## Administration — API Keys

API keys enable programmatic access. Keys are managed per user.

### How do I list API keys for a user?

`GET /api/users/{userId}/api-keys` — Returns key metadata (`id`, `keyPrefix`,
`keyHint`, `isActive`, `createdAt`, `lastUsedAt`, `description`). The raw key is
never shown again after creation.

### How do I create an API key?

`POST /api/users/{userId}/api-keys` — Body: `description` (3–100 chars, friendly
name).

Response includes the **raw `apiKey` shown only once** — store it securely. Also
returns `keyPrefix`, `keyHint`, and a confirmation message.

### How do I delete or deactivate an API key?

| Action | Endpoint |
| --- | --- |
| Delete | `DELETE /api/users/{userId}/api-keys/{apiKeyId}` |
| Deactivate | `PATCH /api/users/{userId}/api-keys/{apiKeyId}` |

---

## Wallet API — Wallet

A wallet is the credit balance for a `userId` associated with a `merchantId`.

### How do I add or remove credits from a wallet?

`PUT /api/wallet` — Body:

- `merchantId`, `userId`, `credits` (positive to add, negative to remove),
  `description`

If the wallet does not exist, it is created. Non-admin accounts ignore
`merchantId` and operate on their own merchant.

### How do I read a wallet balance?

`GET /api/wallet/{userId}/{merchantId}` — Returns `merchantId`, `userId`,
`credits`, `lastUpdateDate`, and `description`.

Non-admin accounts ignore the `merchantId` path parameter.

### How do I transfer credits between wallets?

`PUT /api/wallet/transfer` — Body:

- `merchantIdSource`, `userIdSource`
- `merchantIdDestination`, `userIdDestination`
- `credits`
- `descriptionForSource`, `descriptionForDestination`

The transfer is atomic. The destination wallet is created if it does not exist.
Non-admin accounts can only transfer within their own merchant. Cross-merchant
transfers require an admin account.

### How do I reset wallet balances in bulk?

`PUT /api/wallet/reset` — Sets credits for multiple users to a fixed amount
(without a transfer). Body:

- `merchantId`, `userIds` (comma-separated, no spaces, e.g. `"id1,id2,id3"`),
  `credits`, `description`

Use the `$previousCredits$` tag in `description` to include the prior balance
(e.g. `"Wallet reset, previous credits: $previousCredits$"`). Wallets must
already exist.

### How do I list wallet transaction logs?

`GET /api/wallet/logs` — Required query: `merchantId`, `userId`. Optional
filters:

- `id` — log ID
- `dateStart`, `dateEnd` — inclusive date range (formats: `yyyy-MM-dd`,
  `yyyy-MM-dd HH:mm[:ss]`, ISO 8601)
- `page` (default 1), `pageSize` (default 10)
- `orderBy` — `date`, `MerchantId`, `UserId`, `logId`
- `direction` — `ASC` or `DESC`

Returns paginated `WalletLogItemResponseDTO` entries with pagination headers.

### How do I get a single wallet log?

`GET /api/wallet/logs/{id}` — `id` is numeric.

---

## Wallet API — Exchange Rate

The exchange rate is the **cost of 1 credit in euros** for a merchant.

### How do I set or update an exchange rate?

`POST /api/exchange-rate` — **Admin only.** Body: `merchantId`, `amount` (0–500).

Creates or updates the rate. Returns `merchantId`, `amount`, `updatedDate`.

### How do I read an exchange rate?

`GET /api/exchange-rate/{merchantId}` — Returns the rate for the merchant.

Non-admin accounts ignore `merchantId` and receive their own merchant's rate.

---

## Wallet API — Payments

Payment requests are sent to an external payment provider. Supported types:
**MB** (Multibanco), **MBWAY**, and **CARD**. When payment succeeds, the wallet
is credited and a log entry is created automatically.

### How do I create a payment request?

`POST /api/payments` — Optional query: `inApp` (boolean, MB WAY in-app),
`isAuthorization` (boolean).

Body fields:

| Field | Required | Notes |
| --- | --- | --- |
| `userId` | Yes | User associated with the merchant |
| `amount` | Yes | Euros; use `0` when specifying `credits` instead |
| `credits` | Yes | Credits; use `0` when specifying `amount` instead |
| `expirationMinutes` | Yes | MB reference expiry (see provider docs) |
| `customerName` | Yes | Customer full name |
| `customerEmail` | Yes | Customer email |
| `customerPhone` | No | **Required when type is MBWAY** |
| `description` | Yes | For MBWAY, text sent to the mobile app |
| `type` | Yes | `MB`, `MBWAY`, or `CARD` |
| `merchantId` | Admin only | Required for admin; ignored for merchants |

Amount and credits are converted using the merchant's exchange rate when one is
zero. Provider checkout failures return HTTP 502; the payment may be stored with
`ERROR` status.

### What payment statuses exist?

`NEW`, `ERROR`, `UPDATE`, `PAID`, `REFUSED`, `REFUNDED`, `UNKNOWN`, `CANCELED`,
`EXPIRED` (may appear after refreshing status from the provider).

### How do I list payment requests?

`GET /api/payments` — Required query: `merchantId` (ignored for non-admin).
Optional filters:

- `id` — Hashids-encoded payment ID
- `userId`, `status`, `reference`, `customerPhone`, `type`
- `requestDateStart`, `requestDateEnd`
- `page` (default 1), `pageSize` (default 10)
- `orderBy` — `status`, `merchantId`, `userId`, `requestDate`, `updateDate`,
  `expirationDate`, `customerName`, `customerEmail`, `customerPhone`, `type`
- `direction` — `ASC` or `DESC`

### How do I get a single payment?

`GET /api/payments/{id}` — `id` is Hashids-encoded. Optional query:
`checkProvider` (boolean, default `false`) refreshes status from the payment
provider.

### How do I cancel a payment?

`DELETE /api/payments/{id}/cancel` — Cancels at the payment provider. Returns
`id`, `type`, `providerSuccess`, and `description`. On success, confirm
cancellation via check-status with the provider.

Non-admin accounts can only cancel their own merchant's payments.

---

## Demo API

Endpoints for testing authentication flows.

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /api/demo` | Session or API key | Greeting with username, userType, authType |
| `GET /api/demo/session` | Session cookie only | Greeting (session auth) |
| `GET /api/demo/apikey` | API key only | Greeting (API key auth) |

---

## How does pagination work?

List endpoints for users, wallet logs, and payments return pagination metadata
in response headers:

- `X-Total-Count` — total items
- `X-Page` — current page
- `X-Page-Size` — items per page
- `X-Total-Pages` — total pages
- `X-Has-Next-Page` — `true` / `false`
- `X-Has-Previous-Page` — `true` / `false`

Default page size is 10 where not specified.

---

## What do API errors look like?

Errors follow a common shape (`ErrorResponseDto`):

```json
{
  "statusCode": 400,
  "timestamp": "2025-03-10T12:00:00.000Z",
  "path": "/api/users",
  "response": "Validation failed"
}
```

Common status codes: **400** (validation), **401** (unauthorized), **403**
(forbidden / admin only), **404** (not found), **409** (conflict), **422**
(invalid payment ID or business rule), **502** (payment provider failure),
**503** (service unavailable).

---

## Quick endpoint index

| Tag | Method | Path | Summary |
| --- | --- | --- | --- |
| Tools | GET | `/api` | Health check |
| Tools | GET | `/api/profile` | Current user profile |
| Auth | POST | `/api/auth/login` | Initiate login |
| Auth | POST | `/api/auth/verify` | Verify code, complete login |
| Auth | POST | `/api/auth/logout` | Logout |
| Auth | GET | `/api/auth/me` | Current session user |
| Users | GET | `/api/users` | List users |
| Users | POST | `/api/users` | Create user |
| Users | GET | `/api/users/{id}` | Get user |
| Users | PATCH | `/api/users/{id}` | Update user |
| Users | DELETE | `/api/users/{id}` | Delete user |
| API Keys | GET | `/api/users/{userId}/api-keys` | List keys |
| API Keys | POST | `/api/users/{userId}/api-keys` | Create key |
| API Keys | DELETE | `/api/users/{userId}/api-keys/{apiKeyId}` | Delete key |
| API Keys | PATCH | `/api/users/{userId}/api-keys/{apiKeyId}` | Deactivate key |
| Wallet | PUT | `/api/wallet` | Add/remove credits |
| Wallet | GET | `/api/wallet/{userId}/{merchantId}` | Get balance |
| Wallet | GET | `/api/wallet/logs` | List logs |
| Wallet | GET | `/api/wallet/logs/{id}` | Get log |
| Wallet | PUT | `/api/wallet/reset` | Reset balances |
| Wallet | PUT | `/api/wallet/transfer` | Transfer credits |
| Exchange Rate | POST | `/api/exchange-rate` | Create/update rate |
| Exchange Rate | GET | `/api/exchange-rate/{merchantId}` | Get rate |
| Payments | POST | `/api/payments` | Create payment |
| Payments | GET | `/api/payments` | List payments |
| Payments | GET | `/api/payments/{id}` | Get payment |
| Payments | DELETE | `/api/payments/{id}/cancel` | Cancel payment |
| Demo | GET | `/api/demo` | Demo greeting |
| Demo | GET | `/api/demo/session` | Demo (session only) |
| Demo | GET | `/api/demo/apikey` | Demo (API key only) |
