import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WalletPaymentsService } from '../api/wallet-payments.service';
import { buildPaymentsReport } from './payments-report';
import { jsonResult, toolError } from './tool-helpers';

const paymentTypeSchema = z.enum(['MB', 'MBWAY', 'CARD']);

const paymentStatusSchema = z.enum([
  'NEW',
  'ERROR',
  'UPDATE',
  'PAID',
  'REFUSED',
  'REFUNDED',
  'UNKNOWN',
  'CANCELED',
]);

export function registerPaymentsTools(
  server: McpServer,
  paymentsService: WalletPaymentsService,
): void {
  server.registerTool(
    'create_payment',
    {
      description:
        'Create a new payment request via the Wallet API (MB, MBWAY, or CARD).',
      inputSchema: {
        merchantId: z
          .string()
          .optional()
          .describe(
            'Merchant ID. Required for admin accounts; ignored for non-admin accounts.',
          ),
        userId: z.string().describe('User ID associated with the merchant.'),
        amount: z
          .number()
          .describe('Amount in euros. Use 0 when specifying credits instead.'),
        credits: z
          .number()
          .describe(
            'Credits for the payment. Use 0 when specifying amount in euros.',
          ),
        expirationMinutes: z
          .number()
          .describe('Expiration minutes for Multibanco (MB) references.'),
        customerName: z.string().describe('Customer full name.'),
        customerEmail: z.string().describe('Customer email address.'),
        customerPhone: z
          .string()
          .optional()
          .describe(
            'Customer phone number. Required when type is MBWAY. ' +
              "If no phone number is specified or if you don't know the phone number, you must ask for it. Never assume you know someone's phone number if no one has given it to you explicitly. ",
          ),
        description: z
          .string()
          .describe(
            'Payment description. For MBWAY, this text is sent to the mobile app.',
          ),
        type: paymentTypeSchema.describe('Payment method: MB, MBWAY, or CARD.'),
        inApp: z
          .boolean()
          .optional()
          .describe('Whether this is an in-app MB WAY request.'),
        isAuthorization: z
          .boolean()
          .optional()
          .describe('Whether this payment is an authorization request.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: create_payment', args);
      try {
        const { inApp, isAuthorization, ...body } = args;
        const result = await paymentsService.createPayment(body, {
          inApp,
          isAuthorization,
        });
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'list_payments',
    {
      description:
        'List payment requests with pagination and filters from the Wallet API.' +
        ' Assume that you are using an admin account unless you are told otherwise. ',
      inputSchema: {
        merchantId: z
          .string()
          .describe(
            'Merchant identifier. Ignored for non-admin accounts (results are scoped to the authenticated merchant). ' +
              "If no merchantId is specified (that is, if you don't know the merchantId), pass an empty string (not null or undefined). ",
          ),
        id: z
          .string()
          .optional()
          .describe('Filter by Hashids-encoded payment ID.'),
        userId: z
          .string()
          .optional()
          .describe(
            "Filter by user ID. If no user ID is specified (that is, if you don't know the userId), pass an empty string (not null or undefined). ",
          ),
        status: paymentStatusSchema
          .optional()
          .describe('Filter by payment status.'),
        reference: z
          .string()
          .optional()
          .describe('Filter by payment reference.'),
        customerPhone: z
          .string()
          .optional()
          .describe('Filter by customer phone number.'),
        requestDateStart: z
          .string()
          .optional()
          .describe('Filter payments from this datetime (inclusive).'),
        requestDateEnd: z
          .string()
          .optional()
          .describe('Filter payments until this datetime (inclusive).'),
        type: paymentTypeSchema.optional().describe('Filter by payment type.'),
        page: z.number().optional().describe('Page number (default 1).'),
        pageSize: z
          .number()
          .optional()
          .describe('Items per page (default 10).'),
        orderBy: z
          .enum([
            'status',
            'merchantId',
            'userId',
            'requestDate',
            'updateDate',
            'expirationDate',
            'customerName',
            'customerEmail',
            'customerPhone',
            'type',
          ])
          .optional()
          .describe('Field to sort by.'),
        direction: z
          .enum(['ASC', 'DESC'])
          .optional()
          .describe('Sort direction.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: list_payments', args);
      try {
        const result = await paymentsService.listPayments(args);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'format_payments_report',
    {
      description:
        'Return a fixed-schema JSON report of payment requests aggregated by type and status over a date range (counts, amount/credits totals). Prefer this over raw list_payments when the user wants a payment summary or breakdown. Pages through the Wallet API. Not for knowledge-base / RAG answers.',
      inputSchema: {
        requestDateStart: z
          .string()
          .describe('Start of the request-date range (inclusive).'),
        requestDateEnd: z
          .string()
          .describe('End of the request-date range (inclusive).'),
        merchantId: z
          .string()
          .optional()
          .describe(
            'Merchant identifier. Pass empty string (or omit) for admin “all merchants”.',
          ),
        userId: z
          .string()
          .optional()
          .describe(
            'Filter by user ID. Pass empty string (or omit) for all users.',
          ),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: format_payments_report', args);
      const report = await buildPaymentsReport(paymentsService, {
        requestDateStart: args.requestDateStart,
        requestDateEnd: args.requestDateEnd,
        merchantId: args.merchantId ?? '',
        userId: args.userId ?? '',
      });
      return jsonResult(report);
    },
  );

  server.registerTool(
    'get_payment',
    {
      description: 'Get a single payment request by its Hashids-encoded ID.',
      inputSchema: {
        id: z.string().describe('Hashids-encoded payment ID.'),
        checkProvider: z
          .boolean()
          .optional()
          .describe(
            'Whether to refresh status from the payment provider (default false).',
          ),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: get_payment', args);
      try {
        const result = await paymentsService.getPayment(
          args.id,
          args.checkProvider,
        );
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'cancel_payment',
    {
      description:
        'Cancel a payment request at the payment provider by its Hashids-encoded ID.',
      inputSchema: {
        id: z.string().describe('Hashids-encoded payment ID to cancel.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: cancel_payment', args);
      try {
        const result = await paymentsService.cancelPayment(args.id);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
