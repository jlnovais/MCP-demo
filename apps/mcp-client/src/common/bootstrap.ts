import Anthropic from '@anthropic-ai/sdk';
import {
  mcpTools,
  type MCPClientLike,
} from '@anthropic-ai/sdk/helpers/beta/mcp';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool.mjs';
import { Client } from '@modelcontextprotocol/sdk/client';
import { connectMcpClient } from './connection.js';
import { requireEnv } from './env.js';
import type { AppContext } from './types.js';

const DEFAULT_MAX_TOKENS = 4096;

export type BootstrapOptions = {
  onMcpError?: (description: string, detail: string) => void;
};

export async function bootstrap(
  options: BootstrapOptions = {},
): Promise<AppContext> {
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
  if (mcpClient) {
    ({ tools } = await mcpClient.listTools());
    claudeTools = mcpTools(tools, mcpClient as MCPClientLike);
  }

  return {
    anthropic,
    model,
    maxTokens,
    claudeTools,
    transport,
    thinkingBudget,
    tools,
    mcpConnected,
  };
}
