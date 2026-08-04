# RAG search and chunking concepts

This guide explains the chunking and retrieval choices used in
`@mcp-demo/mcp-server`, and related concepts (lexical vs vector search, BM25,
Elasticsearch). It complements [rag-knowledge-base.md](./rag-knowledge-base.md).

## What this project uses today

| Stage | Choice |
| --- | --- |
| Chunking | Per-type via `CHUNKER` / `CHUNKER_*` (`sentence`, `markdown`, `html`) |
| Embeddings | Voyage AI (`voyage-3.5`) |
| Search | **Vector / semantic search only** via configured vector store |
| Lexical search | Not implemented |

```text
ingest:  docs → per-type chunker → Voyage (embed) → vector store
query:   user question → Voyage (embed query) → vector search → top-k chunks
```

---

## Lexical search and vectors (brief)

### Lexical search

**Lexical search** matches documents by **words and terms** — how often query
terms appear in the text, how rare those terms are, and document length. It does
not understand meaning or synonyms unless the exact (or stemmed) words overlap.

Examples: SQL `LIKE`, grep, and classic full-text engines (Lucene, Elasticsearch
`match` queries). The standard ranking function for lexical search is **BM25**.

Good at: exact names, API paths, error codes, product IDs, rare keywords.

Weak at: paraphrases (“money back rules” vs “refund policy”) unless those words
appear in the document.

### Vector (semantic) search

A **vector** is a list of numbers (an **embedding**) that represents the
**meaning** of a piece of text in a high-dimensional space. Similar meanings
end up close together.

**Vector search** embeds the query and each document chunk, then finds the
**nearest neighbors** by distance (cosine, L2, etc.). Matching is by meaning, not
exact keywords.

Good at: natural-language questions, concepts, paraphrases, how-to and policy
questions.

Weak at: rare exact tokens (specific header names, version strings) if the
embedding does not align them strongly with the query.

This project uses vector search through **Voyage AI** (embeddings) and
**LanceDB** (storage + `vectorSearch`).

---

## Text splitters (LlamaIndex)

During ingestion, documents are split into **chunks** before embedding. The
factory lives in `chunker.ts`. Each file type can pick a splitter via env
(`CHUNKER_MARKDOWN`, `CHUNKER_HTML`, …) with `CHUNKER` as fallback.

### `SentenceSplitter` (default fallback)

Splits text while respecting structure: paragraphs → sentences → words, with
configurable `chunkSize` and `chunkOverlap`.

```typescript
import { Document, SentenceSplitter } from 'llamaindex';

const splitter = new SentenceSplitter({
  chunkSize: 512,
  chunkOverlap: 64,
});

const nodes = splitter.getNodesFromDocuments([
  new Document({ text: content, metadata: { source: fileName } }),
]);
```

**Best for:** general text, PDF extract, and `.txt` files.

```bash
# .env
CHUNKER=sentence
CHUNKER_TEXT=sentence
CHUNKER_PDF=sentence

# or force for one run
npm run ingest:knowledge -w @mcp-demo/mcp-server -- --chunker sentence
```

### `MarkdownNodeParser`

Splits markdown by **headers** (`#`, `##`, …), preserving section hierarchy in
node metadata (e.g. `"Header_2": "Refund policy"`).

**Best for:** structured markdown FAQs and docs.

```bash
# .env (recommended for .md)
CHUNKER_MARKDOWN=markdown

# or one-off for all files
npm run ingest:knowledge -w @mcp-demo/mcp-server -- --chunker markdown --reset
```

### `HTMLNodeParser`

Strips HTML tags (and typically script/style) into readable text before
embedding. In the current LlamaIndex version this often yields one cleaned
node per page rather than many section chunks — still preferable to embedding
raw markup.

**Best for:** `.html` knowledge files.

```bash
CHUNKER_HTML=html
```

Offline preview (no Voyage):

```bash
npm run compare:chunkers -w @mcp-demo/mcp-server
npm run compare:chunkers -w @mcp-demo/mcp-server -- knowledge/some-page.html
```

To keep **multiple** embeddings of the same file in one store, pass
`--tag-chunker` so sources become `wallet-faq.md#sentence` and
`wallet-faq.md#markdown`.

### `TokenTextSplitter`

Splits by **token count**, not sentence boundaries. Chunks may cut mid-sentence.

**Best for:** when chunk size must align with embedding model token limits.

### `CodeSplitter`

Splits source code by **AST nodes** (functions, classes) via tree-sitter.

**Best for:** ingesting code repositories, not markdown knowledge files.

### `SimpleNodeParser`

Deprecated — use `SentenceSplitter` instead.

### Choosing a splitter

| Splitter | Split strategy | Typical use in this repo |
| --- | --- | --- |
| `SentenceSplitter` | Sentences / paragraphs | `CHUNKER` / `CHUNKER_TEXT` / `CHUNKER_PDF` |
| `MarkdownNodeParser` | Markdown headers | `CHUNKER_MARKDOWN=markdown` |
| `HTMLNodeParser` | Strip HTML tags | `CHUNKER_HTML=html` |
| `TokenTextSplitter` | Token limits | Not wired |
| `CodeSplitter` | AST | Not needed for current docs |

Wired splitters share `getNodesFromDocuments` via `chunker.ts`, so switching
does not change the rest of the ingest pipeline.

---

## BM25

**BM25** (Best Matching 25) is the classic **lexical ranking** algorithm used
by Lucene, Elasticsearch, and many search engines.

For each query term it considers:

- **Term frequency** — how often the term appears in the document (with
  diminishing returns).
- **Inverse document frequency** — rare terms (e.g. product names) score higher
  than common words (“the”, “and”).
- **Document length** — longer documents are normalized so they do not dominate
  results.

BM25 is **keyword-based**, not semantic. Query “refund policy” ranks documents
that contain those words; it does not automatically match “money back rules”
unless similar wording exists.

| | BM25 (lexical) | Vector search (this project) |
| --- | --- | --- |
| Based on | Word overlap | Embedding similarity |
| Strengths | Exact terms, IDs, paths | Paraphrases, concepts |
| Weaknesses | Synonyms, rephrasing | Rare exact tokens |

This project does **not** use BM25 today.

---

## Do I need lexical search in this project?

**Short answer: no — not for the current setup.**

The knowledge base is small (~8 markdown files) and focused on **concepts,
policies, and how-to** content. That fits **semantic / vector search** well.

### Why vector-only is enough for now

- Small corpus — simple LanceDB + Voyage stack, no extra index or merge logic.
- Questions are often natural language, not keyword lookups.
- `search_knowledge_base` is designed for conceptual Wallet API and Mindshaker
  questions, not a large product search UI.

### When to consider adding lexical (or hybrid) search

| Signal | Why lexical helps |
| --- | --- |
| Misses on **exact tokens** | API paths (`DELETE /api/payments/{id}/cancel`), headers (`x-wallet-api-key`) |
| Misses on **rare names** | Client names, people, version strings |
| **Large** or fast-growing corpus | Vector-only recall can drop; keywords anchor exact matches |
| Users search with **short keywords** | e.g. `MindshakerKey`, `v2 swagger` |

### Cheaper improvements before BM25

1. Switch to **`MarkdownNodeParser`** (`CHUNKER_MARKDOWN=markdown`) for
   section-based `.md` files; use **`HTMLNodeParser`** (`CHUNKER_HTML=html`) for
   HTML.
2. Tune **chunk size / overlap** (sentence defaults: 512 / 64).
3. Store richer **metadata** (source file, section title) on each chunk.

Add lexical or hybrid search only when real queries show gaps, or when the
knowledge base grows beyond a small FAQ-style set.

---

## Could Elasticsearch do lexical and semantic search together?

**Yes.** Elasticsearch supports both in one engine and can **combine** them as
**hybrid search**.

| Search type | Elasticsearch feature |
| --- | --- |
| Lexical | `text` fields + analyzers + `match` / `multi_match` (BM25) |
| Semantic | `dense_vector` field + **kNN** search |
| Hybrid | Run both queries and merge rankings (e.g. **RRF** — Reciprocal Rank Fusion, ES 8.8+) |

Example pattern:

1. BM25 query on `title` and `body`.
2. kNN query on the `embedding` field.
3. Merge with RRF or a custom score blend.

### Compared to this project

| | LanceDB + Voyage (today) | Elasticsearch |
| --- | --- | --- |
| Semantic | Yes (`vectorSearch`) | Yes (kNN) |
| Lexical | No | Yes (BM25) |
| Hybrid | No | Yes (RRF, etc.) |
| Operations | File-based, no extra service | Cluster to deploy and maintain |
| Fit for ~8 markdown files | Simple | Usually overkill |

Elasticsearch makes sense when search becomes a **product feature** at scale —
filters, facets, analytics, and strong keyword + semantic recall — not only RAG
over a handful of docs.

---

## With Elasticsearch, do I still need Voyage for embeddings?

**For semantic or hybrid search: yes — you still need something to generate
embeddings.** Elasticsearch stores and searches vectors; it does not create them
by default.

| Component | Role |
| --- | --- |
| **Voyage** (or alternative) | Text → vectors at **ingest** and **query** time |
| **Elasticsearch** | Store text + vectors; run BM25 and/or kNN; merge hybrid results |

### Pipeline with Elasticsearch + Voyage

```text
ingest:  chunk → Voyage embed → index text + dense_vector in Elasticsearch
query:   Voyage embed question → ES kNN (+ optional BM25) → top-k hits
```

Use the **same embedding model** at ingest and query time.

### When you would not need Voyage

- **Lexical-only** Elasticsearch (BM25, no vectors) — no embedding API, but no
  semantic/paraphrase matching either.
- **Replace Voyage** with another provider (OpenAI, Cohere, local models) or
  Elasticsearch **ML inference** (deploy a model in the cluster — different ops
  setup).

### Stack comparison

```text
Today:     Voyage (embed) → LanceDB (vector search only)
With ES:   Voyage (embed) → Elasticsearch (vector + optional BM25)
```

Elasticsearch replaces **LanceDB as the search backend**, not Voyage as the
embedder — unless you go lexical-only or use Elasticsearch-hosted models
instead.

---

## See also

- [rag-knowledge-base.md](./rag-knowledge-base.md) — setup, ingest, and tool usage
- [server-knowledge-ingestion.md](./server-knowledge-ingestion.md) — production ingest and troubleshooting
- [LlamaIndex node parsers](https://developers.llamaindex.ai/typescript/framework/modules/data/ingestion_pipeline/transformations/node-parser/)
- [Voyage AI docs](https://docs.voyageai.com/)
- [Elasticsearch hybrid search](https://www.elastic.co/guide/en/elasticsearch/reference/current/knn-search.html)
