import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

function joinLines(lines: Array<string | undefined>): string {
  return lines.filter((line): line is string => line !== undefined).join('\n');
}

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
              text: joinLines([
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
                `- inApp: ignore this parameter`,
                `- isAuthorization: ignore this parameter`,
              ]),
            },
          },
        ],
      };
    },
  );

  // Explicit chaining demo: create → get → report status (fixed order).
  server.registerPrompt(
    'create_and_verify_mbway_payment',
    {
      title: 'Create & Verify MB WAY Payment',
      description:
        'Chained workflow: create_payment → get_payment → report status. Steps must run in order.',
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
      console.log('[MCP] prompts/get: create_and_verify_mbway_payment', args);
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
              text: joinLines([
                'Run this chained payment workflow. Execute the steps in order. Do not skip steps. Do not call tools in parallel.',
                '',
                '## Step 1 — create_payment',
                'Create an MB WAY payment with these parameters:',
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
                '- inApp: ignore this parameter',
                '',
                '## Step 2 — get_payment',
                'From the create_payment result, take the Hashids-encoded payment id.',
                'Call get_payment with that id and checkProvider=true.',
                '',
                '## Step 3 — report',
                'Summarize for the user: payment id, status, amount, customer, and any Multibanco/MB WAY reference fields returned.',
                'If any step fails, stop and explain the error; do not invent a later step result.',
              ]),
            },
          },
        ],
      };
    },
  );

  // Explicit chaining demo: list → get → cancel (fixed order).
  server.registerPrompt(
    'cancel_payment_workflow',
    {
      title: 'Cancel Payment Workflow',
      description:
        'Chained workflow: list_payments → get_payment → cancel_payment. Steps must run in order.',
      argsSchema: {
        merchantId: z
          .string()
          .describe(
            'Merchant ID used when listing payments. Pass empty string if unknown / non-admin.',
          ),
        userId: z
          .string()
          .optional()
          .describe(
            'Optional user ID filter for list_payments. Pass empty string if unknown.',
          ),
        paymentId: z
          .string()
          .optional()
          .describe(
            'If known, Hashids-encoded payment ID to cancel. When set, still run get_payment before cancel_payment; list_payments may be skipped.',
          ),
        status: z
          .enum([
            'NEW',
            'ERROR',
            'UPDATE',
            'PAID',
            'REFUSED',
            'REFUNDED',
            'UNKNOWN',
            'CANCELED',
          ])
          .optional()
          .describe(
            'Optional status filter for list_payments (e.g. NEW or UPDATE when looking for cancelable payments).',
          ),
      },
    },
    (args) => {
      console.log('[MCP] prompts/get: cancel_payment_workflow', args);
      const { merchantId, userId, paymentId, status } = args;
      const hasPaymentId = Boolean(paymentId && paymentId.trim() !== '');

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: joinLines([
                'Run this chained cancel-payment workflow. Execute the steps in order. Do not skip required steps. Do not call tools in parallel.',
                '',
                hasPaymentId
                  ? joinLines([
                      '## Step 1 — resolve target',
                      `A payment id was provided: ${paymentId}`,
                      'Skip list_payments.',
                      '',
                      '## Step 2 — get_payment',
                      `Call get_payment with id=${paymentId} (checkProvider=true).`,
                      'Confirm the payment exists and is appropriate to cancel. If it is already CANCELED, PAID, or otherwise not cancelable, stop and explain.',
                    ])
                  : joinLines([
                      '## Step 1 — list_payments',
                      'Call list_payments with:',
                      '',
                      `- merchantId: ${merchantId}`,
                      userId !== undefined
                        ? `- userId: ${userId}`
                        : '- userId: (empty string if unknown)',
                      status ? `- status: ${status}` : undefined,
                      '- page: 1',
                      '- pageSize: 10',
                      '- orderBy: requestDate',
                      '- direction: DESC',
                      '',
                      'From the results, pick the best cancelable candidate (prefer NEW or UPDATE).',
                      'If none are cancelable, stop and explain. If several match and it is ambiguous, ask the user which id to cancel instead of guessing.',
                      '',
                      '## Step 2 — get_payment',
                      'Call get_payment with the chosen Hashids id and checkProvider=true.',
                      'Confirm it is still appropriate to cancel before continuing.',
                    ]),
                '',
                '## Step 3 — cancel_payment',
                'Call cancel_payment with that same id.',
                '',
                '## Step 4 — report',
                'Summarize: which payment was canceled (id, amount/customer if known), previous status, and the cancel result.',
                'If any step fails, stop and explain the error; do not invent a later step result.',
              ]),
            },
          },
        ],
      };
    },
  );
}
