# Postgres knowledge schema (pgvector)

This document describes the PostgreSQL + [pgvector](https://github.com/pgvector/pgvector)
schema used when `VECTOR_STORE=postgres` in `apps/mcp-server/.env`.

The schema is **created automatically** on first ingest (or first search that needs
it). You do not need to run DDL by hand unless you prefer to provision it yourself.

For how RAG works in this project, see [rag-knowledge-base.md](./rag-knowledge-base.md).

## When this schema is used

Set in `apps/mcp-server/.env`:

```env
VECTOR_STORE=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=
POSTGRES_DB=mcp_knowledge
POSTGRES_TABLE=knowledge_chunks
```

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `VECTOR_STORE` | no | `postgres` | `postgres` (default) or `lancedb` |
| `POSTGRES_HOST` | yes (when postgres) | — | Server hostname |
| `POSTGRES_PORT` | no | `5432` | Server port |
| `POSTGRES_USER` | yes | — | Username |
| `POSTGRES_PASSWORD` | no | empty | Password (empty allowed for local auth) |
| `POSTGRES_DB` | yes | — | Database name (must already exist) |
| `POSTGRES_TABLE` | no | `knowledge_chunks` | Table name for chunks + embeddings |

> The **database** (`POSTGRES_DB`) must already exist. The app creates the
> `vector` extension and the knowledge **table** inside that database.

## Extension

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Requires the [pgvector](https://github.com/pgvector/pgvector) extension to be
installed on the Postgres server.

## Table

Default name: `knowledge_chunks` (override with `POSTGRES_TABLE`).

```sql
CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  source TEXT NOT NULL,
  chunk_index INT NOT NULL,
  embedding vector(N) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, chunk_index)
);
```

| Column | Type | Description |
| --- | --- | --- |
| `id` | `BIGSERIAL` | Surrogate primary key |
| `text` | `TEXT` | Chunk content returned by `search_knowledge_base` |
| `source` | `TEXT` | Source file name (e.g. `wallet-faq.md`) |
| `chunk_index` | `INT` | Zero-based position of the chunk within that file |
| `embedding` | `vector(N)` | Voyage embedding for the chunk |
| `created_at` | `TIMESTAMPTZ` | When this row was inserted (DB-only; not returned by search) |
| `updated_at` | `TIMESTAMPTZ` | When this row was last written (DB-only; not returned by search) |

These timestamps are set by Postgres defaults on insert. They are **not** exposed
through the MCP tool or `KnowledgeService` — they exist for ops/audit queries.

> **Upsert-by-source note:** ingest deletes existing rows for a source, then
> inserts new ones. After a re-ingest of that file, both `created_at` and
> `updated_at` reflect the new insert time (the previous rows are gone).

### Dimension `N`

`N` is fixed when the table is first created. It matches the embedding size of
the Voyage model configured by `VOYAGE_EMBED_MODEL` at that moment (for example
`voyage-4`).

If you change the embedding model to one with a different dimension:

1. Re-ingest with `--reset` so the table can be rebuilt, **or**
2. Drop the table manually and ingest again.

The store refuses to write/search when the existing `vector(N)` does not match
the current model’s dimensions.

## Index

```sql
CREATE INDEX IF NOT EXISTS knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks
  USING hnsw (embedding vector_cosine_ops);
```

- Index type: **HNSW** (approximate nearest neighbor)
- Operator class: `vector_cosine_ops` (cosine distance)

Search orders by cosine distance:

```sql
SELECT text, source, chunk_index, (embedding <=> $1::vector) AS distance
FROM knowledge_chunks
ORDER BY embedding <=> $1::vector
LIMIT $2;
```

Lower `distance` means more similar. The MCP tool returns this value as
`distance` on each hit (same field name as the LanceDB backend).

## Ingest behavior

| Mode | CLI | Effect |
| --- | --- | --- |
| Upsert by source (default) | `npm run ingest:knowledge -w @mcp-demo/mcp-server` | For each source file in the run: `DELETE` existing rows with that `source`, then `INSERT` new chunks. Other sources are left untouched. |
| Full reset | `... -- --reset` | `TRUNCATE` the table, then insert all chunks from the directory. |

Implementation lives in
`apps/mcp-server/src/mcp/knowledge/postgres-vector-store.ts`.

## Manual inspection

```sql
-- Row counts per source (with latest ingest time)
SELECT
  source,
  COUNT(*) AS chunks,
  MIN(created_at) AS first_chunk_at,
  MAX(updated_at) AS last_written_at
FROM knowledge_chunks
GROUP BY source
ORDER BY source;

-- Sample a few rows (embeddings omitted)
SELECT id, source, chunk_index, created_at, updated_at, LEFT(text, 80) AS preview
FROM knowledge_chunks
ORDER BY source, chunk_index
LIMIT 20;
```

## Related docs

- [rag-knowledge-base.md](./rag-knowledge-base.md) — RAG overview and local ingest
- [server-knowledge-ingestion.md](./server-knowledge-ingestion.md) — production ingest workflow
- [pgvector docs](https://github.com/pgvector/pgvector) — operators, indexes, and types
