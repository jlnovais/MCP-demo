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
| Temperature | `CLAUDE_TEMPERATURE` / `top_p` / `top_k` in `claude-sampling.ts` |
| Response streaming | `stream: true` + SSE to the web UI |
| Structured data (partial) | Chart JSON contract in the system prompt + `ChartBlock`; Zod schemas on MCP tools; classifier forced to one label |

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
| Extended thinking | `CLAUDE_THINKING_BUDGET` + streamed thinking blocks + per-session UI on/off toggle |
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
| Defining prompts | `create_mbway_payment` via `registerPrompt` |
| Server inspector | Covered via curl / testing docs (not a built-in Inspector UI) |
| Prompts **in the client** | **Done** — web `PromptPicker` + `/prompts` API; CLI `/prompts` and `/prompt <name>` |
| Defining / accessing **resources** | **Not** present |

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
| Parallelization / chaining / env inspection / formal workflow engine | **Not** as first-class demos |

### Prompt evaluation
**No** course-style eval harness (no golden datasets or model/code graders for scope/RAG). Unit tests cover dates utilities and the knowledge **chunker** (`chunker.spec.ts`).

---

## Good demo candidates for *this* project

These fit the existing Wallet + MCP + RAG stack without forcing a new product:

### High fit (natural extensions)
1. **MCP resources** — expose `knowledge/*.md` or wallet FAQ as resources; show list/read in client or Claude Desktop  
2. **Prompts in the client** ✅ — web picker + CLI `/prompts` / `/prompt`  
3. **BM25 or hybrid search** — docs already sketch this; good RAG lesson  
4. **Multi-index RAG** — separate Wallet vs Mindshaker indexes (or Postgres vs LanceDB side-by-side)  
5. **Alternate chunkers** ✅ — per-type `CHUNKER_*`, `compare:chunkers`, unit tests  
6. **Prompt eval harness** — golden Q&A for scope classifier + “did RAG cite the right source?” (code + model grading)  
7. **XML-structured system prompts** ✅ — `SYSTEM_PROMPT_FORMAT=xml|markdown`  
8. **Richer structured outputs** 🟡 — chart fenced blocks done; forced answer schemas still open  
9. **Temperature / thinking comparison** 🟡 — thinking UI toggle done; temperature presets still open  
10. **Explicit workflows** — chaining (list → get → cancel payment) and routing (classifier already starts this)

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
| Accessing Claude API | Yes | Structured outputs, temperature UI |
| Prompt evaluation | No | Scope + RAG eval suite |
| Prompt engineering | Yes (XML + markdown) | Optional A/B of formats; eval harness |
| Tool use | Yes (custom MCP) | `tool_choice`, built-in Anthropic tools |
| RAG / agentic search | Yes (vector only; multi-chunker) | BM25/hybrid, multi-index |
| Claude features | Partial | Images, Citations API, native PDF, temperature UI |
| MCP | Yes (tools + prompts + client prompts) | Resources |
| Anthropic apps | Docs only | Claude Code wiring |
| Agents / workflows | Agentic loop only | Chaining + clearer routing demos |

**Bottom line:** the project already is a strong demo of **Claude API + streaming + system prompts (XML/markdown) + multi-turn tool use + MCP tools/prompts/client + agentic RAG (multi-chunker) + extended thinking + prompt caching**. The biggest gaps that still fit cleanly as demos are **prompt evals**, **MCP resources**, **hybrid/multi-index RAG**, and a few **Claude features** (images, citations, native PDF, temperature UI presets).

---

# Better explanation

Here’s a clearer take on each high-fit demo — what it is, what you already have, and what a demo would look like in this repo.

---

### 1. MCP resources ⏳
**What it is:** MCP has three primitives: tools (actions), prompts (reusable message templates), and **resources** (read-only data the client can fetch — files, docs, configs).

**Today:** You register tools and one prompt (`create_mbway_payment`). Knowledge lives only behind `search_knowledge_base` (search), not as browsable resources. Client prompts are implemented (#2).

**Demo:** Expose `apps/mcp-server/knowledge/*.md` (or wallet FAQ sections) as MCP resources (`wallet://docs/refund-policy`, etc.). Claude Desktop or your client can list/read them without a vector search. Shows the “data” side of MCP next to tools.

---

### 2. Prompts in the client ✅ — Already implemented
**What it is:** Server-defined prompt templates with args that expand into ready-made user messages.

**Today:** `registerPrompt('create_mbway_payment', …)` on the server. Web UI has `PromptPicker` (list → fill args → inject message). CLI supports `/prompts` and `/prompt <name>`. API: `GET /api/prompts`, `POST /api/prompts/get`.

**Demo (done):** Choose MB WAY payment → fill `userId`, `amount`, phone → inject the filled prompt into the conversation.

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

### 8. Richer structured outputs 🟡 — Partially implemented
**What it is:** Force the model to return data in a fixed schema (JSON), not free prose.

**Today:** Soft structure — chart fenced blocks (`\`\`\`chart` + JSON) rendered by `ChartBlock`, plus Zod on **tool inputs**. No hard “always return this JSON schema” path for answers.

**Demo:** e.g. a `format_wallet_summary` tool or a post-step that requires `{ balance, currency, userId, … }`, or stricter chart validation. Shows “structured data” as a first-class API pattern, not only UI convenience.

**Already / not yet:**
- ✅ Done: chart JSON contract in the system prompt; web UI parses `chart` fenced blocks and renders them (`ChartBlock` / `MarkdownContent`); Zod schemas on MCP tool inputs
- ⏳ Still open: forced answer schemas (e.g. wallet summary JSON), dedicated structured-output tool, or stricter validation / rejection of invalid chart payloads

---

### 9. Temperature / thinking comparison 🟡 — Partially implemented
**What it is:** Sampling (`temperature`) vs extended thinking (`thinking.budget_tokens`) change creativity vs deliberation.

**Today:** Both exist via env (`CLAUDE_TEMPERATURE`, `CLAUDE_THINKING_BUDGET`) and thinking streams in the UI — plus a per-session thinking on/off toggle. Temperature still needs a restart/reconfigure to compare.

**Demo:** UI toggles or presets (“Precise”, “Creative”, “Think hard”) on the same question (e.g. multi-step payment + knowledge Q). Show side-by-side or sequential runs. Makes API knobs tangible (note: thinking and non-default temperature don’t mix on the API — your code already warns about that).

**Already / not yet:**
- ✅ Done: extended thinking streams in the UI; per-session **thinking on/off** toggle (`thinkingEnabled` → `streamChatTurn`); budget still from `CLAUDE_THINKING_BUDGET` (with a default when enabling from the UI); temperature / top_p / top_k via env
- ⏳ Still open: temperature (or sampling preset) controls in the UI; named presets (“Precise”, “Creative”, “Think hard”); easy side-by-side comparison without editing `.env`

---

### 10. Explicit workflows ⏳
**What it is:** Fixed multi-step patterns vs a free agent loop:
- **Routing** — classify then send to the right path  
- **Chaining** — step A → B → C  
- **Parallelization** — run independent steps together  

**Today:** One agentic `toolRunner` loop. Light routing via the scope classifier. No named “workflow” demos.

**Demo ideas that reuse Wallet tools:**
- **Routing:** out-of-scope refuse vs RAG vs wallet tools (you’re halfway there)  
- **Chaining:** guided “create payment → get payment → show status” (could reuse the MCP prompt)  
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

**Short path status:** **#2**, **#5**, and **#7** are done; **#9** has a thinking UI toggle. Next high-value gaps: **#1 resources**, **#3/#6** hybrid search or eval harness, fuller **#8/#9** (forced structured output + temperature UI presets).

---

## Progress update (what has already been done)

Status check against the high-fit demos and related work found in the repo (commits + current working tree).

### High-fit demos — done

| # | Demo | Status | Evidence |
| --- | --- | --- | --- |
| **2** | Prompts in the client | **Done** | Web `PromptPicker` + `/api/prompts` / `/api/prompts/get`; CLI `/prompts` and `/prompt <name>`. Commit `3eca3fe`. |
| **7** | XML-structured system prompts | **Done** | `BASE_POLICY_XML` with `<scope>`, `<rules>`, `<examples>`, etc.; `SYSTEM_PROMPT_FORMAT=xml\|markdown` (xml default). In `system-prompt.ts` + `.env.template`. |
| **5** | Alternate chunkers | **Done** | Per-type `CHUNKER_*` + `html` (`HTMLNodeParser`); `compare:chunkers`; `chunker.ts`; unit tests in `test/mcp-server/knowledge/chunker.spec.ts`. |
| **9** | Temperature / thinking comparison | **Partially done** | Per-session **extended thinking** toggle in the web UI (`thinkingEnabled` → `streamChatTurn`); thinking still also configurable via `CLAUDE_THINKING_BUDGET`. Temperature / sampling remain env-based (`CLAUDE_TEMPERATURE`, etc.) — no UI preset yet. |
| **8** | Richer structured outputs | **Partially done** | Chart fenced blocks (`chart` language tag + JSON) rendered by `ChartBlock` / `MarkdownContent`. Commit `e9200de`. Still soft (prompt contract), not a forced JSON-schema / dedicated summary tool. |

### High-fit demos — still open

| # | Demo | Notes |
| --- | --- | --- |
| **1** | MCP resources | Still tools + prompts only; no `registerResource` / list-read in client |
| **3** | BM25 / hybrid search | Still vector-only |
| **4** | Multi-index RAG | Still one corpus; backends are selectable (Postgres **or** LanceDB), not separate Wallet vs Mindshaker indexes |
| **6** | Prompt eval harness | Still no datasets / graders for scope or RAG (chunker + dates unit tests only) |
| **10** | Explicit workflows | Still free agentic `toolRunner` loop + light scope classifier |

### Other related work already landed (not in the original high-fit list)

- **Postgres + pgvector** vector store (`VECTOR_STORE=postgres` default; LanceDB fallback) — commit `b3124d3`; schema docs in `docs/postgres-knowledge-schema.md`
- **Incremental knowledge ingestion** with per-source `content_hash` / `contentHash` (skip unchanged files; hash includes chunker so `CHUNKER_*` changes invalidate) — commit `40bee6c`
- **Anthropic prompt caching** + cache HIT/WRITE UI stats — commits `bae79bb`, `8d099cf`
- **Claude sampling parameters** (temperature / top_p / top_k) via env — commit `012da60`
- **Tool-result naming in the UI** — stream/history `tool_result` events carry the tool `name` (commit `2e00da8`)
- **Deployment guide** — `docs/deploy/DEPLOY.md` (PC build → staging → Ubuntu / PM2)
- **RAG docs** — `docs/rag-knowledge-base.md`, `docs/rag-search-and-chunking.md`, `docs/server-knowledge-ingestion.md`

### Updated short path

Of the earlier “short path” suggestions, **#2 (prompts in client)**, **#5 (chunkers)**, and **#7 (XML prompts)** are already in place; **#9** has a thinking UI toggle. Remaining high-value gaps that still fit cleanly: **#1 resources**, **#3/#6** hybrid search or eval harness, and fuller **#8/#9** (forced structured output + temperature UI presets).