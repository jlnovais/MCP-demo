import type Anthropic from '@anthropic-ai/sdk';
import type { mcpTools } from '@anthropic-ai/sdk/helpers/beta/mcp';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ClaudeSamplingParams } from './claude-sampling.js';

export type AppContext = {
  anthropic: Anthropic;
  model: string;
  maxTokens: number;
  claudeTools: ReturnType<typeof mcpTools>;
  transport: StreamableHTTPClientTransport | undefined;
  thinkingBudget: number | undefined;
  samplingParams: ClaudeSamplingParams;
  tools: Tool[];
  systemPrompt: string;
  classifierPrompt: string;
  classifierModel: string;
  classifierEnabled: boolean;
  mcpConnected: boolean;
  promptCacheEnabled: boolean;
  /** Anthropic prompt-cache TTL: `5m` (default) or `1h`. */
  promptCacheTtl: '5m' | '1h';
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
  | { type: 'tool_result'; text: string; isError: boolean }
  | { type: 'prompt_cache'; stats: PromptCacheStats }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type MessageBlock =
  | { type: 'thinking'; text: string }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; text: string; isError: boolean };

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
  promptCacheTtl: '5m' | '1h';
};
