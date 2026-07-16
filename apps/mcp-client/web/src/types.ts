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
  streaming?: boolean;
  /** Live-turn prompt-cache usage; not persisted across session reloads. */
  cacheStats?: PromptCacheStats[];
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
