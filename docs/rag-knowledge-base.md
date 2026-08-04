# RAG knowledge base (`search_knowledge_base`)

This guide explains the Retrieval-Augmented Generation (RAG) feature added to
`@mcp-demo/mcp-server`: a `search_knowledge_base` MCP tool that lets Claude answer
conceptual, policy, and how-to questions from your own documents instead of
relying only on its trained-in knowledge.

## What RAG is (in one line)

Instead of answering purely from memory, the model **retrieves** the most
relevant snippets from your documents, those snippets are **augmented** into the
prompt, and the model then **generates** an answer grounded in them.

## How it works here

The feature is built from three libraries:

| Concern | Library | Notes |
| --- | --- | --- |
| Chunking | [`llamaindex`](https://ts.llamaindex.ai/) | Per-type via `CHUNKER` / `CHUNKER_*` (`sentence`, `markdown`, `html`) |
| Embeddings | [`@llamaindex/voyage-ai`](https://docs.voyageai.com/) | Turns text into vectors (Anthropic's recommended embedding partner) |
| Vector store | Postgres + pgvector **or** LanceDB | Selected with `VECTOR_STORE` in `.env` (`postgres` default; `lancedb` as file-based fallback) |

> **Why a shared interface?** Storage is behind `KnowledgeVectorStore`. Ingest and
> `search_knowledge_base` do not branch on backend. Postgres is the default;
> LanceDB remains available as a file-based fallback when `VECTOR_STORE=lancedb`.

There are two flows:

**1. Ingestion (offline, run when documents change)**

```
docs (.md/.txt/.pdf/.html) → per-type chunker → Voyage (embed) → vector store
```

Default ingest **upserts by source file** (replaces chunks for files in the run).
Pass `--reset` to delete all embeddings first. Choose splitters with `CHUNKER` /
`CHUNKER_*` or force one with `--chunker` (see [Tuning](#tuning)).

**2. Retrieval (at query time, inside the MCP tool)**

```
user query → Voyage (embed query) → vector search → top-k snippets → Claude
```

Claude decides on its own when to call `search_knowledge_base` (agentic RAG),
based on the tool description — you do not need to change the client.

## Files involved

| Path | Responsibility |
| --- | --- |
| `apps/mcp-server/src/mcp/knowledge/knowledge.service.ts` | Chunking, embeddings, `search()` / `ingestFromDirectory()` |
| `apps/mcp-server/src/mcp/knowledge/chunker.ts` | File-type detection + `sentence` / `markdown` / `html` parsers |
| `apps/mcp-server/src/mcp/knowledge/compare-chunkers.ts` | Offline side-by-side chunk preview (no Voyage) |
| `apps/mcp-server/src/mcp/knowledge/vector-store.interface.ts` | Shared store interface + DI token |
| `apps/mcp-server/src/mcp/knowledge/lancedb-vector-store.ts` | LanceDB backend |
| `apps/mcp-server/src/mcp/knowledge/postgres-vector-store.ts` | Postgres + pgvector backend |
| `apps/mcp-server/src/mcp/knowledge/ingest.ts` | Standalone ingestion entrypoint |
| `apps/mcp-server/src/mcp/tools/register-knowledge-tools.ts` | Registers the `search_knowledge_base` tool |
| `apps/mcp-server/knowledge/` | Source documents (`.md` / `.markdown` / `.txt` / `.pdf`) |
| `apps/mcp-server/data/lancedb/` | LanceDB files when `VECTOR_STORE=lancedb` (git-ignored) |

## Prerequisites

1. Install dependencies from the repository root:

   ```bash
   npm install
   ```

2. Get a Voyage AI API key from [voyageai.com](https://www.voyageai.com/) and add
   it to `apps/mcp-server/.env` (see `apps/mcp-server/.env.template`):

   | Variable | Description | Default |
   | --- | --- | --- |
   | `VOYAGE_API_KEY` | Voyage AI API key (**required** for embeddings) | — |
   | `VOYAGE_EMBED_MODEL` | Voyage embedding model | `voyage-3.5` |
   | `VECTOR_STORE` | `postgres` or `lancedb` | `postgres` |
   | `CHUNKER` | Default splitter when a type key is unset | `sentence` |
   | `CHUNKER_TEXT` | `.txt` files | inherits `CHUNKER` |
   | `CHUNKER_HTML` | `.html` files (`html` strips tags) | inherits `CHUNKER` |
   | `CHUNKER_MARKDOWN` | `.md` / `.markdown` | inherits `CHUNKER` |
   | `CHUNKER_PDF` | `.pdf` files | inherits `CHUNKER` |
   | `LANCEDB_PATH` | LanceDB directory (LanceDB mode) | `data/lancedb` |
   | `LANCEDB_TABLE` | LanceDB table name | `knowledge` |
   | `POSTGRES_HOST` / `PORT` / `USER` / `PASSWORD` / `DB` | Postgres connection (Postgres mode) | port `5432` |
   | `POSTGRES_TABLE` | Postgres table name | `knowledge_chunks` |

   > `LANCEDB_PATH` is resolved relative to the process working directory, which
   > is `apps/mcp-server` when you use the `-w @mcp-demo/mcp-server` npm scripts.

   For the Postgres table layout (auto-created), see
   [postgres-knowledge-schema.md](./postgres-knowledge-schema.md).

## Step 1 — Add your documents

Drop plain-text or Markdown files into `apps/mcp-server/knowledge/`. The repo ships
with two samples you can replace:

- `wallet-concepts.md`
- `wallet-faq.md`

Supported extensions: `.md`, `.markdown`, `.txt`, `.pdf`, `html`, `htm`.

## Step 2 — Ingest (build the index)

From the repository root:

```bash
npm run ingest:knowledge -w @mcp-demo/mcp-server
```

Upsert only (default): replaces chunks for source files present in the directory;
leaves other sources in the store untouched.

Full rebuild (delete all embeddings first):

```bash
npm run ingest:knowledge -w @mcp-demo/mcp-server -- --reset
```

To ingest from a different folder:

```bash
npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs
npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs --reset
```

Force one chunker for every file (overrides per-type env):

```bash
npm run ingest:knowledge -w @mcp-demo/mcp-server -- --chunker markdown --reset
```

Side-by-side demo (both chunkers in one store — sources become `file#sentence` /
`file#markdown`):

```bash
npm run ingest:knowledge -w @mcp-demo/mcp-server -- --chunker sentence --tag-chunker
npm run ingest:knowledge -w @mcp-demo/mcp-server -- --chunker markdown --tag-chunker
```

Compare how the same FAQ splits **without** embedding (no Voyage key needed):

```bash
npm run compare:chunkers -w @mcp-demo/mcp-server
npm run compare:chunkers -w @mcp-demo/mcp-server -- knowledge/wallet-faq.md
```

On success you'll see something like:

```
Vector store: postgres
Ingesting knowledge base from: .../apps/mcp-server/knowledge (upsert by source)
Done. Indexed 7 chunks from 2 file(s).
```

> **Note:** ingestion compiles the server first (`npm run build`) and runs the
> compiled output. This is intentional: NestJS dependency injection relies on
> `emitDecoratorMetadata`, which the compiled (tsc) output provides.

## Step 3 — Use it

Start the server:

```bash
npm run start:server:dev
```

Then, from the interactive client (or Claude Desktop), ask a knowledge question,
for example:

- *"What are credits?"*
- *"How do transfers work?"*
- *"What is the refund policy?"*

Claude will call `search_knowledge_base`, receive the top matching snippets, and
answer grounded in them.

## Tool reference

**Name:** `search_knowledge_base`

**Input:**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `query` | string | yes | Natural-language question or search phrase |
| `topK` | integer (1–10) | no | Number of snippets to return (default `4`) |

**Output:** a JSON array of hits, each with:

| Field | Description |
| --- | --- |
| `text` | The matching chunk of source text |
| `source` | File name the chunk came from |
| `chunkIndex` | Position of the chunk within its source file |
| `distance` | Vector distance (lower = more similar) |

### Call it directly with curl

After the MCP handshake (see
[testing-mcp-endpoint.md](./testing-mcp-endpoint.md)), create `search.json`:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_knowledge_base",
    "arguments": { "query": "how do transfers work?", "topK": 3 }
  }
}
```

```bash
curl -X POST "http://localhost:4000/mcp/v1" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-api-key: YOUR_MCP_SERVER_API_KEY" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  --data-binary "@search.json"
```

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `table "knowledge" was not found` | LanceDB mode and you haven't ingested yet — run `npm run ingest:knowledge -w @mcp-demo/mcp-server` |
| Postgres connection / missing env errors | `VECTOR_STORE=postgres` but `POSTGRES_*` vars incomplete — see `.env.template` |
| Dimension mismatch after changing model | Re-ingest with `--reset` (or drop LanceDB / truncate Postgres table) so all vectors share one model |
| `Status code: 401` during ingest/search | `VOYAGE_API_KEY` missing or invalid in `apps/mcp-server/.env` |
| `No .md/.markdown/.txt files found` | The knowledge folder is empty or the path arg is wrong |
| Empty / irrelevant results | Re-ingest after adding docs; try a higher `topK`; ensure query and docs share vocabulary |

## Tuning

Chunking lives in `chunker.ts` / `knowledge.service.ts`. Each file picks a
splitter from its type env, then `CHUNKER`, then `sentence`:

| Setting | Default | Effect |
| --- | --- | --- |
| `CHUNKER` | `sentence` | Fallback for unset type keys / unknown types |
| `CHUNKER_TEXT` / `_HTML` / `_MARKDOWN` / `_PDF` | inherit | Per-extension splitter |
| `sentence` | — | `SentenceSplitter` (512 / 64) |
| `markdown` | — | `MarkdownNodeParser` (`#` / `##`) |
| `html` | — | `HTMLNodeParser` (strip tags / script / style) |
| `--chunker` | off | Force one splitter for the whole ingest run |
| `--tag-chunker` | off | Store source as `fileName#chunker` so splitters can coexist |
| `DEFAULT_TOP_K` | `4` | How many snippets are returned by default |
| `DEFAULT_MODEL` | `voyage-3.5` | Embedding model (overridable via `VOYAGE_EMBED_MODEL`) |

**Demo tip:** `wallet-faq.md` is short enough that `sentence` often yields one
chunk, while `markdown` yields one chunk per `##` section — then search the same
query and compare which sources/snippets come back. For `.html`, prefer
`CHUNKER_HTML=html` so markup is not embedded.

## Related docs

- [Postgres knowledge schema](./postgres-knowledge-schema.md) — pgvector table, index, and ingest semantics
- [Server knowledge ingestion](./server-knowledge-ingestion.md) — add docs on production server, restarts, troubleshooting
- [Testing the MCP endpoint](./testing-mcp-endpoint.md) — curl-based verification
- [Adding the MCP server to Claude Desktop](./claude-desktop.md) — connect a client
- [Voyage AI docs](https://docs.voyageai.com/) — embedding models and limits
- [LanceDB docs](https://lancedb.github.io/lancedb/) — file-based vector store
- [pgvector docs](https://github.com/pgvector/pgvector) — Postgres vector extension
