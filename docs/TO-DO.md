Here’s how those course topics map onto **this MCP-demo repo** (NestJS MCP server + Claude CLI/web client + RAG).

---

## Already implemented (in code / docs)

### Accessing Claude with the API
| Topic | Evidence |
| --- | --- |
| Accessing the API | Anthropic SDK in `bootstrap.ts` / `chat-engine.ts` |
| Getting an API key | `ANTHROPIC_API_KEY` + README / getting-started |
| Making a request | `messages.create` (classifier) + `beta.messages.toolRunner` (main chat) |
| Multi-turn conversations | Session message history (CLI + web) |
| System prompts | `system-prompt.ts` (`buildSystemPrompt`, scope policy, examples) |
| Temperature | Env + web presets (`Precise` / `Creative` / `Think hard`) via `claude-sampling.ts` |
| Response streaming | `stream: true` + SSE to the web UI |
| Structured data | Charts + `format_wallet_summary` / `format_payments_report` + Structured toggle (wallet + payment reports; **not RAG**); Zod on MCP tools; classifier label |

### Prompt engineering techniques
Used in the live system prompt (not as a separate “course module”):
- Clear & direct, specific scope rules
- Few-shot **EXAMPLES**
- **XML-tag structure** via `BASE_POLICY_XML` (`<scope>`, `<rules>`, `<examples>`, …); `SYSTEM_PROMPT_FORMAT=xml|markdown` (xml default). Markdown headers still available as an alternate.

### Tool use with Claude
| Topic | Status |
| --- | --- |
| Tool use, functions, schemas | MCP tools registered with Zod (`register-*-tools.ts`) |
| Message blocks / tool results | `toolRunner` + `tool_use` / `tool_result` handling in `chat-engine.ts` |
| Multi-turn + multiple tools | Full agentic loop over Wallet, dates, knowledge tools |
| Fine-grained tool calling / text edit / web search | **Not** present |

### RAG and Agentic Search
| Topic | Status |
| --- | --- |
| RAG intro + full flow | Ingest → embed → vector search → Claude grounds answers |
| Chunking | Per-type `CHUNKER` / `CHUNKER_*` (`sentence` \| `markdown` \| `html`); default SentenceSplitter 512 / 64; `compare:chunkers` + unit tests |
| Embeddings | Voyage AI |
| Implementing RAG | `knowledge.service.ts` + `search_knowledge_base` |
| Agentic search | Model chooses when to call the tool |
| BM25 / multi-index | **Not** implemented (docs explicitly say vector-only) |

### Features of Claude
| Topic | Status |
| --- | --- |
| Extended thinking | `CLAUDE_THINKING_BUDGET` + streamed thinking blocks + web **Think hard** preset |
| Prompt caching (+ rules / in action) | `cache_control`, TTL env, HIT/WRITE UI stats |
| PDF support | **Ingest-only** (`pdf-parse` into RAG), not Claude’s native PDF API |
| Citations | Soft: tool returns `source` and prompt says to cite — **not** Citations API |
| Image / code execution / Files API | **Not** present |

### Model Context Protocol
| Topic | Status |
| --- | --- |
| MCP intro, clients, setup | Core of the repo |
| Defining tools | Many Wallet / utility / knowledge tools |
| Implementing a client | CLI + web MCP client |
| Defining prompts | `create_mb_payment`, `create_mbway_payment`, `create_and_verify_mbway_payment`, `cancel_payment_workflow` via `registerPrompt` |
| Server inspector | Covered via curl / testing docs (not a built-in Inspector UI) |
| Prompts **in the client** | **Done** — web `PromptPicker` + `/prompts` API; CLI `/prompts` and `/prompt <name>` |
| Defining / accessing **resources** | **Done** — `wallet://docs/{file}` via `registerKnowledgeResources`; web `ResourcePicker` + `/api/resources`; CLI `/resources` / `/resource` |

### Anthropic apps
| Topic | Status |
| --- | --- |
| Enhancements with MCP / Claude Desktop | `docs/claude-desktop.md` |
| Claude Code setup / in action / computer use | Outside this codebase |

### Agents and workflows
| Topic | Status |
| --- | --- |
| Agents + tools | Agentic tool loop (`toolRunner`) |
| Routing (light) | Scope classifier before the main turn |
| Chaining (prompt-guided) | **Partial** — `create_and_verify_mbway_payment`, `cancel_payment_workflow` |
| Parallelization / env inspection / formal workflow engine | **Not** as first-class demos |

### Prompt evaluation
**No** course-style eval harness (no golden datasets or model/code graders for scope/RAG). Unit tests cover dates utilities and the knowledge **chunker** (`chunker.spec.ts`).

---

## Good demo candidates for *this* project

These fit the existing Wallet + MCP + RAG stack without forcing a new product:

### High fit (natural extensions)
1. **MCP resources** ✅ — `wallet://docs/{file}` knowledge docs; web picker + CLI `/resources` / `/resource`  
2. **Prompts in the client** ✅ — web picker + CLI `/prompts` / `/prompt`  
3. **BM25 or hybrid search** — docs already sketch this; good RAG lesson  
4. **Multi-index RAG** — separate Wallet vs Mindshaker indexes (or Postgres vs LanceDB side-by-side)  
5. **Alternate chunkers** ✅ — per-type `CHUNKER_*`, `compare:chunkers`, unit tests  
6. **Prompt eval harness** — golden Q&A for scope classifier + “did RAG cite the right source?” (code + model grading)  
7. **XML-structured system prompts** ✅ — `SYSTEM_PROMPT_FORMAT=xml|markdown`  
8. **Richer structured outputs** ✅ — charts + wallet/payment report tools + Structured UI/env (**not for RAG**)  
9. **Temperature / thinking comparison** ✅ — Precise / Creative / Think hard presets in the web UI  
10. **Explicit workflows** 🟡 — chaining prompts done (`create_and_verify_mbway_payment`, `cancel_payment_workflow`); single-step create prompts (`create_mb_payment`, `create_mbway_payment`); routing/parallel still open

### Medium fit
11. **Anthropic Citations API** on RAG answers  
12. **Image support** — upload receipt/screenshot into chat  
13. **Native PDF to Claude** (vs current ingest-only PDF)  
14. **Fine-grained `tool_choice`** — force `search_knowledge_base` or a specific wallet tool  
15. **Web search / text editor built-in tools** — optional Anthropic tools alongside MCP tools  
16. **Claude Code + this MCP server** — doc/demo of using the same server from Claude Code  

### Poor / awkward fit for a Wallet MCP demo
- Computer use (desktop automation)  
- Code execution + Files API (unless you invent a sandbox side-quest)  

---

## Quick scoreboard

| Section | Mostly here? | Best next demos |
| --- | --- | --- |
| Accessing Claude API | Yes | — |
| Prompt evaluation | No | Scope + RAG eval suite |
| Prompt engineering | Yes (XML + markdown) | Optional A/B of formats; eval harness |
| Tool use | Yes (custom MCP) | `tool_choice`, built-in Anthropic tools |
| RAG / agentic search | Yes (vector only; multi-chunker) | BM25/hybrid, multi-index |
| Claude features | Partial | Images, Citations API, native PDF |
| MCP | Yes (tools + prompts + resources + client UX) | — |
| Anthropic apps | Docs only | Claude Code wiring |
| Agents / workflows | Partial (agentic loop + chaining prompts) | Clearer routing + parallel demos |

**Bottom line:** the project already is a strong demo of **Claude API + streaming + system prompts (XML/markdown) + multi-turn tool use + MCP tools/prompts/resources/client + agentic RAG (multi-chunker) + extended thinking + sampling presets + structured wallet summaries + prompt caching**. The biggest gaps that still fit cleanly as demos are **prompt evals**, **hybrid/multi-index RAG**, and a few **Claude features** (images, citations, native PDF).

---

# Better explanation

Here’s a clearer take on each high-fit demo — what it is, what you already have, and what a demo would look like in this repo.

---

### 1. MCP resources ✅ — Already implemented
**What it is:** MCP has three primitives: tools (actions), prompts (reusable message templates), and **resources** (read-only data the client can fetch — files, docs, configs).

**Today:** `registerKnowledgeResources` exposes `apps/mcp-server/knowledge` text docs as `wallet://docs/{filename}` (`.md` / `.txt` / `.html`). Web UI has `ResourcePicker` (list → preview → inject). CLI supports `/resources` and `/resource <uri|name>`. API: `GET /api/resources`, `POST /api/resources/read`. Optional `KNOWLEDGE_DIR` overrides the docs path. Client prompts (#2) are also implemented.

**Demo (done):** Open Resources → pick `wallet-faq.md` → preview → Insert into chat (or Claude Desktop list/read the same URIs).

---

### 2. Prompts in the client ✅ — Already implemented
**What it is:** Server-defined prompt templates with args that expand into ready-made user messages.

**Today:** `registerPrompt` for `create_mb_payment` and `create_mbway_payment`, plus chaining prompts `create_and_verify_mbway_payment` and `cancel_payment_workflow`. Web UI has `PromptPicker` (list → fill args → inject message). CLI supports `/prompts` and `/prompt <name>`. API: `GET /api/prompts`, `POST /api/prompts/get`.

**Demo (done):** Choose MB or MB WAY payment → fill args (e.g. `userId`, `amount`, phone for MB WAY) → inject the filled prompt into the conversation.

---

### 3. BM25 or hybrid search ⏳
**What it is:** **BM25** = keyword ranking (exact tokens, IDs, paths). **Hybrid** = combine BM25 scores with vector similarity.

**Today:** Voyage embeddings + Postgres/LanceDB vector search only. Docs already say BM25 isn’t implemented and when it would help.

**Demo:** Add lexical search (e.g. Postgres `tsvector` or a small BM25 index) and merge with vector hits — or a `mode: semantic | lexical | hybrid` on `search_knowledge_base`. Great contrast: “refund policy” (semantic) vs `x-wallet-api-key` / `DELETE /api/payments/...` (lexical).

---

### 4. Multi-index RAG ⏳
**What it is:** Separate indexes (or collections) for different corpora, then route or search both.

**Today:** One table/collection for all of `knowledge/` (Wallet + Mindshaker mixed). Backends are selectable (`VECTOR_STORE=postgres` **or** `lancedb`), not separate corpora.

**Demo:** Two indexes — e.g. `wallet-docs` and `mindshaker-docs` — and either:
- Claude picks which tool/index to query, or  
- one tool that searches both and tags hits by corpus  

Shows scaling RAG beyond a single bag of chunks (course “multi-index pipeline”).

---

### 5. Alternate chunkers ✅ — Already implemented
**What it is:** How you split docs before embedding changes retrieval quality.

**Today:** Per-type env (`CHUNKER`, `CHUNKER_TEXT` / `_HTML` / `_MARKDOWN` / `_PDF`)
with values `sentence` | `markdown` | `html`. CLI `--chunker` / `--tag-chunker`.
Offline preview via `npm run compare:chunkers`. Unit tests in `test/mcp-server/knowledge/chunker.spec.ts`.

**Demo (done):** Ingest / compare the same FAQ with SentenceSplitter vs MarkdownNodeParser vs HTMLNodeParser.

---

### 6. Prompt eval harness ⏳
**What it is:** A repeatable test set + scoring for prompts/behavior — not a one-off chat check.

**Today:** Scope classifier + rich system prompt, but no automated eval harness (unit tests exist for dates + chunker only).

**Demo:** A small script/dataset, e.g.:
- **Scope:** user messages → expect `IN_SCOPE` / `OUT_OF_SCOPE` (code grading: exact label)
- **RAG:** questions → expect keywords or source files in the answer (code and/or model grading)

Print pass rate. Turns “prompt engineering” into something you can measure when you change the system prompt.

---

### 7. XML-structured system prompts ✅ — Already implemented
**What it is:** Anthropic often recommends wrapping sections in XML-like tags (`<scope>`, `<rules>`, `<examples>`) so the model separates instructions cleanly.

**Today:** `BASE_POLICY_XML` is the default (`SYSTEM_PROMPT_FORMAT=xml`). Markdown (`BASE_POLICY_MARKDOWN`) remains available via `SYSTEM_PROMPT_FORMAT=markdown`.

**Demo (done):** Same rules, two shapes — switch with env; optional A/B still possible.

---

### 8. Richer structured outputs ✅ — Already implemented (wallet + payment reports; not RAG)
**What it is:** Force (or opt into) a fixed JSON schema for answers, not free prose.

**Today:**
- Soft charts: `chart` fenced blocks + `ChartBlock`
- Opt-in MCP tool `format_wallet_summary` → fixed `{ userId, merchantId, credits, currency, fetchedAt, ok, error? }`
- Opt-in MCP tool `format_payments_report` → fixed aggregation `{ totalCount, byType[], byStatus[], amountTotal, creditsTotal, … }` over a date range (pages `list_payments`)
- Strict mode: env `STRUCTURED_OUTPUT_STRICT` (default false) + web **Structured** On/Off toggle; when on:
  - wallet balance/summary → must call `format_wallet_summary` + `wallet_summary` fence (`WalletSummaryBlock`)
  - payment reports / summaries by type/status/date → must call `format_payments_report` + `payments_report` fence (`PaymentsReportBlock`); chart still allowed as a companion

**Not for RAG (by design, for now):** This feature does **not** apply to knowledge-base / `search_knowledge_base` answers. RAG remains free-form prose grounded in retrieved chunks. Structured mode is for **wallet summaries and payment reports** only.

**Why not RAG now**
- The current demo teaches a clear pattern: **API/tool → fixed schema** (ledger-style data). Mixing that with “answer + citations” would blur the lesson.
- Wallet/payment reports have small, stable field sets. RAG answers vary by question; a useful schema needs `answer`, `sources[]`, maybe confidence — different product surface.
- Soft citations already exist (tool hits include `source`; the system prompt asks Claude to cite). Forcing JSON for every knowledge question would hurt normal chat UX unless we add a separate RAG-strict mode.
- A RAG structured path overlaps with later demos: **#6 prompt eval** (grade sources) and **#11 Citations API**.

**What you’d need to implement structured RAG later**
1. A schema, e.g. `{ answer, sources: [{ file, excerpt?, score? }], confidence? }` — either a dedicated tool that wraps search + formats, or a `rag_answer` fenced block contract in the system prompt.
2. A separate control (env/UI), e.g. `STRUCTURED_RAG_STRICT`, so wallet/payment Structured and RAG Structured don’t collide.
3. UI to render sources (clickable doc names / excerpts), similar to `WalletSummaryBlock` / `PaymentsReportBlock`.
4. Optional: feed into **#6** (assert expected sources) or **#11** (Anthropic Citations API) instead of a homemade fence.

**Real-world scenarios where structured RAG shines**
- Support / helpdesk UIs that show the answer beside “see also” document links  
- Compliance / audit trails that must record which docs grounded a reply  
- Downstream bots (Slack, tickets, CRM) that parse JSON instead of scraping prose  
- Automated eval (“did we cite `wallet-faq.md`?”) when changing prompts or chunkers  

**Demo (done):**
- Structured On → wallet summary with `userId` + `merchantId` → `format_wallet_summary` + summary card  
- Structured On → “sumário dos pedidos… por tipo… últimos 3 meses” → `format_payments_report` + payments report card (optional chart)  
- Structured Off / RAG questions → free-form (or chart) as before

---

### 9. Temperature / thinking comparison ✅ — Already implemented
**What it is:** Sampling (`temperature`) vs extended thinking (`thinking.budget_tokens`) change creativity vs deliberation.

**Today:** Web UI segmented control with **Precise** (temp 0), **Creative** (temp 1), and **Think hard** (extended thinking; API ignores custom temperature). Per-session preset; sent as `preset` on each chat turn. Budget still from `CLAUDE_THINKING_BUDGET` (default 1024 when enabling Think hard). CLI still uses env sampling / thinking.

**Demo (done):** Ask the same multi-step payment or knowledge question under Precise, then Creative, then Think hard — no `.env` edits.

**Already / not yet:**
- ✅ Done: Precise / Creative / Think hard presets in the web toolbar; `resolveTurnSampling` in `claude-sampling.ts`; `streamChatTurn` accepts `preset`; config exposes `samplingPresets` + `defaultSamplingPreset`
- ✅ Done: thinking streams + budget from env when Think hard is selected
- CLI: still env-based (no preset commands) — acceptable for this demo

---

### 10. Explicit workflows 🟡
**What it is:** Fixed multi-step patterns vs a free agent loop:
- **Routing** — classify then send to the right path  
- **Chaining** — step A → B → C  
- **Parallelization** — run independent steps together  

**Today:** One agentic `toolRunner` loop. Light routing via the scope classifier. Single-step create prompts (`create_mb_payment`, `create_mbway_payment`) and **chaining demos** exist as MCP prompts (still prompt-guided, not a code-enforced engine).

**Demo ideas that reuse Wallet tools:**
- **Routing:** out-of-scope refuse vs RAG vs wallet tools (you’re halfway there)  
- **Chaining:** ✅ `create_and_verify_mbway_payment` (create → get → report) and `cancel_payment_workflow` (list → get → cancel) in `register-payments-prompts.ts`; also single-step `create_mb_payment` / `create_mbway_payment`  
- **Parallel:** e.g. `get_wallet` + `get_exchange_rate` + `search_knowledge_base` in one turn and explain when the model parallelizes tool calls  

Frames “agent vs workflow” using tools you already have.

---

### How they relate

| # | Teaches | Touches mainly |
| --- | --- | --- |
| 1–2 | MCP beyond tools | `mcp-server` + client UI |
| 3–5 | RAG depth | `knowledge/*` |
| 6–7 | Prompt quality | `system-prompt` + new eval script |
| 8–9 | Claude API control | `chat-engine` / web UI |
| 10 | Agents vs workflows | Classifier + tool loop |

**Short path status:** **#1**, **#2**, **#5**, **#7**, **#8**, and **#9** are done. Next high-value gaps: **#3/#6** hybrid search or eval harness.

---

## Progress update (what has already been done)

Status check against the high-fit demos and related work found in the repo (commits + current working tree).

### High-fit demos — done

| # | Demo | Status | Evidence |
| --- | --- | --- | --- |
| **1** | MCP resources | **Done** | `registerKnowledgeResources` → `wallet://docs/{file}`; web `ResourcePicker` + `/api/resources` / `/api/resources/read`; CLI `/resources` and `/resource <uri\|name>`. |
| **2** | Prompts in the client | **Done** | Web `PromptPicker` + `/api/prompts` / `/api/prompts/get`; CLI `/prompts` and `/prompt <name>`. Commit `3eca3fe`. |
| **7** | XML-structured system prompts | **Done** | `BASE_POLICY_XML` with `<scope>`, `<rules>`, `<examples>`, etc.; `SYSTEM_PROMPT_FORMAT=xml\|markdown` (xml default). In `system-prompt.ts` + `.env.template`. |
| **5** | Alternate chunkers | **Done** | Per-type `CHUNKER_*` + `html` (`HTMLNodeParser`); `compare:chunkers`; `chunker.ts`; unit tests in `test/mcp-server/knowledge/chunker.spec.ts`. |
| **8** | Richer structured outputs | **Done** | Charts + `format_wallet_summary` + `format_payments_report` + `STRUCTURED_OUTPUT_STRICT` / web Structured toggle + `wallet_summary` / `payments_report` UI. **Not used for RAG**. |
| **9** | Temperature / thinking comparison | **Done** | Web presets Precise / Creative / Think hard (`preset` → `resolveTurnSampling` → `streamChatTurn`). Thinking budget from `CLAUDE_THINKING_BUDGET`. CLI remains env-based. |

### High-fit demos — still open

| # | Demo | Notes |
| --- | --- | --- |
| **3** | BM25 / hybrid search | Still vector-only |
| **4** | Multi-index RAG | Still one corpus; backends are selectable (Postgres **or** LanceDB), not separate Wallet vs Mindshaker indexes |
| **6** | Prompt eval harness | Still no datasets / graders for scope or RAG (chunker + dates unit tests only) |
| **10** | Explicit workflows | **Partially done** — create prompts (`create_mb_payment`, `create_mbway_payment`) + chaining MCP prompts (`create_and_verify_mbway_payment`, `cancel_payment_workflow`). Routing still light classifier only; parallel demo still open. |

### Other related work already landed (not in the original high-fit list)

- **Postgres + pgvector** vector store (`VECTOR_STORE=postgres` default; LanceDB fallback) — commit `b3124d3`; schema docs in `docs/postgres-knowledge-schema.md`
- **Incremental knowledge ingestion** with per-source `content_hash` / `contentHash` (skip unchanged files; hash includes chunker so `CHUNKER_*` changes invalidate) — commit `40bee6c`
- **Anthropic prompt caching** + cache HIT/WRITE UI stats — commits `bae79bb`, `8d099cf`
- **Claude sampling parameters** (temperature / top_p / top_k) via env — commit `012da60`
- **Tool-result naming in the UI** — stream/history `tool_result` events carry the tool `name` (commit `2e00da8`)
- **Deployment guide** — `docs/deploy/DEPLOY.md` (PC build → staging → Ubuntu / PM2)
- **RAG docs** — `docs/rag-knowledge-base.md`, `docs/rag-search-and-chunking.md`, `docs/server-knowledge-ingestion.md`

### Updated short path

Of the earlier “short path” suggestions, **#1 (resources)**, **#2 (prompts in client)**, **#5 (chunkers)**, **#7 (XML prompts)**, **#8 (structured wallet + payment reports)**, and **#9 (sampling presets)** are already in place. Remaining high-value gaps that still fit cleanly: **#3/#6** hybrid search or eval harness.