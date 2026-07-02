import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function connectMcpClient(): Promise<{
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
