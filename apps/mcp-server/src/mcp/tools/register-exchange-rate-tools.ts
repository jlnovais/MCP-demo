import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WalletExchangeRateService } from '../api/wallet-exchange-rate.service';
import { jsonResult, toolError } from './tool-helpers';

export function registerExchangeRateTools(
  server: McpServer,
  exchangeRateService: WalletExchangeRateService,
): void {
  server.registerTool(
    'upsert_exchange_rate',
    {
      description:
        'Create or update the exchange rate for a merchant via the Wallet API. Admin accounts only.',
      inputSchema: {
        merchantId: z.string().describe('Merchant identifier.'),
        amount: z
          .number()
          .min(0)
          .max(500)
          .describe('Exchange rate amount (0–500).'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: upsert_exchange_rate', args);
      try {
        const result = await exchangeRateService.upsertExchangeRate(args);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_exchange_rate',
    {
      description:
        'Get the exchange rate for a merchant. Non-admin accounts ignore merchantId and return their own rate.',
      inputSchema: {
        merchantId: z
          .string()
          .describe(
            'Merchant identifier. Only admin accounts can query other merchants.',
          ),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: get_exchange_rate', args);
      try {
        const result = await exchangeRateService.getExchangeRate(
          args.merchantId,
        );
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
