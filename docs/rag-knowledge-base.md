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
| Chunking | [`llamaindex`](https://ts.llamaindex.ai/) | `SentenceSplitter` splits documents into overlapping chunks |
| Embeddings | [`@llamaindex/voyage-ai`](https://docs.voyageai.com/) | Turns text into vectors (Anthropic's recommended embedding partner) |
| Vector store | [`@lancedb/lancedb`](https://lancedb.github.io/lancedb/) | Embedded, file-based vector database — no external service to run |

> **Why LanceDB directly?** LlamaIndex.TS has no LanceDB adapter (it exists only
> in the Python SDK), so we use LlamaIndex for chunking + the Voyage embedding
> wrapper, and talk to `@lancedb/lancedb` directly for storage and search.

There are two flows:

**1. Ingestion (offline, run when documents change)**

```
docs (.md/.txt) → SentenceSplitter (chunk) → Voyage (embed) → LanceDB table
```

**2. Retrieval (at query time, inside the MCP tool)**

```
user query → Voyage (embed query) → LanceDB vectorSearch → top-k snippets → Claude
```

Claude decides on its own when to call `search_knowledge_base` (agentic RAG),
based on the tool description — you do not need to change the client.

## Files involved

| Path | Responsibility |
| --- | --- |
| `apps/mcp-server/src/mcp/knowledge/knowledge.service.ts` | `KnowledgeService`: `search()` and `ingestFromDirectory()` |
| `apps/mcp-server/src/mcp/knowledge/ingest.ts` | Standalone ingestion entrypoint |
| `apps/mcp-server/src/mcp/tools/register-knowledge-tools.ts` | Registers the `search_knowledge_base` tool |
| `apps/mcp-server/knowledge/` | Source documents (`.md` / `.markdown` / `.txt`) |
| `apps/mcp-server/data/lancedb/` | Generated vector store (git-ignored) |

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
   | `LANCEDB_PATH` | Where LanceDB stores its files | `data/lancedb` |
   | `LANCEDB_TABLE` | Table name for the knowledge vectors | `knowledge` |

   > `LANCEDB_PATH` is resolved relative to the process working directory, which
   > is `apps/mcp-server` when you use the `-w @mcp-demo/mcp-server` npm scripts.

## Step 1 — Add your documents

Drop plain-text or Markdown files into `apps/mcp-server/knowledge/`. The repo ships
with two samples you can replace:

- `wallet-concepts.md`
- `wallet-faq.md`

Supported extensions: `.md`, `.markdown`, `.txt`.

## Step 2 — Ingest (build the index)

From the repository root:

```bash
npm run ingest:knowledge -w @mcp-demo/mcp-server
```

To ingest from a different folder, pass a path:

```bash
npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs
```

On success you'll see something like:

```
Ingesting knowledge base from: .../apps/mcp-server/knowledge
Done. Indexed 7 chunks from 2 file(s).
```

This (re)creates the LanceDB table at `LANCEDB_PATH`. Re-run it whenever your
documents change — it drops and rebuilds the table each time.

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
| `table "knowledge" was not found` | You haven't ingested yet — run `npm run ingest:knowledge -w @mcp-demo/mcp-server` |
| `Status code: 401` during ingest/search | `VOYAGE_API_KEY` missing or invalid in `apps/mcp-server/.env` |
| `No .md/.markdown/.txt files found` | The knowledge folder is empty or the path arg is wrong |
| Empty / irrelevant results | Re-ingest after adding docs; try a higher `topK`; ensure query and docs share vocabulary |
| Dimension / mismatch errors after changing model | `VOYAGE_EMBED_MODEL` changed — delete `data/lancedb` and re-ingest so all vectors share one model |

## Tuning

Chunking and defaults live in `knowledge.service.ts`:

| Constant | Default | Effect |
| --- | --- | --- |
| `DEFAULT_CHUNK_SIZE` | `512` | Larger = more context per chunk, fewer chunks |
| `DEFAULT_CHUNK_OVERLAP` | `64` | Overlap preserves context across chunk boundaries |
| `DEFAULT_TOP_K` | `4` | How many snippets are returned by default |
| `DEFAULT_MODEL` | `voyage-3.5` | Embedding model (overridable via `VOYAGE_EMBED_MODEL`) |

## Related docs

- [Testing the MCP endpoint](./testing-mcp-endpoint.md) — curl-based verification
- [Adding the MCP server to Claude Desktop](./claude-desktop.md) — connect a client
- [Voyage AI docs](https://docs.voyageai.com/) — embedding models and limits
- [LanceDB docs](https://lancedb.github.io/lancedb/) — vector store internals
