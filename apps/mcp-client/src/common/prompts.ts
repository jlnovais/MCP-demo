import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Prompt } from '@modelcontextprotocol/sdk/types.js';

export type PromptInfo = {
  name: string;
  title?: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
};

export function toPromptInfo(prompt: Prompt): PromptInfo {
  return {
    name: prompt.name,
    title: prompt.title,
    description: prompt.description,
    arguments: prompt.arguments?.map((arg) => ({
      name: arg.name,
      description: arg.description,
      required: arg.required,
    })),
  };
}

export async function listMcpPrompts(mcpClient: Client): Promise<PromptInfo[]> {
  const { prompts } = await mcpClient.listPrompts();
  return prompts.map(toPromptInfo);
}

/**
 * Expand an MCP prompt template with args and return a single user message string.
 */
export async function getMcpPromptMessage(
  mcpClient: Client,
  name: string,
  args: Record<string, string>,
): Promise<{ message: string; description?: string }> {
  const cleanedArgs: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      cleanedArgs[key] = trimmed;
    }
  }

  const result = await mcpClient.getPrompt({
    name,
    arguments: cleanedArgs,
  });

  const textParts: string[] = [];
  for (const msg of result.messages) {
    const { content } = msg;
    if (content.type === 'text' && content.text.trim()) {
      textParts.push(content.text.trim());
    }
  }

  const message = textParts.join('\n\n');
  if (!message) {
    throw new Error(`Prompt "${name}" returned no text content`);
  }

  return {
    message,
    description: result.description,
  };
}
