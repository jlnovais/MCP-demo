# MCP Demo

A monorepo for experimenting with the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/). It exposes the MindShaker Wallet API as MCP tools through a NestJS server, plus Claude clients (CLI and web) that connect to the server and call those tools. The server also includes RAG search over a local knowledge base.

## Project structure

```
MCP-demo/
├── apps/
│   ├── mcp-server/    # NestJS app — MCP server (Wallet API + RAG + utilities)
│   └── mcp-client/    # Claude CLI + React/Express web chat client
├── libs/
│   └── api-common/    # Shared config utilities
├── docs/              # Guides (setup, RAG, deploy, Claude Desktop, …)
├── package.json
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ (22 recommended)
- npm 9+
- A running [MindShaker Wallet API](http://localhost:3000/docs) (for Wallet tool calls)
- An [Anthropic API key](https://console.anthropic.com/) (for either client)
- For RAG: a [Voyage AI](https://docs.voyageai.com/) API key and a vector store ([Postgres + pgvector](docs/postgres-knowledge-schema.md) by default, or LanceDB)

## Getting started

For the full walkthrough (env vars, CLI vs web, troubleshooting), see **[docs/getting-started.md](docs/getting-started.md)**.

Quick path from the repository root:

```bash
npm install
cp apps/mcp-server/.env.template apps/mcp-server/.env
cp apps/mcp-client/.env.template apps/mcp-client/.env
```

### mcp-server (`apps/mcp-server/.env`)

| Variable | Description |
| --- | --- |
| `PORT` | MCP server port (default `4000`) |
| `MCP_SERVER_API_KEY` | Key required to call the MCP endpoint (`x-api-key` or `Authorization: Bearer`) |
| `WALLET_API_BASE_URL` | Upstream Wallet API base URL |
| `WALLET_API_KEY` | Wallet API key sent as `x-wallet-api-key` when tools call the upstream API |
| `VOYAGE_API_KEY` | Voyage AI key for `search_knowledge_base` |
| `VOYAGE_EMBED_MODEL` | Embedding model (default `voyage-4`) |
| `VECTOR_STORE` | `postgres` (default) or `lancedb` |
| `CHUNKER` | Default ingest splitter: `sentence` (default), `markdown`, or `html` |
| `CHUNKER_TEXT` / `CHUNKER_HTML` / `CHUNKER_MARKDOWN` / `CHUNKER_PDF` | Optional per-file-type overrides (inherit `CHUNKER` when empty) |
| `POSTGRES_*` | Postgres connection when `VECTOR_STORE=postgres` |
| `LANCEDB_*` | LanceDB path/table when `VECTOR_STORE=lancedb` |

### mcp-client (`apps/mcp-client/.env`)

| Variable | Description |
| --- | --- |
| `ANTHROPIC_API_KEY` | **Required.** Anthropic API key |
| `MCP_SERVER_URL` | MCP server endpoint (default `http://127.0.0.1:4000/mcp/v1`) |
| `MCP_SERVER_API_KEY` | Must match the server's `MCP_SERVER_API_KEY` |
| `CLAUDE_MODEL` | Claude model (default `claude-sonnet-5`) |
| `CLAUDE_MAX_TOKENS` | Max output tokens (default `4096`) |
| `CLAUDE_THINKING_BUDGET` | Extended-thinking budget; set `0` to disable |
| `CLIENT_WEB_PORT` | Web UI port (default `3001`) |
| `CLIENT_WEB_USERNAME` / `CLIENT_WEB_PASSWORD` | **Required for web client** — HTTP Basic Auth |

Start the MCP server (terminal 1):

```bash
npm run start:server:dev
```

When ready, the server prints:

```
MCP server is running on port 4000
MCP endpoint: POST http://localhost:4000/mcp/v1
```

Then start a client (terminal 2):

```bash
npm run start:client          # CLI chat
npm run start:client:web      # Browser UI at http://localhost:3001
```

## Scripts

Run these from the repository root:

| Script | Description |
| --- | --- |
| `npm run start:server` | Start the NestJS MCP server |
| `npm run start:server:dev` | Start the server with hot reload |
| `npm run start:client` | Interactive Claude CLI client |
| `npm run start:client:web` | Web chat UI (dev mode with Vite HMR) |
| `npm run start:client:web:prod` | Web UI serving a pre-built static bundle |
| `npm run build:client:web` | Build the React UI |
| `npm run build` | Build all workspaces |
| `npm run lint` | Lint TypeScript across apps and libs |
| `npm run format` | Format TypeScript with Prettier |
| `npm run test` | Run Jest tests |

You can also run scripts inside a single app with the `-w` flag:

```bash
npm run start:dev -w @mcp-demo/mcp-server
npm run ingest:knowledge -w @mcp-demo/mcp-server
npm run build -w @mcp-demo/mcp-client
```

## Apps

### `@mcp-demo/mcp-server`

A [NestJS](https://nestjs.com/) application that exposes the MindShaker Wallet API as MCP tools over HTTP, plus RAG and date utilities.

- **Port:** `4000` (override with `PORT`)
- **MCP endpoint:** `POST /mcp/v1` (requires `x-api-key` or `Authorization: Bearer`)
- **Source:** `apps/mcp-server/src/`

#### MCP tools

| Category | Tool | Backend |
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
| Knowledge base | `search_knowledge_base` | Semantic search over local docs (RAG) |
| Utilities | `get_current_datetime` | Server UTC datetime |
| | `add_duration_to_datetime` | Shift an ISO datetime by a duration |

Tool registration lives under `apps/mcp-server/src/mcp/tools/`. Each Wallet category has a matching service in `apps/mcp-server/src/mcp/api/`.

The `search_knowledge_base` tool adds Retrieval-Augmented Generation (RAG) over your own documents using LlamaIndex + Voyage AI embeddings + a vector store (Postgres + pgvector by default, or LanceDB). Configure `VOYAGE_API_KEY` and `VECTOR_STORE`, add documents under `apps/mcp-server/knowledge/`, then build the index:

```bash
npm run ingest:knowledge -w @mcp-demo/mcp-server
# optional: markdown header chunking
npm run ingest:knowledge -w @mcp-demo/mcp-server -- --chunker markdown --reset
# offline chunk preview (no Voyage)
npm run compare:chunkers -w @mcp-demo/mcp-server
```

See [docs/rag-knowledge-base.md](docs/rag-knowledge-base.md) for full setup.

### `@mcp-demo/mcp-client`

Claude clients that talk to [Anthropic](https://www.anthropic.com/) and expose the MCP server's tools to the model. Both connect over streamable HTTP, discover tools, and let Claude call them while you chat.

- **CLI:** `npm run start:client` — terminal chat (`apps/mcp-client/src/`)
- **Web:** `npm run start:client:web` — React UI + Express API on port `3001` (`apps/mcp-client/web/`, `apps/mcp-client/src/server.ts`)
- **Transport:** Streamable HTTP to the MCP server (`MCP_SERVER_URL`)

Type a message and press Enter (CLI), or open [http://localhost:3001](http://localhost:3001) (web; Basic Auth from `.env`). Type `exit` or press Ctrl+C to quit the CLI.

## Docs

| Guide | Topic |
| --- | --- |
| [getting-started.md](docs/getting-started.md) | Install, env, start server/clients |
| [testing-mcp-endpoint.md](docs/testing-mcp-endpoint.md) | curl examples for the MCP HTTP API |
| [claude-desktop.md](docs/claude-desktop.md) | Claude Desktop integration |
| [rag-knowledge-base.md](docs/rag-knowledge-base.md) | RAG setup and ingestion |
| [rag-search-and-chunking.md](docs/rag-search-and-chunking.md) | Search and chunking details |
| [postgres-knowledge-schema.md](docs/postgres-knowledge-schema.md) | Postgres + pgvector schema |
| [server-knowledge-ingestion.md](docs/server-knowledge-ingestion.md) | Knowledge ingestion on the server |
| [deploy/DEPLOY.md](docs/deploy/DEPLOY.md) | Deploy with PM2 on Ubuntu |

## Workspaces

This project uses [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces). Dependencies are hoisted to the root `node_modules/`, and each app under `apps/` has its own `package.json`.

## License

ISC
