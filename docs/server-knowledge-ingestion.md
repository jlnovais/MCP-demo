# Server knowledge ingestion and troubleshooting

This guide covers how to add or update RAG documents on a **production Ubuntu
server** (and briefly on your **local PC**), and how to recover when tool calls
fail after ingestion or an `mcp-server` restart.

For RAG architecture and env vars, see [rag-knowledge-base.md](./rag-knowledge-base.md).
For the full deploy workflow, see [deploy/DEPLOY.md](./deploy/DEPLOY.md).

## Overview

The `search_knowledge_base` MCP tool reads from the configured **vector store**
(`VECTOR_STORE=lancedb` or `postgres`). Source documents live as plain files;
ingestion embeds them with Voyage AI and writes the index.

```text
knowledge/*  →  ingest  →  LanceDB or Postgres  →  search_knowledge_base tool
```

Supported extensions: **`.md`**, **`.markdown`**, **`.txt`**, **`.pdf`**, **`.html`**.
Flat folder only (no subfolders).

Postgres mode stores embeddings in the database configured by `POSTGRES_*` (see
[postgres-knowledge-schema.md](./postgres-knowledge-schema.md)).

## Local development (PC)

From the **repo root**, with `VOYAGE_API_KEY` and `VECTOR_STORE` / `POSTGRES_*`
(or LanceDB) set in `apps/mcp-server/.env`:

1. Put documents in `apps/mcp-server/knowledge/`.
2. Ingest:

   ```bash
   npm run ingest:knowledge -w @mcp-demo/mcp-server
   ```

   Full wipe then re-embed everything:

   ```bash
   npm run ingest:knowledge -w @mcp-demo/mcp-server -- --reset
   ```

   Optional custom directory:

   ```bash
   npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs
   npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs --reset
   ```

The script builds the server, then runs the ingest entrypoint. Default mode
**upserts by source** (skips unchanged files by content hash). With Postgres,
embeddings go to whatever DB your `.env` points at (local or remote). Restart
`mcp-server` (and the client if needed) so search picks up the new index.

## Production server

On the server, paths are relative to the mcp-server deploy root
(`/var/www/mcp-server`):

| Path | Purpose |
| --- | --- |
| `knowledge/` | Source documents |
| `data/lancedb/` | LanceDB files when `VECTOR_STORE=lancedb` (from `LANCEDB_PATH`) |
| `dist/apps/mcp-server/mcp/knowledge/ingest.js` | Ingestion entrypoint |

## Prerequisites

In `/var/www/mcp-server/.env`:

```env
VOYAGE_API_KEY=your-voyage-api-key
VOYAGE_EMBED_MODEL=voyage-4
VECTOR_STORE=postgres
POSTGRES_HOST=...
POSTGRES_PORT=5432
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=mcp_knowledge
POSTGRES_TABLE=knowledge_chunks
```

For LanceDB instead:

```env
VECTOR_STORE=lancedb
LANCEDB_PATH=data/lancedb
LANCEDB_TABLE=knowledge
```

`VOYAGE_API_KEY` is required to run ingestion on the server (embeddings are
computed via the Voyage API).

## Add or update documents

### 1. Put files in `knowledge/`

Upload or edit files under:

```text
/var/www/mcp-server/knowledge/
```

You can upload via SCP/WinSCP, or add files in the repo under
`apps/mcp-server/knowledge/` and re-run [`stage-deploy.ps1`](./deploy/stage-deploy.ps1)
so they are copied with the next deploy.

### 2. Run ingestion

From the mcp-server deploy directory:

```bash
cd /var/www/mcp-server
node dist/apps/mcp-server/mcp/knowledge/ingest.js
```

Default mode **upserts by source**: chunks for files in the directory replace
existing rows for those file names; other sources are kept. To wipe all
embeddings first:

```bash
node dist/apps/mcp-server/mcp/knowledge/ingest.js --reset
```

Default input is `knowledge/` under the current working directory. To ingest
from another folder:

```bash
cd /var/www/mcp-server
node dist/apps/mcp-server/mcp/knowledge/ingest.js /path/to/other/docs
node dist/apps/mcp-server/mcp/knowledge/ingest.js /path/to/other/docs --reset
```

On success:

```text
Vector store: postgres
Ingesting knowledge base from: /var/www/mcp-server/knowledge (upsert by source)
Done. Indexed 42 chunks from 5 file(s).
```

### 3. Restart both apps

After ingestion, restart **mcp-server** so it reloads the LanceDB table from
disk:

```bash
pm2 restart mcp-server
```

Then restart **mcp-client**:

```bash
pm2 restart mcp-client
```

Refresh the browser and start a **new chat** if you were already using the web
UI.

### Why restart mcp-client?

The web client opens a single MCP connection when it starts
(`apps/mcp-client/src/server.ts` → `bootstrap()` → `connectMcpClient()`). When
`mcp-server` restarts, its in-memory MCP sessions are cleared. If `mcp-client`
is not restarted, it keeps a **stale session** and tool calls fail (see
[§ Troubleshooting](#troubleshooting) below).

**Recommended order:**

```bash
pm2 restart mcp-server
sleep 2
pm2 restart mcp-client
```

## Alternative: ingest on PC, upload LanceDB

If you prefer not to call Voyage from the server **and** you use
`VECTOR_STORE=lancedb`, run local ingest ([§ Local development](#local-development-pc)),
upload `apps/mcp-server/data/lancedb/` → `/var/www/mcp-server/data/lancedb/`,
then `pm2 restart mcp-server` and `pm2 restart mcp-client`.

With `VECTOR_STORE=postgres`, ingest against the same database the server uses
(no file upload needed).

## Troubleshooting

### `Server not initialized` after ingest

**Symptom** (in the web UI or chat):

```text
Tool error
Error: Streamable HTTP error: Error POSTing to endpoint:
{"jsonrpc":"2.0","error":{"code":-32000,"message":"Bad Request: Server not initialized"},"id":null}
```

**Cause:** this is an **MCP session** error, not a LanceDB or ingestion failure.
It usually appears after `pm2 restart mcp-server` when **mcp-client was not
restarted**. The client still holds an old Streamable HTTP session; the server no
longer recognizes it.

**Fix:**

```bash
pm2 restart mcp-server
sleep 2
pm2 restart mcp-client
```

Then refresh the browser and open a new chat.

**Also check:**

| Check | What to verify |
| --- | --- |
| Startup order | mcp-server must be up before mcp-client starts |
| `MCP_SERVER_URL` | In `/var/www/mcp-client/.env`, use `http://127.0.0.1:4000/mcp/v1` when both apps run on the same host |
| `MCP_SERVER_API_KEY` | Must match `MCP_SERVER_API_KEY` in mcp-server `.env` |
| Client logs | `pm2 logs mcp-client` — avoid “Web client will run without MCP tools” at startup |
| Server logs | `pm2 logs mcp-server` — look for `Transport connected with session id:` after the client restarts |

**Quick MCP test** (bypasses the web client):

```bash
curl -s -D - -X POST "http://127.0.0.1:4000/mcp/v1" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_MCP_SERVER_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}'
```

If this succeeds but the web UI fails, restart mcp-client. More curl examples:
[testing-mcp-endpoint.md](./testing-mcp-endpoint.md).

### Knowledge-specific errors

These are **different** from `Server not initialized` — they come from the tool
handler, not the MCP transport:

| Message (typical) | Fix |
| --- | --- |
| Knowledge base table not found | Run ingestion (LanceDB) or upload `data/lancedb/` |
| Postgres connection / missing env | Check `VECTOR_STORE=postgres` and `POSTGRES_*` in `.env` |
| No `.md`/`.txt` files found | Add files to `knowledge/` |
| Voyage API errors | Check `VOYAGE_API_KEY` in mcp-server `.env` |

### Stale search results after ingest without restart

If ingestion succeeded but answers still use old content, `mcp-server` may still
have a cached connection/table handle. Run `pm2 restart mcp-server`
(and then `pm2 restart mcp-client`).

## Workflow summary

```text
Add .md / .txt files  →  knowledge/
         ↓
node dist/apps/mcp-server/mcp/knowledge/ingest.js   # optional: --reset
         ↓
pm2 restart mcp-server
         ↓
pm2 restart mcp-client
         ↓
Refresh browser, new chat  →  search_knowledge_base uses new content
```

## Related docs

- [rag-knowledge-base.md](./rag-knowledge-base.md) — RAG architecture, local ingest, env vars  
- [postgres-knowledge-schema.md](./postgres-knowledge-schema.md) — Postgres + pgvector schema  
- [deploy/DEPLOY.md](./deploy/DEPLOY.md) — full server deploy and first-time ingestion  
- [testing-mcp-endpoint.md](./testing-mcp-endpoint.md) — curl tests for `POST /mcp/v1`  
- `apps/mcp-server/.env.template` — RAG-related environment variables
