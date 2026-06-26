import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WalletWalletsService } from '../api/wallet-wallets.service';
import { jsonResult, toolError } from './tool-helpers';

export function registerWalletsTools(
  server: McpServer,
  walletsService: WalletWalletsService,
): void {
  server.registerTool(
    'update_wallet',
    {
      description:
        'Add or subtract credits from a user wallet via the Wallet API.',
      inputSchema: {
        merchantId: z.string().describe('Merchant identifier.'),
        userId: z.string().describe('User ID associated with the wallet.'),
        credits: z
          .number()
          .describe(
            'Credits to add (positive) or subtract (negative) from the wallet.',
          ),
        description: z.string().describe('Reason for the wallet update.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: update_wallet', args);
      try {
        const result = await walletsService.updateWallet(args);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_wallet',
    {
      description: 'Get the current credit balance for a user wallet.',
      inputSchema: {
        userId: z.string().describe('User ID associated with the wallet.'),
        merchantId: z.string().describe('Merchant identifier.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: get_wallet', args);
      try {
        const result = await walletsService.getWallet(
          args.userId,
          args.merchantId,
        );
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'transfer_credits',
    {
      description:
        'Transfer credits between two user wallets via the Wallet API.',
      inputSchema: {
        merchantIdSource: z
          .string()
          .describe('Merchant identifier for the source wallet.'),
        userIdSource: z.string().describe('User ID of the source wallet.'),
        credits: z.number().describe('Number of credits to transfer.'),
        merchantIdDestination: z
          .string()
          .describe('Merchant identifier for the destination wallet.'),
        userIdDestination: z
          .string()
          .describe('User ID of the destination wallet.'),
        descriptionForSource: z
          .string()
          .describe('Description recorded on the source wallet log.'),
        descriptionForDestination: z
          .string()
          .describe('Description recorded on the destination wallet log.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: transfer_credits', args);
      try {
        const result = await walletsService.transferCredits(args);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'reset_wallets',
    {
      description:
        'Reset credits for one or more user wallets to a specified amount.',
      inputSchema: {
        merchantId: z.string().describe('Merchant identifier.'),
        userIds: z
          .string()
          .describe(
            'Comma-separated list of user IDs whose wallets should be reset.',
          ),
        credits: z.number().describe('Credit balance to set after the reset.'),
        description: z.string().describe('Reason for the wallet reset.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: reset_wallets', args);
      try {
        const result = await walletsService.resetWallets(args);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'list_wallet_logs',
    {
      description:
        'List wallet transaction logs with pagination and filters from the Wallet API.',
      inputSchema: {
        merchantId: z.string().describe('Merchant identifier.'),
        userId: z.string().describe('User ID to filter logs by.'),
        id: z.string().optional().describe('Filter by log ID.'),
        dateStart: z
          .string()
          .optional()
          .describe('Filter logs from this datetime (inclusive).'),
        dateEnd: z
          .string()
          .optional()
          .describe('Filter logs until this datetime (inclusive).'),
        page: z.number().optional().describe('Page number (default 1).'),
        pageSize: z
          .number()
          .optional()
          .describe('Items per page (default 10).'),
        orderBy: z
          .enum(['date', 'MerchantId', 'UserId', 'logId'])
          .optional()
          .describe('Field to sort by.'),
        direction: z
          .enum(['ASC', 'DESC'])
          .optional()
          .describe('Sort direction.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: list_wallet_logs', args);
      try {
        const result = await walletsService.listWalletLogs(args);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'get_wallet_log',
    {
      description: 'Get a single wallet transaction log by its numeric ID.',
      inputSchema: {
        id: z.number().describe('Numeric wallet log ID.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: get_wallet_log', args);
      try {
        const result = await walletsService.getWalletLog(args.id);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
