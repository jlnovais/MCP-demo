import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WalletPaymentsService } from './api/wallet-payments.service';
import { registerPaymentsTools } from './tools/register-payments-tools';

@Injectable()
export class McpService {
  private readonly sessions = new Map<string, StreamableHTTPServerTransport>();

  constructor(private readonly paymentsService: WalletPaymentsService) {}

  private createServer(): McpServer {
    const server = new McpServer({
      name: 'mindshaker-wallet-mcp',
      version: '1.0.0',
    });
    registerPaymentsTools(server, this.paymentsService);
    return server;
  }

  private async getTransport(
    req: IncomingMessage,
  ): Promise<StreamableHTTPServerTransport> {
    const sessionId = req.headers['mcp-session-id'];
    if (typeof sessionId === 'string' && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    let transport!: StreamableHTTPServerTransport;
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        this.sessions.set(id, transport);
      },
      onsessionclosed: (id) => {
        this.sessions.delete(id);
      },
    });

    const server = this.createServer();
    await server.connect(transport);
    return transport;
  }

  async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const transport = await this.getTransport(req);
    await transport.handleRequest(req, res);
  }
}
