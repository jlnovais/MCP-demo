import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonResult, toolError } from './tool-helpers';
import { UtilitiesDatesService } from '../utilities/utilities-dates.service';

export function registerUtilitiesDatesTools(
  server: McpServer,
  utilitiesDatesService: UtilitiesDatesService,
): void {
  server.registerTool(
    'get_current_datetime',
    {
      description:
        'Return the server\'s current date and time as a UTC ISO 8601 string (e.g. 2026-06-29T14:30:00.000Z). Use when you need the real "now" for deadlines, scheduling, or as input to add_duration_to_datetime.',
      inputSchema: {},
    },
    (args) => {
      console.log('[MCP] tools/call: get_current_datetime', args);
      try {
        const result = utilitiesDatesService.getCurrentDatetime();

        console.log('[MCP] tools/call: get_current_datetime result', result);

        return jsonResult(result);
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    'add_duration_to_datetime',
    {
      description:
        'Shift an ISO 8601 datetime forward or backward by any combination of years, months, days, hours, minutes, and seconds. Use positive values to add time and negative values to subtract. Returns the result as a UTC ISO 8601 string.',
      inputSchema: {
        datetime: z
          .string()
          .describe(
            'Starting datetime as a UTC ISO 8601 string (e.g. from get_current_datetime).',
          ),
        duration: z
          .object({
            years: z
              .number()
              .optional()
              .describe(
                'Calendar years to shift; positive forward, negative backward.',
              ),
            months: z
              .number()
              .optional()
              .describe(
                'Calendar months to shift; positive forward, negative backward.',
              ),
            days: z
              .number()
              .optional()
              .describe('Days to shift; positive forward, negative backward.'),
            hours: z
              .number()
              .optional()
              .describe('Hours to shift; positive forward, negative backward.'),
            minutes: z
              .number()
              .optional()
              .describe(
                'Minutes to shift; positive forward, negative backward.',
              ),
            seconds: z
              .number()
              .optional()
              .describe(
                'Seconds to shift; positive forward, negative backward.',
              ),
          })
          .describe(
            'Time offset to apply. All fields are optional and combine; omit or use 0 for no change in that unit.',
          ),
      },
    },
    (args) => {
      console.log('[MCP] tools/call: add_duration_to_datetime', args);
      try {
        const datetime = utilitiesDatesService.addDurationToDatetime(
          new Date(args.datetime),
          args.duration,
        );

        console.log(
          '[MCP] tools/call: add_duration_to_datetime result',
          datetime,
        );

        return jsonResult(datetime.toISOString());
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
