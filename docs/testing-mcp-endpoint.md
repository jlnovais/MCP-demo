# Testing the MCP endpoint

This guide explains how to verify that `@mcp-demo/mcp-server` is running and how to exercise the MCP endpoint with `curl`.

## Prerequisites

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Configure environment variables in `apps/mcp-server/.env` (see `apps/mcp-server/.env.template`):

   | Variable | Description |
   | --- | --- |
   | `PORT` | MCP server port (default `4000`) |
   | `MCP_SERVER_API_KEY` | Key required to call the MCP endpoint (`x-api-key` header) |
   | `WALLET_API_BASE_URL` | Upstream Wallet API base URL (defaults to `http://localhost:3000`) |
   | `WALLET_API_KEY` | Wallet API key sent as `x-wallet-api-key` when tools call the upstream API |

3. For payment tool calls, the Wallet API must be running and reachable at `WALLET_API_BASE_URL`.

## Start the server

From the repository root:

```bash
npm run start:server:dev
```

When the server is ready, the terminal prints:

```
MCP server is running on port 4000
MCP endpoint: POST http://localhost:4000/mcp/v1
```

NestJS also logs `Nest application successfully started`. The process must stay running while you test.

## 1. Health check (no authentication)

Confirms the NestJS app is listening:

```bash
curl http://localhost:4000/
```

Expected response:

```json
{"message":"Hello World!"}
```

Replace `4000` with your `PORT` value if different.

## 2. MCP handshake

The MCP endpoint is:

```
POST http://localhost:<PORT>/mcp/v1
```

Every MCP request requires:

- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`
- `x-api-key: <MCP_SERVER_API_KEY>` (or `Authorization: Bearer <MCP_SERVER_API_KEY>`)

After the first `initialize` call, subsequent requests in the same session must also include the `mcp-session-id` response header from that call.

### Step 2a — Initialize

Create a file `init.json`:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "curl-test", "version": "1.0.0" }
  }
}
```

Run:

```bash
curl -i -X POST "http://localhost:4000/mcp/v1" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: YOUR_MCP_SERVER_API_KEY" \
  --data-binary "@init.json"
```

On Windows PowerShell, use `curl.exe` if `curl` is aliased to `Invoke-WebRequest`.

A successful response is HTTP `200` with a JSON body similar to:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": { "tools": { "listChanged": true } },
    "serverInfo": { "name": "mindshaker-wallet-mcp", "version": "1.0.0" }
  }
}
```

Copy the `mcp-session-id` value from the response headers for the next steps.

### Step 2b — Send initialized notification

Create `initialized.json`:

```json
{
  "jsonrpc": "2.0",
  "method": "notifications/initialized"
}
```

```bash
curl -X POST "http://localhost:4000/mcp/v1" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: YOUR_MCP_SERVER_API_KEY" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  --data-binary "@initialized.json"
```

### Step 2c — List tools

Create `tools-list.json`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

```bash
curl -X POST "http://localhost:4000/mcp/v1" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: YOUR_MCP_SERVER_API_KEY" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  --data-binary "@tools-list.json"
```

You should see four payment tools:

| Tool | Wallet API operation |
| --- | --- |
| `create_payment` | `POST /api/payments` |
| `list_payments` | `GET /api/payments` |
| `get_payment` | `GET /api/payments/{id}` |
| `cancel_payment` | `DELETE /api/payments/{id}/cancel` |

## 3. Call a payment tool

Create `list-payments.json`:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "list_payments",
    "arguments": {
      "merchantId": "your-merchant-id",
      "page": 1,
      "pageSize": 10
    }
  }
}
```

```bash
curl -X POST "http://localhost:4000/mcp/v1" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: YOUR_MCP_SERVER_API_KEY" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  --data-binary "@list-payments.json"
```

A successful tool result returns JSON in a `content[0].text` field. If `WALLET_API_KEY` is missing or the Wallet API is unreachable, the tool returns an error message in the same field with `"isError": true`.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `Connection refused` | Server not running, or wrong `PORT` |
| `401 Unauthorized` | Missing or incorrect `x-api-key` / `MCP_SERVER_API_KEY` |
| `Not Acceptable: Client must accept both application/json and text/event-stream` | `Accept` header is missing or incomplete |
| `Parse error: Invalid JSON` | Malformed JSON body (common with inline JSON on Windows; use `--data-binary @file.json`) |
| Payment tool errors | `WALLET_API_KEY` not set, Wallet API down, or invalid arguments |

## Quick reference

| Endpoint | Method | Auth |
| --- | --- | --- |
| `/` | `GET` | None |
| `/mcp/v1` | `POST` | `x-api-key` (or `Authorization: Bearer`) |
