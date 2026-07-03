import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { jsonResult, toolError } from './tool-helpers';
import { KnowledgeService } from '../knowledge/knowledge.service';

export function registerKnowledgeTools(
  server: McpServer,
  knowledgeService: KnowledgeService,
): void {
  server.registerTool(
    'search_knowledge_base',
    {
      description:
        'Search the wallet knowledge base for relevant documentation using semantic (vector) search. ' +
        'Use this whenever the user asks about concepts, policies, definitions, limits, or how-to guidance ' +
        '(for example "what are credits?", "how do transfers work?", "what is the refund policy?") that is ' +
        'not available through the structured wallet/payment tools. Returns the most relevant documentation ' +
        'snippets, each with its source file. Ground your answer in the returned snippets and cite the source.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe('Natural-language question or search phrase.'),
        topK: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe('How many snippets to return. Defaults to 4.'),
      },
    },
    async (args) => {
      console.log('[MCP] tools/call: search_knowledge_base', args);
      try {
        const hits = await knowledgeService.search(args.query, args.topK ?? 4);
        console.log(
          `[MCP] tools/call: search_knowledge_base returned ${hits.length} hits`,
        );
        return jsonResult(hits);
      } catch (error) {
        return toolError(error);
      }
    },
  );
}
