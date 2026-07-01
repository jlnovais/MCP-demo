import Anthropic from '@anthropic-ai/sdk';
import {
  mcpTools,
  type MCPClientLike,
} from '@anthropic-ai/sdk/helpers/beta/mcp';
import type { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { connectMcpClient } from './connection.js';
import { requireEnv } from './env.js';
import { printStartupBanner } from './io.js';

export type AppContext = {
  anthropic: Anthropic;
  model: string;
  claudeTools: ReturnType<typeof mcpTools>;
  transport: StreamableHTTPClientTransport;
};

export async function bootstrap(): Promise<AppContext> {
  const anthropicApiKey = requireEnv('ANTHROPIC_API_KEY');
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5';

  const { mcpClient, transport } = await connectMcpClient();
  const { tools } = await mcpClient.listTools();
  const claudeTools = mcpTools(tools, mcpClient as MCPClientLike);

  printStartupBanner({ model, tools, apiKey: anthropicApiKey });

  return { anthropic, model, claudeTools, transport };
}
