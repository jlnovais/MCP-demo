import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { KnowledgeService } from './knowledge.service';

/**
 * Standalone ingestion entrypoint.
 *
 * Reads .md/.markdown/.txt/.pdf/.html files from a directory (default: apps/mcp-server/knowledge),
 * chunks + embeds them with Voyage AI, and writes to the configured vector store
 * (VECTOR_STORE=postgres|lancedb; default postgres).
 *
 * By default, skips files whose content hash already matches the store (upsert by source
 * for new/changed files only). Pass --reset to delete all embeddings and re-embed everything.
 *
 * Usage:
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server -- --reset
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs --reset
 */
function parseArgs(argv: string[]): { directory?: string; reset: boolean } {
  let reset = false;
  let directory: string | undefined;

  for (const arg of argv) {
    if (arg === '--reset') {
      reset = true;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}. Supported: --reset`);
    }
    if (directory) {
      throw new Error(
        `Unexpected extra argument: ${arg}. Pass at most one directory path.`,
      );
    }
    directory = arg;
  }

  return { directory, reset };
}

async function main(): Promise<void> {
  const { directory: argDir, reset } = parseArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const knowledgeService = app.get(KnowledgeService, { strict: false });

    const directory = argDir
      ? path.resolve(argDir)
      : path.join(process.cwd(), 'knowledge');

    console.log(`Vector store: ${knowledgeService.vectorStoreName}`);
    console.log(
      `Ingesting knowledge base from: ${directory}` +
        (reset
          ? ' (reset: delete all embeddings and re-embed)'
          : ' (skip unchanged by content hash)'),
    );
    const result = await knowledgeService.ingestFromDirectory(directory, {
      reset,
    });
    console.log(
      `Done. Indexed ${result.chunks} chunks from ${result.files} file(s)` +
        (result.skipped > 0 ? `, skipped ${result.skipped} unchanged` : '') +
        (result.reset ? ' after reset' : '') +
        '.',
    );
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Knowledge ingestion failed:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
