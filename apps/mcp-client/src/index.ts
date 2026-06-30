import { config } from 'dotenv';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import Anthropic from '@anthropic-ai/sdk';
import {
  mcpTools,
  type MCPClientLike,
} from '@anthropic-ai/sdk/helpers/beta/mcp';
import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

config({ path: path.join(process.cwd(), '.env'), quiet: true });
config({
  path: path.join(process.cwd(), 'apps', 'mcp-client', '.env'),
  quiet: true,
});

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function printAssistantMessage(message: BetaMessage): void {
  for (const block of message.content) {
    if (block.type === 'text') {
      console.log(`\nClaude: ${block.text}\n`);
    }
  }
}

async function connectMcpClient(): Promise<{
  mcpClient: Client;
  transport: StreamableHTTPClientTransport;
}> {
  const mcpServerUrl =
    process.env.MCP_SERVER_URL ?? 'http://127.0.0.1:4000/mcp/v1';
  const mcpApiKey = process.env.MCP_SERVER_API_KEY ?? process.env.API_KEY ?? '';

  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl), {
    requestInit: mcpApiKey
      ? { headers: { 'x-api-key': mcpApiKey } }
      : undefined,
  });

  const mcpClient = new Client({
    name: 'mcp-demo-client',
    version: '1.0.0',
  });

  await mcpClient.connect(transport);
  return { mcpClient, transport };
}

const anthropic = new Anthropic({
  apiKey: requireEnv('ANTHROPIC_API_KEY'),
});

const model = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-20250514';
const { mcpClient, transport } = await connectMcpClient();
const { tools } = await mcpClient.listTools();
const claudeTools = mcpTools(tools, mcpClient as MCPClientLike);

console.log(`Connected to MCP server (${tools.length} tools available).`);
console.log(`Claude model: ${model}`);
console.log('Type your message and press Enter. Type "exit" to quit.\n');

const rl = createInterface({ input, output });
const messages: BetaMessageParam[] = [];

try {
  while (true) {
    const userInput = await rl.question('You: ');

    if (userInput === 'exit') {
      break;
    }

    if (!userInput.trim()) {
      continue;
    }

    messages.push({ role: 'user', content: userInput });

    const runner = anthropic.beta.messages.toolRunner({
      model,
      max_tokens: 4096,
      messages,
      tools: claudeTools,
    });

    try {
      const finalMessage = await runner.runUntilDone();
      messages.length = 0;
      messages.push(...runner.params.messages);
      printAssistantMessage(finalMessage);
    } catch (error) {
      messages.pop();
      console.error(
        'Error:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }
} finally {
  rl.close();
  await transport.close();
}
