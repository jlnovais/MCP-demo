# Server knowledge ingestion and troubleshooting

This guide covers how to add or update RAG documents on a **production Ubuntu
server**, and how to recover when tool calls fail after ingestion or an
`mcp-server` restart.

For local development and how RAG works, see [rag-knowledge-base.md](./rag-knowledge-base.md).
For the full deploy workflow, see [deploy/DEPLOY.md](./deploy/DEPLOY.md).

## Overview

The `search_knowledge_base` MCP tool reads from a **LanceDB** vector store on
disk. Source documents live as plain files; ingestion embeds them with Voyage AI
and writes the index.

```text
knowledge/*.md  →  ingest.js  →  data/lancedb/  →  search_knowledge_base tool
```

On the server, paths are relative to the mcp-server deploy root
(`/var/www/mcp-server`):

| Path | Purpose |
| --- | --- |
| `knowledge/` | Source `.md` / `.markdown` / `.txt` files |
| `data/lancedb/` | Generated vector store (from `LANCEDB_PATH` in `.env`) |
| `dist/apps/mcp-server/mcp/knowledge/ingest.js` | Ingestion entrypoint |

## Prerequisites

In `/var/www/mcp-server/.env`:

```env
VOYAGE_API_KEY=your-voyage-api-key
VOYAGE_EMBED_MODEL=voyage-3.5
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

Supported extensions: **`.md`**, **`.markdown`**, **`.txt`**.

> **Flat folder only:** ingestion reads files **directly** in `knowledge/`, not
> subfolders. Place all documents in that directory.

You can upload via SCP/WinSCP, or add files in the repo under
`apps/mcp-server/knowledge/` and re-run [`stage-deploy.ps1`](./deploy/stage-deploy.ps1)
so they are copied with the next deploy.

### 2. Run ingestion

From the mcp-server deploy directory:

```bash
cd /var/www/mcp-server
node dist/apps/mcp-server/mcp/knowledge/ingest.js
```

Default input is `knowledge/` under the current working directory. To ingest
from another folder:

```bash
cd /var/www/mcp-server
node dist/apps/mcp-server/mcp/knowledge/ingest.js /path/to/other/docs
```

On success:

```text
Ingesting knowledge base from: /var/www/mcp-server/knowledge
Done. Indexed 42 chunks from 5 file(s).
```

> **Full rebuild:** each run **drops and recreates** the LanceDB table. All
> documents you want indexed must be in the target directory for that run.

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

If you prefer not to call Voyage from the server:

1. Add documents to `apps/mcp-server/knowledge/` locally.
2. From the repo root:

   ```bash
   npm run ingest:knowledge -w @mcp-demo/mcp-server
   ```

3. Upload `apps/mcp-server/data/lancedb/` → `/var/www/mcp-server/data/lancedb/`.
4. `pm2 restart mcp-server` then `pm2 restart mcp-client`.

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
| Knowledge base table not found | Run ingestion or upload `data/lancedb/` |
| No `.md`/`.txt` files found | Add files to `knowledge/` |
| Voyage API errors | Check `VOYAGE_API_KEY` in mcp-server `.env` |

### Stale search results after ingest without restart

If ingestion succeeded but answers still use old content, `mcp-server` may still
have the previous LanceDB table cached in memory. Run `pm2 restart mcp-server`
(and then `pm2 restart mcp-client`).

## Workflow summary

```text
Add .md / .txt files  →  knowledge/
         ↓
node dist/apps/mcp-server/mcp/knowledge/ingest.js
         ↓
pm2 restart mcp-server
         ↓
pm2 restart mcp-client
         ↓
Refresh browser, new chat  →  search_knowledge_base uses new content
```

## Related docs

- [rag-knowledge-base.md](./rag-knowledge-base.md) — RAG architecture, local ingest, env vars  
- [deploy/DEPLOY.md](./deploy/DEPLOY.md) — full server deploy and first-time ingestion  
- [testing-mcp-endpoint.md](./testing-mcp-endpoint.md) — curl tests for `POST /mcp/v1`  
- `apps/mcp-server/.env.template` — RAG-related environment variables
