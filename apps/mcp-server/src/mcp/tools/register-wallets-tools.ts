import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WalletWalletsService } from '../api/wallet-wallets.service';
import { jsonResult, toolError } from './tool-helpers';

export type WalletSummary = {
  userId: string;
  merchantId: string;
  credits: number | null;
  currency: string;
  fetchedAt: string;
  ok: boolean;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function pickNumber(
  record: Record<string, unknown> | undefined,
  keys: string[],
): number | null {
  if (!record) {
    return null;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function pickString(
  record: Record<string, unknown> | undefined,
  keys: string[],
): string | undefined {
  if (!record) {
    return undefined;
  }
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return undefined;
}

/**
 * Map opaque Wallet API payloads into a stable summary schema for demos.
 * Not used for RAG / knowledge-base answers.
 */
export function buildWalletSummary(
  userId: string,
  merchantId: string,
  raw: unknown,
): WalletSummary {
  const root = asRecord(raw);
  const nested =
    asRecord(root?.data) ??
    asRecord(root?.wallet) ??
    asRecord(root?.result) ??
    root;

  return {
    userId,
    merchantId,
    credits: pickNumber(nested, [
      'credits',
      'Credits',
      'balance',
      'Balance',
      'amount',
      'Amount',
    ]),
    currency:
      pickString(nested, ['currency', 'Currency', 'unit', 'Unit']) ?? 'credits',
    fetchedAt: new Date().toISOString(),
    ok: true,
  };
}

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
    'format_wallet_summary',
    {
      description:
        'Return a fixed-schema JSON summary of a user wallet (userId, merchantId, credits, currency, fetchedAt). Prefer this over get_wallet when the user wants a structured wallet summary. Not for knowledge-base / RAG answers.',
      inputSchema: {
        userId: z.string().describe('User ID associated with the wallet.'),
        merchantId: z.string().describe('Merchant identifier.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: format_wallet_summary', args);
      try {
        const raw = await walletsService.getWallet(
          args.userId,
          args.merchantId,
        );
        return jsonResult(
          buildWalletSummary(args.userId, args.merchantId, raw),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResult({
          userId: args.userId,
          merchantId: args.merchantId,
          credits: null,
          currency: 'credits',
          fetchedAt: new Date().toISOString(),
          ok: false,
          error: message,
        } satisfies WalletSummary);
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
