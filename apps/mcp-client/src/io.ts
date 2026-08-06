import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { PromptInfo } from './common/prompts.js';
import type { McpResourceSummary } from './common/types.js';

export function color(text: string, code: number, style: number = 0): string {
  return `\x1b[${style};${code}m${text}\x1b[0m`;
}

export type StartupBannerOptions = {
  model: string;
  tools: Tool[];
  prompts: PromptInfo[];
  resources: McpResourceSummary[];
  apiKey: string;
  promptCacheEnabled: boolean;
  promptCacheTtl: '5m' | '1h';
};

export function printStartupBanner({
  model,
  tools,
  prompts,
  resources,
  apiKey,
  promptCacheEnabled,
  promptCacheTtl,
}: StartupBannerOptions): void {
  const thinkingEnabled =
    process.env.CLAUDE_THINKING_BUDGET &&
    Number(process.env.CLAUDE_THINKING_BUDGET) > 0;

  console.log(
    `Connected to MCP server (${tools.length} tools, ${prompts.length} prompts, ${resources.length} resources available).`,
  );
  console.log(`Claude model: ${model}`);
  console.log(
    `Api-key used: ${apiKey ? `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 10)}` : ' *** no key defined in environment variable ANTHROPIC_API_KEY ***'}`,
  );
  console.log(
    `Thinking budget: ${process.env.CLAUDE_THINKING_BUDGET} (thinking enabled: ${thinkingEnabled ? 'yes' : 'no'})`,
  );
  console.log(`Temperature: ${process.env.CLAUDE_TEMPERATURE}`);
  console.log(`Top P: ${process.env.CLAUDE_TOP_P}`);
  console.log(`Top K: ${process.env.CLAUDE_TOP_K}`);
  console.log(
    `Prompt cache: ${promptCacheEnabled ? `enabled (TTL ${promptCacheTtl})` : 'disabled'}`,
  );
  console.log('--------------------------------');
  console.log('Available tools:');

  if (tools.length > 0) {
    const toolsDescription = tools.map((tool) => {
      const description = tool.description ?? '(No description available)';
      return `- ${tool.name}: ${description}`;
    });

    console.log(toolsDescription);
    console.log('--------------------------------');
  } else {
    console.log('No tools available.');
  }

  console.log('Available prompts:');
  if (prompts.length > 0) {
    for (const prompt of prompts) {
      const label = prompt.title
        ? `${prompt.name} (${prompt.title})`
        : prompt.name;
      const description = prompt.description ?? '(No description available)';
      console.log(`- ${label}: ${description}`);
    }
    console.log('--------------------------------');
  } else {
    console.log('No prompts available.');
  }

  console.log('Available resources:');
  if (resources.length > 0) {
    for (const resource of resources) {
      const label = resource.title
        ? `${resource.name} (${resource.title})`
        : resource.name;
      const description = resource.description ?? '(No description available)';
      console.log(`- ${label}: ${description}`);
      console.log(`  ${resource.uri}`);
    }
    console.log('--------------------------------');
  } else {
    console.log('No resources available.');
  }

  console.log(
    'Type your message and press Enter. Type "/prompts" or "/resources" to list, "/prompt <name>" / "/resource <uri|name>" to use one, or "exit" / Ctrl+C to quit.\n',
  );
}

export function printAssistantMessage(
  message: BetaMessage,
  colorCode: number = 37,
): void {
  for (const block of message.content) {
    if (block.type === 'text') {
      console.log(color(`\nClaude: ${block.text}\n`, colorCode));
    }
  }
}
