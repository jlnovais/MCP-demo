import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerPaymentsPrompts(server: McpServer): void {
  server.registerPrompt(
    'create_mbway_payment',
    {
      title: 'Create MB WAY Payment',
      description:
        'Guided workflow to create an MB WAY payment request via the Wallet API.',
      argsSchema: {
        userId: z.string().describe('User ID associated with the merchant.'),
        amount: z.coerce.number().describe('Amount in euros to charge.'),
        customerName: z.string().describe('Customer full name.'),
        customerEmail: z.string().describe('Customer email address.'),
        customerPhone: z
          .string()
          .describe('Customer MB WAY phone number (required for MB WAY).'),
        description: z
          .string()
          .describe('Payment description shown in the MB WAY mobile app.'),
        merchantId: z
          .string()
          .optional()
          .describe(
            'Merchant ID. Required for admin accounts; ignored for non-admin accounts.',
          ),
      },
    },
    (args) => {
      console.log('[MCP] prompts/get: create_mbway_payment', args);
      const {
        userId,
        amount,
        customerName,
        customerEmail,
        customerPhone,
        description,
        merchantId,
      } = args;
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: [
                'Create an MB WAY payment using the create_payment tool with these parameters:',
                '',
                '- type: MBWAY',
                `- userId: ${userId}`,
                `- amount: ${amount}`,
                '- credits: 0',
                '- expirationMinutes: 0',
                `- customerName: ${customerName}`,
                `- customerEmail: ${customerEmail}`,
                `- customerPhone: ${customerPhone}`,
                `- description: ${description}`,
                merchantId ? `- merchantId: ${merchantId}` : undefined,
                `- inApp: false`,
              ]
                .filter((line): line is string => line !== undefined)
                .join('\n'),
            },
          },
        ],
      };
    },
  );
}
