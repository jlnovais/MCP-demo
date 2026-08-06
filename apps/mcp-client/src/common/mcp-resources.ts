import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Resource } from '@modelcontextprotocol/sdk/types.js';
import type { McpResourceSummary } from './types.js';

export type ResourceInfo = McpResourceSummary;
export type { McpResourceSummary };

export function toResourceInfo(resource: Resource): ResourceInfo {
  return {
    uri: resource.uri,
    name: resource.name,
    title: resource.title,
    description: resource.description,
    mimeType: resource.mimeType,
  };
}

export async function listMcpResources(
  mcpClient: Client,
): Promise<ResourceInfo[]> {
  const resources: ResourceInfo[] = [];
  let cursor: string | undefined;

  do {
    const page = await mcpClient.listResources(cursor ? { cursor } : undefined);
    resources.push(...page.resources.map(toResourceInfo));
    cursor = page.nextCursor;
  } while (cursor);

  return resources;
}

/**
 * Read an MCP resource by URI and return concatenated text contents.
 */
export async function readMcpResource(
  mcpClient: Client,
  uri: string,
): Promise<{ uri: string; text: string; mimeType?: string }> {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error('Resource URI is required');
  }

  const result = await mcpClient.readResource({ uri: trimmed });
  const textParts: string[] = [];
  let mimeType: string | undefined;

  for (const content of result.contents) {
    if ('text' in content && typeof content.text === 'string') {
      if (content.text.trim()) {
        textParts.push(content.text);
      }
      if (!mimeType && content.mimeType) {
        mimeType = content.mimeType;
      }
    }
  }

  const text = textParts.join('\n\n');
  if (!text) {
    throw new Error(`Resource "${trimmed}" returned no text content`);
  }

  return {
    uri: trimmed,
    text,
    mimeType,
  };
}

/** Build a chat message that injects a read resource for the model. */
export function formatResourceInjectMessage(uri: string, text: string): string {
  return [
    `Here is the content of MCP resource ${uri}:`,
    '',
    '---',
    text,
    '---',
  ].join('\n');
}
