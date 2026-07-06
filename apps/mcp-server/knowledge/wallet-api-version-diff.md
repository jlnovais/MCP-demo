# Wallet API — Old vs Current Version

This document summarizes the differences between the **legacy production API**
documented at [https://api.wallet.merxall.com/index.html](https://api.wallet.merxall.com/index.html)
and the **current API** documented at `http://localhost:3000/docs`.

The legacy host exposes two Swagger definitions side by side:

| Definition | Spec URL | Scope |
| --- | --- | --- |
| MindShaker Wallet API **V1** | `/swagger/v1/swagger.json` | Wallet, exchange rate, payments (as "Request") |
| MindShaker Wallet API **V2** | `/swagger/v2/swagger.json` | Same as V1, plus wallet log endpoints |

The current API is a broader rewrite (NestJS) that keeps the core wallet/payment
behaviour from V2 but adds administration, authentication, and several new
endpoints. When migrating from the old host, **compare against V2** — the
current API is closest to that version.

---

## High-level summary

| Area | Old API (merxall.com) | Current API (localhost:3000) |
| --- | --- | --- |
| **Title** | Mindshaker Wallet API | MindShaker Wallet API |
| **Versions on Swagger** | V1 and V2 selectable | Single v1.0 spec |
| **Endpoint count** | 8 per version (plus OPTIONS) | 24 |
| **URL prefix** | `/api/v1/...` or `/api/v2/...` | `/api/...` (no version segment) |
| **Path style** | PascalCase (`/Wallet/Transfer`) | kebab-case (`/wallet/transfer`) |
| **Authentication** | API key header only (`MindshakerKey`) | Session cookie **or** `x-wallet-api-key` |
| **Administration** | Not exposed | Users, API keys, login/logout |
| **Payments name** | "Request" (`/Request`) | "Payments" (`/payments`) |
| **Cancel payment** | Not available | `DELETE /api/payments/{id}/cancel` |
| **Wallet logs** | V2 only (`/Wallet/Log`) | `/api/wallet/logs` |
| **Health / profile** | Not available | `GET /api`, `GET /api/profile` |
| **Demo endpoints** | Not available | `/api/demo`, `/api/demo/session`, `/api/demo/apikey` |

---

## Authentication

### Old API

- Single method: **API key in header** `MindshakerKey`.
- No login, session, or user-management endpoints in Swagger.
- All wallet/payment operations authenticate the same way.

### Current API

- **Session cookie** (`wallet-session-id`) — obtained via two-step login:
  `POST /api/auth/login` → `POST /api/auth/verify`.
- **API key** (`x-wallet-api-key` header) — managed per user under
  `/api/users/{userId}/api-keys`.
- Some endpoints accept both; logout and `/api/auth/me` are session-only.
- Demo endpoints exist specifically to test each auth mode.

**Migration note:** Replace `MindshakerKey` with `x-wallet-api-key`. If you use
browser-based admin flows, adopt the login/verify session flow instead.

---

## URL and naming changes

Old paths use a version segment and PascalCase controller names. Current paths
drop the version and use lowercase kebab-case.

| Operation | Old V1 / V2 | Current |
| --- | --- | --- |
| Create/update exchange rate | `POST /api/v{1\|2}/ExchangeRate` | `POST /api/exchange-rate` |
| Get exchange rate | `GET /api/v{1\|2}/ExchangeRate/{merchantId}` | `GET /api/exchange-rate/{merchantId}` |
| Create payment | `POST /api/v{1\|2}/Request` | `POST /api/payments` |
| List payments | `GET /api/v{1\|2}/Request` | `GET /api/payments` |
| Get payment | `GET /api/v{1\|2}/Request/{Id}` | `GET /api/payments/{id}` |
| Cancel payment | *(not available)* | `DELETE /api/payments/{id}/cancel` |
| Update wallet | `PUT /api/v{1\|2}/Wallet` | `PUT /api/wallet` |
| Get wallet | `GET /api/v{1\|2}/Wallet/{userId}/{merchantId}` | `GET /api/wallet/{userId}/{merchantId}` |
| Transfer credits | `PUT /api/v{1\|2}/Wallet/Transfer` | `PUT /api/wallet/transfer` |
| Reset wallets | `PUT /api/v{1\|2}/Wallet/Reset` | `PUT /api/wallet/reset` |
| List wallet logs | `GET /api/v2/Wallet/Log` *(V2 only)* | `GET /api/wallet/logs` |
| Get wallet log | `GET /api/v2/Wallet/Log/{Id}` *(V2 only)* | `GET /api/wallet/logs/{id}` |

Query parameters changed from **PascalCase** to **camelCase** (e.g. `MerchantId`
→ `merchantId`, `Page` → `page`, `DateStart` → `dateStart`).

---

## What is new in the current API

These endpoint groups do not exist on the old Swagger at all:

### Tools

- `GET /api` — health check
- `GET /api/profile` — authenticated user profile (works with session or API key)

### Administration — Auth

- `POST /api/auth/login` — initiate login (sends email verification code)
- `POST /api/auth/verify` — complete login (sets session cookie)
- `POST /api/auth/logout` — destroy session
- `GET /api/auth/me` — current session user

### Administration — Users (admin only)

- `GET /api/users` — list users (paginated, filterable)
- `POST /api/users` — create user
- `GET /api/users/{id}` — get user
- `PATCH /api/users/{id}` — update user
- `DELETE /api/users/{id}` — delete user

### Administration — API Keys

- `GET /api/users/{userId}/api-keys` — list keys
- `POST /api/users/{userId}/api-keys` — create key (raw key shown once)
- `DELETE /api/users/{userId}/api-keys/{apiKeyId}` — delete key
- `PATCH /api/users/{userId}/api-keys/{apiKeyId}` — deactivate key

### Payments

- `DELETE /api/payments/{id}/cancel` — cancel at payment provider

### Demo API

- `GET /api/demo` — greeting (session or API key)
- `GET /api/demo/session` — greeting (session only)
- `GET /api/demo/apikey` — greeting (API key only)

---

## What was removed

- **OPTIONS** preflight endpoints on each old controller
  (`OPTIONS /api/v1/Wallet`, etc.) — not documented in the current spec.
- **Version selector** (V1 vs V2) — current API is a single unified surface.
- **`MindshakerKey` header** — replaced by `x-wallet-api-key`.

---

## Old V1 vs Old V2 (context for migration)

If you are still on V1 at merxall.com, these internal changes happened before
the current rewrite:

| Feature | Old V1 | Old V2 |
| --- | --- | --- |
| Wallet logs | Not available | `GET /Wallet/Log`, `GET /Wallet/Log/{Id}` |
| Transfer response IDs | `sourceRequestId`, `destinationRequestId` | `sourceLogId`, `destinationLogId` |
| Wallet update response IDs | `sourceRequestId`, `destinationRequestId` | `sourceLogId`, `destinationLogId` |
| Terminology | "Request" = command + audit log | "Request" = payment to provider; logs are separate |

The current API follows V2's **log-based** naming (`sourceLogId`, `destinationLogId`)
and renames "Request" to **"Payments"**.

---

## Behavioural differences (same concept, different rules)

### Admin vs merchant scoping

The current API documents explicit **admin vs non-admin** behaviour on wallet,
payment, exchange-rate, and log endpoints: non-admin accounts have `merchantId`
fields ignored and are scoped to their own merchant. The old Swagger mentions
this in places but the current spec is more thorough.

### Create payment

| Aspect | Old V2 | Current |
| --- | --- | --- |
| `merchantId` in body | Not present | Required for admin; ignored for merchants |
| Required fields | `userId`, `customerName`, `customerEmail`, `description` only | Also requires `amount`, `credits`, `expirationMinutes`, `type` |
| `type` values | `'MB'`, `'MBWay'`, `'CARD'` (nullable) | `'MB'`, `'MBWAY'`, `'CARD'` (required enum) |
| Query params | None | `inApp`, `isAuthorization` (MB WAY / auth flows) |
| Provider failure | Not documented | HTTP 502; payment may be stored as `ERROR` |

### Get payment

Both old V2 and current support `checkProvider` (boolean) to refresh status from
the payment provider. The current API also documents an **`EXPIRED`** status that
may appear after a provider refresh.

### Payment response

Current adds **`providerInAppUrl`** (MB WAY in-app deep link). All other payment
response fields match the old V2 `RequestResponse` schema.

### Cancel payment (new)

`DELETE /api/payments/{id}/cancel` returns `providerSuccess` and a provider
message. Clients should confirm cancellation via check-status with the provider.

### Error format

| | Old API | Current API |
| --- | --- | --- |
| Schema | `ProblemDetails` (ASP.NET style) | `ErrorResponseDto` |
| Shape | `title`, `status`, `detail`, etc. | `statusCode`, `timestamp`, `path`, `response` |
| Payment-specific | — | HTTP 422 (invalid hash ID), HTTP 502 (provider down) |

---

## Schema renames (equivalent payloads)

| Old schema | Current schema | Notes |
| --- | --- | --- |
| `ExchangeRateRequest` | `CreateExchangeRateDto` | Same fields: `merchantId`, `amount` |
| `ExchangeRateResponse` | `ResponseExchangeRateDto` | Same fields + `updatedDate` |
| `WalletRequest` | `WalletRequestDTO` | Same fields |
| `WalletRequestTransfer` | `WalletTransferRequestDTO` | Same fields |
| `WalletRequestReset` | `WalletResetRequestDTO` | Same fields |
| `WalletResponse` | `WalletResponseDTO` | Same fields |
| `RequestRequest` | `PaymentRequestDto` | Current adds optional `merchantId` |
| `RequestResponse` | `PaymentResponseDto` | Current adds `providerInAppUrl`, `EXPIRED` status |
| `WalletLogItemResponse` | `WalletLogItemResponseDTO` | Equivalent wallet log item |
| `WalletTransferResponse` / `V2` | `WalletTransferResponseDTO` | V1 used `*RequestId`; V2/current use `*LogId` |
| `WalletUpdateResponse` / `V2` | `WalletUpdateResponseDTO` | V1 used `*RequestId`; V2/current use `*LogId` |

---

## Pagination

Both versions return pagination metadata in response headers for list endpoints.
Header names are the same (`X-Total-Count`, `X-Page`, `X-Page-Size`,
`X-Total-Pages`, `X-Has-Next-Page`, `X-Has-Previous-Page`). Only query parameter
casing changed (PascalCase → camelCase).

---

## Quick migration checklist

1. Change base URL from `https://api.wallet.merxall.com` to your new host
   (e.g. `http://localhost:3000`).
2. Replace `/api/v1/` or `/api/v2/` with `/api/` and convert paths to
   kebab-case (see table above).
3. Rename `MindshakerKey` header to `x-wallet-api-key`.
4. Rename `/Request` endpoints and client code to `/payments`.
5. If on old V1, adopt wallet log endpoints (`/wallet/logs`) and update
   transfer/update response parsing from `*RequestId` to `*LogId`.
6. Update query/body parameter casing to camelCase.
7. Add `merchantId` to payment creation when using an admin account.
8. Use `DELETE /api/payments/{id}/cancel` if you need provider-side cancellation.
9. Optionally adopt session auth and user/API-key management for admin UIs.
10. Re-ingest knowledge docs after any client or integration changes.

---

## Related documents

- `wallet-api-faq.md` — full reference for the **current** API
- `wallet-concepts.md` — credits, merchants, exchange rates, logs
- `wallet-faq.md` — common wallet operation questions
