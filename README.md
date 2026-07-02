# MCP Demo

A monorepo for experimenting with the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). It exposes the MindShaker Wallet API as MCP tools through a NestJS server, plus an interactive Claude CLI client that connects to the server and calls those tools.

## Project structure

```
MCP-demo/
├── apps/
│   ├── mcp-server/    # NestJS app — MCP server (Wallet API tools)
│   └── mcp-client/    # Interactive Claude CLI client (MCP tool support)
├── libs/
│   └── api-common/    # Shared config utilities
├── docs/              # Testing and integration guides
├── package.json
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (22 recommended)
- npm 9+
- A running [MindShaker Wallet API](http://localhost:3000/docs) (for tool calls that hit the upstream API)

## Getting started

Install dependencies from the repository root:

```bash
npm install
```

Copy and configure environment variables:

```bash
cp apps/mcp-server/.env.template apps/mcp-server/.env
```

| Variable | Description |
| --- | --- |
| `PORT` | MCP server port (default `4000`) |
| `MCP_SERVER_API_KEY` | Key required to call the MCP endpoint (`x-api-key` header) |
| `WALLET_API_BASE_URL` | Upstream Wallet API base URL (default `http://localhost:3000`) |
| `WALLET_API_KEY` | Wallet API key sent as `x-wallet-api-key` when tools call the upstream API |

Start the MCP server:

```bash
npm run start:server:dev
```

When ready, the server prints:

```
MCP server is running on port 4000
MCP endpoint: POST http://localhost:4000/mcp/v1
```

## Scripts

Run these from the repository root:

| Script | Description |
| --- | --- |
| `npm run start:server` | Start the NestJS MCP server |
| `npm run start:server:dev` | Start the server with hot reload |
| `npm run start:client` | Run the interactive Claude CLI client |
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint TypeScript across apps and libs |
| `npm run format` | Format TypeScript with Prettier |

You can also run scripts inside a single app with the `-w` flag:

```bash
npm run start:dev -w @mcp-demo/mcp-server
npm run build -w @mcp-demo/mcp-client
```

## Apps

### `@mcp-demo/mcp-server`

A [NestJS](https://nestjs.com/) application that exposes the MindShaker Wallet API as MCP tools over HTTP.

- **Port:** `4000` (override with `PORT`)
- **MCP endpoint:** `POST /mcp/v1` (requires `x-api-key` or `Authorization: Bearer`)
- **Source:** `apps/mcp-server/src/`

#### MCP tools

| Category | Tool | Wallet API |
| --- | --- | --- |
| Payments | `create_payment` | `POST /api/payments` |
| | `list_payments` | `GET /api/payments` |
| | `get_payment` | `GET /api/payments/{id}` |
| | `cancel_payment` | `DELETE /api/payments/{id}/cancel` |
| Wallets | `update_wallet` | `PUT /api/wallet` |
| | `get_wallet` | `GET /api/wallet/{userId}/{merchantId}` |
| | `transfer_credits` | `PUT /api/wallet/transfer` |
| | `reset_wallets` | `PUT /api/wallet/reset` |
| | `list_wallet_logs` | `GET /api/wallet/logs` |
| | `get_wallet_log` | `GET /api/wallet/logs/{id}` |
| Exchange rate | `upsert_exchange_rate` | `POST /api/exchange-rate` |
| | `get_exchange_rate` | `GET /api/exchange-rate/{merchantId}` |

Tool registration lives under `apps/mcp-server/src/mcp/tools/`. Each category has a matching service in `apps/mcp-server/src/mcp/api/`.

See [docs/testing-mcp-endpoint.md](docs/testing-mcp-endpoint.md) for curl examples and [docs/claude-desktop.md](docs/claude-desktop.md) for Claude Desktop integration.

### `@mcp-demo/mcp-client`

An interactive command-line chat client that talks to [Claude](https://www.anthropic.com/) and exposes the MCP server's tools to the model. It connects to the MCP server over streamable HTTP, discovers the available tools, and lets Claude call them automatically while you chat in the terminal.

- **Source:** `apps/mcp-client/src/`
- **Transport:** Streamable HTTP to the MCP server (`MCP_SERVER_URL`, default `http://127.0.0.1:4000/mcp/v1`)

Configure environment variables:

```bash
cp apps/mcp-client/.env.template apps/mcp-client/.env
```

| Variable | Description |
| --- | --- |
| `ANTHROPIC_API_KEY` | **Required.** Anthropic API key ([console](https://console.anthropic.com/)) |
| `MCP_SERVER_URL` | MCP server endpoint (default `http://127.0.0.1:4000/mcp/v1`) |
| `MCP_SERVER_API_KEY` | Must match the MCP server's `MCP_SERVER_API_KEY` (sent as `x-api-key`) |
| `CLAUDE_MODEL` | Claude model to use (default `claude-sonnet-5`) |

With the MCP server running, start the client:

```bash
npm run start:client
```

Type a message and press Enter to chat. Type `exit` or press Ctrl+C to quit.

## Workspaces

This project uses [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces). Dependencies are hoisted to the root `node_modules/`, and each app under `apps/` has its own `package.json`.

## License

ISC
