import type Anthropic from '@anthropic-ai/sdk';
import type { mcpTools } from '@anthropic-ai/sdk/helpers/beta/mcp';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ClaudeSamplingParams } from './claude-sampling.js';
import type {
  SamplingPresetId,
  SamplingPresetInfo,
} from './claude-sampling.js';
import type { PromptInfo } from './prompts.js';

export type { PromptInfo, SamplingPresetId, SamplingPresetInfo };

export type McpResourceSummary = {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
};

export type AppContext = {
  anthropic: Anthropic;
  model: string;
  maxTokens: number;
  claudeTools: ReturnType<typeof mcpTools>;
  mcpClient: Client | undefined;
  transport: StreamableHTTPClientTransport | undefined;
  thinkingBudget: number | undefined;
  samplingParams: ClaudeSamplingParams;
  tools: Tool[];
  prompts: PromptInfo[];
  resources: McpResourceSummary[];
  systemPrompt: string;
  /** Format used to build systemPrompt; needed for per-turn strict appendix. */
  systemPromptFormat: 'xml' | 'markdown';
  classifierPrompt: string;
  classifierModel: string;
  classifierEnabled: boolean;
  mcpConnected: boolean;
  promptCacheEnabled: boolean;
  /** Anthropic prompt-cache TTL: `5m` (default) or `1h`. */
  promptCacheTtl: '5m' | '1h';
  /**
   * Default for Strict structured wallet + payment summaries
   * (env STRUCTURED_OUTPUT_STRICT). Does not apply to RAG / knowledge-base answers.
   */
  structuredOutputStrictDefault: boolean;
};

export type PromptCacheStats = {
  step: number;
  status: 'HIT' | 'WRITE' | 'MISS';
  read: number;
  write: number;
  input: number;
  output: number;
};

export type ChatStreamEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; text: string; isError: boolean; name?: string }
  | { type: 'prompt_cache'; stats: PromptCacheStats }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type MessageBlock =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; text: string; isError: boolean; name?: string };

export type DisplayMessage = {
  id: string;
  role: 'user' | 'assistant';
  blocks: MessageBlock[];
  createdAt: string;
};

export type SessionSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type SessionDetail = SessionSummary & {
  messages: DisplayMessage[];
};

export type ServerConfig = {
  model: string;
  mcpConnected: boolean;
  toolCount: number;
  tools: Array<{ name: string; description: string }>;
  promptCount: number;
  prompts: PromptInfo[];
  resourceCount: number;
  resources: McpResourceSummary[];
  promptCacheTtl: '5m' | '1h';
  samplingPresets: SamplingPresetInfo[];
  defaultSamplingPreset: SamplingPresetId;
  /** Env default for Structured (strict) wallet + payment summaries — not for RAG. */
  structuredOutputStrictDefault: boolean;
};
