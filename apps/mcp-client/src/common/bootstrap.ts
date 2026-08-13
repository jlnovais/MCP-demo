import Anthropic from '@anthropic-ai/sdk';
import {
  mcpTools,
  type MCPClientLike,
} from '@anthropic-ai/sdk/helpers/beta/mcp';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool.mjs';
import { Client } from '@modelcontextprotocol/sdk/client';
import { resolveClaudeSamplingParams } from './claude-sampling.js';
import { connectMcpClient } from './connection.js';
import { requireEnv } from './env.js';
import { listMcpPrompts, type PromptInfo } from './prompts.js';
import { listMcpResources } from './mcp-resources.js';
import type { AppContext, McpResourceSummary } from './types.js';
import {
  buildClassifierPrompt,
  buildSystemPrompt,
  resolveSystemPromptFormat,
} from './system-prompt.js';

const DEFAULT_MAX_TOKENS = 4096;

export type BootstrapOptions = {
  onMcpError?: (description: string, detail: string) => void;
};

export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<AppContext> {
  const promptCacheEnabled =
    process.env.PROMPT_CACHE_ENABLED?.trim().toLowerCase() === 'true';

  const rawPromptCacheTtl = process.env.PROMPT_CACHE_TTL?.trim().toLowerCase();
  const promptCacheTtl: '5m' | '1h' = rawPromptCacheTtl === '1h' ? '1h' : '5m';
  if (
    rawPromptCacheTtl !== undefined &&
    rawPromptCacheTtl !== '' &&
    rawPromptCacheTtl !== '5m' &&
    rawPromptCacheTtl !== '1h'
  ) {
    console.warn(
      `Invalid PROMPT_CACHE_TTL="${process.env.PROMPT_CACHE_TTL}" (expected "5m" or "1h"); using 5m.`,
    );
  }

  const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY');
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5';

  const rawMaxTokens = Number(process.env.CLAUDE_MAX_TOKENS);
  const maxTokens =
    Number.isFinite(rawMaxTokens) && rawMaxTokens > 0
      ? rawMaxTokens
      : DEFAULT_MAX_TOKENS;

  const rawBudget = Number(process.env.CLAUDE_THINKING_BUDGET);
  const thinkingBudget =
    Number.isFinite(rawBudget) && rawBudget > 0 ? rawBudget : undefined;

  const samplingParams = resolveClaudeSamplingParams({
    thinkingBudget,
    onWarning: (message) => console.warn(message),
  });

  console.log('samplingParams to be used: ', samplingParams);

  let mcpClient: Client | undefined;
  let transport: StreamableHTTPClientTransport | undefined;
  let mcpConnected = false;

  const result = await connectMcpClient();
  if (result.Success && result.ReturnedObject) {
    ({ mcpClient, transport } = result.ReturnedObject);
    mcpConnected = true;
  } else {
    const message = `${result.ErrorDescription}: ${result.ErrorDescription2}`;
    if (options.onMcpError) {
      options.onMcpError(result.ErrorDescription, result.ErrorDescription2);
    } else {
      console.error(message);
      console.error('Continuing without MCP tools.');
    }
  }

  let claudeTools: BetaRunnableTool<Record<string, unknown>>[] = [];
  let tools: Tool[] = [];
  let prompts: PromptInfo[] = [];
  let resources: McpResourceSummary[] = [];
  if (mcpClient) {
    ({ tools } = await mcpClient.listTools());
    claudeTools = mcpTools(tools, mcpClient as MCPClientLike);
    try {
      prompts = await listMcpPrompts(mcpClient);
    } catch (error) {
      console.warn(
        'Failed to list MCP prompts:',
        error instanceof Error ? error.message : String(error),
      );
    }
    try {
      resources = await listMcpResources(mcpClient);
    } catch (error) {
      console.warn(
        'Failed to list MCP resources:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const systemPromptFormat = resolveSystemPromptFormat();
  console.log(`System prompt format: ${systemPromptFormat}`);
  const systemPrompt = buildSystemPrompt(tools, systemPromptFormat);
  const classifierPrompt = buildClassifierPrompt(tools);
  const classifierModel = process.env.CLAUDE_CLASSIFIER_MODEL?.trim() || model;
  const classifierEnabled =
    (process.env.SCOPE_CLASSIFIER_ENABLED ?? 'true').trim().toLowerCase() !==
    'false';
  const structuredOutputStrictDefault =
    (process.env.STRUCTURED_OUTPUT_STRICT ?? 'false').trim().toLowerCase() ===
    'true';
  console.log(
    `Structured summaries (strict default): ${structuredOutputStrictDefault ? 'on' : 'off'} (wallet + payments; not for RAG)`,
  );

  return {
    anthropic,
    model,
    maxTokens,
    claudeTools,
    mcpClient,
    transport,
    thinkingBudget,
    samplingParams,
    tools,
    prompts,
    resources,
    systemPrompt,
    systemPromptFormat,
    classifierPrompt,
    classifierModel,
    classifierEnabled,
    mcpConnected,
    promptCacheEnabled,
    promptCacheTtl,
    structuredOutputStrictDefault,
  };
}
