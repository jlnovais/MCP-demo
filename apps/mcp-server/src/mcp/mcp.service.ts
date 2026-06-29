import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WalletExchangeRateService } from './api/wallet-exchange-rate.service';
import { WalletPaymentsService } from './api/wallet-payments.service';
import { WalletWalletsService } from './api/wallet-wallets.service';
import { registerExchangeRateTools } from './tools/register-exchange-rate-tools';
import { registerPaymentsPrompts } from './tools/register-payments-prompts';
import { registerPaymentsTools } from './tools/register-payments-tools';
import { registerWalletsTools } from './tools/register-wallets-tools';

@Injectable()
export class McpService {
  private readonly sessions = new Map<string, StreamableHTTPServerTransport>();

  constructor(
    private readonly paymentsService: WalletPaymentsService,
    private readonly walletsService: WalletWalletsService,
    private readonly exchangeRateService: WalletExchangeRateService,
  ) {}

  private createServer(): McpServer {
    const server = new McpServer({
      name: 'mindshaker-wallet-mcp',
      version: '1.0.0',
    });
    registerPaymentsPrompts(server);
    registerPaymentsTools(server, this.paymentsService);
    registerWalletsTools(server, this.walletsService);
    registerExchangeRateTools(server, this.exchangeRateService);
    return server;
  }

  private async getTransport(
    req: IncomingMessage,
  ): Promise<StreamableHTTPServerTransport> {
    const sessionId = req.headers['mcp-session-id'];
    if (typeof sessionId === 'string' && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        this.sessions.set(id, transport);

        console.log('Transport connected with session id: ', id);
        console.log('Total sessions: ', this.sessions.size);
      },
      onsessionclosed: (id) => {
        this.sessions.delete(id);

        console.log('Transport closed with session id: ', id);
        console.log('Total sessions: ', this.sessions.size);
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
