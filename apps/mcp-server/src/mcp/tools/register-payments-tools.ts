import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { WalletPaymentsService } from '../api/wallet-payments.service';
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
          .describe('Customer phone number. Required when type is MBWAY.'),
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
        'List payment requests with pagination and filters from the Wallet API.',
      inputSchema: {
        merchantId: z
          .string()
          .describe(
            'Merchant identifier. Ignored for non-admin accounts (results are scoped to the authenticated merchant).',
          ),
        id: z
          .string()
          .optional()
          .describe('Filter by Hashids-encoded payment ID.'),
        userId: z.string().optional().describe('Filter by user ID.'),
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
      try {
        const result = await paymentsService.listPayments(args);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
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
      try {
        const result = await paymentsService.cancelPayment(args.id);
        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
