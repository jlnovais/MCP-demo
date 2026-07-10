import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ResultOf } from './dto/result.js';

export interface McpConnection {
  mcpClient: Client;
  transport: StreamableHTTPClientTransport;
}

export async function connectMcpClient(): Promise<ResultOf<McpConnection>> {
  try {
    const mcpServerUrl =
      process.env.MCP_SERVER_URL ?? 'http://127.0.0.1:4000/mcp/v1';
    const mcpApiKey =
      process.env.MCP_SERVER_API_KEY ?? process.env.API_KEY ?? '';

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
    return new ResultOf<McpConnection>({
      Success: true,
      ErrorCode: 0,
      ErrorDescription: 'Successfully connected to MCP server',
      ErrorDescription2: '',
      ReturnedObject: { mcpClient, transport },
    });
  } catch (error) {
    return new ResultOf<McpConnection>({
      Success: false,
      ReturnedObject: null,
      ErrorCode: -1,
      ErrorDescription: 'Error connecting to MCP server',
      ErrorDescription2: error instanceof Error ? error.message : String(error),
    });
  }
}
