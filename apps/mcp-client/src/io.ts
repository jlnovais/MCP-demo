import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export function color(text: string, code: number): string {
  return `\x1b[${code}m${text}\x1b[0m`;
}

type StartupBannerOptions = {
  model: string;
  tools: Tool[];
  apiKey: string;
};

export function printStartupBanner({
  model,
  tools,
  apiKey,
}: StartupBannerOptions): void {
  console.log(`Connected to MCP server (${tools.length} tools available).`);
  console.log(`Claude model: ${model}`);
  console.log(`Api-key used: ...${apiKey.substring(apiKey.length - 10)}`);
  console.log('--------------------------------');
  console.log('Available tools:');

  const toolsDescription = tools.map((tool) => {
    const description = tool.description ?? '(No description available)';
    return `- ${tool.name}: ${description}`;
  });

  console.log(toolsDescription);
  console.log('--------------------------------');
  console.log(
    'Type your message and press Enter. Type "exit" or press Ctrl+C to quit.\n',
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
