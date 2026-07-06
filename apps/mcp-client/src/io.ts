import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export function color(text: string, code: number, style: number = 0): string {
  return `\x1b[${style};${code}m${text}\x1b[0m`;
}

export type StartupBannerOptions = {
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
  console.log(
    `Api-key used: ${apiKey ? `${apiKey.substring(0, 12)}...${apiKey.substring(apiKey.length - 10)}` : ' *** no key defined in environment variable ANTHROPIC_API_KEY ***'}`,
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
