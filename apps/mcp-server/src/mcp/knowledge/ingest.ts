import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import {
  CHUNKER_VALUES,
  DEFAULT_CHUNKER,
  isChunkerName,
  type ChunkerName,
} from './chunker';
import { KnowledgeService } from './knowledge.service';

/**
 * Standalone ingestion entrypoint.
 *
 * Reads .md/.markdown/.txt/.pdf/.html files from a directory (default: apps/mcp-server/knowledge),
 * chunks + embeds them with Voyage AI, and writes to the configured vector store
 * (VECTOR_STORE=postgres|lancedb; default postgres).
 *
 * Chunking is controlled by env:
 *   CHUNKER (default), CHUNKER_TEXT, CHUNKER_HTML, CHUNKER_MARKDOWN, CHUNKER_PDF
 * Values: sentence | markdown | html. Empty type keys inherit CHUNKER.
 * CLI --chunker forces one chunker for every file (demo override).
 *
 * By default, skips files whose content+chunker hash already matches the store.
 * Pass --reset to delete all embeddings and re-embed everything.
 * Pass --tag-chunker to store sources as file#chunker so chunkers can coexist.
 *
 * Usage:
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server -- --reset
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server -- --chunker markdown
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server -- --chunker markdown --tag-chunker
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs --reset
 */
function parseArgs(argv: string[]): {
  directory?: string;
  reset: boolean;
  chunker?: ChunkerName;
  tagChunker: boolean;
} {
  let reset = false;
  let tagChunker = false;
  let chunker: ChunkerName | undefined;
  let directory: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--reset') {
      reset = true;
      continue;
    }
    if (arg === '--tag-chunker') {
      tagChunker = true;
      continue;
    }
    if (arg === '--chunker') {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(
          `--chunker requires one of: ${CHUNKER_VALUES.join(', ')}`,
        );
      }
      if (!isChunkerName(value.toLowerCase())) {
        throw new Error(
          `Unknown chunker "${value}". Use one of: ${CHUNKER_VALUES.join(', ')}.`,
        );
      }
      chunker = value.toLowerCase() as ChunkerName;
      i += 1;
      continue;
    }
    if (arg.startsWith('--chunker=')) {
      const value = arg.slice('--chunker='.length).toLowerCase();
      if (!isChunkerName(value)) {
        throw new Error(
          `Unknown chunker "${value}". Use one of: ${CHUNKER_VALUES.join(', ')}.`,
        );
      }
      chunker = value;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(
        `Unknown flag: ${arg}. Supported: --reset, --chunker <${CHUNKER_VALUES.join('|')}>, --tag-chunker`,
      );
    }
    if (directory) {
      throw new Error(
        `Unexpected extra argument: ${arg}. Pass at most one directory path.`,
      );
    }
    directory = arg;
  }

  return { directory, reset, chunker, tagChunker };
}

async function main(): Promise<void> {
  const {
    directory: argDir,
    reset,
    chunker,
    tagChunker,
  } = parseArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const knowledgeService = app.get(KnowledgeService, { strict: false });

    const directory = argDir
      ? path.resolve(argDir)
      : path.join(process.cwd(), 'knowledge');

    console.log(`Vector store: ${knowledgeService.vectorStoreName}`);
    if (chunker) {
      console.log(`Chunker: CLI override (${chunker}) for all files`);
    } else {
      console.log(
        `Chunker: per-type env (CHUNKER_*); default=${DEFAULT_CHUNKER} if unset`,
      );
    }
    console.log(
      `Ingesting knowledge base from: ${directory}` +
        (reset
          ? ' (reset: delete all embeddings and re-embed)'
          : ' (skip unchanged by content+chunker hash)') +
        (tagChunker ? ' (tag sources as file#chunker)' : ''),
    );
    const result = await knowledgeService.ingestFromDirectory(directory, {
      reset,
      chunker,
      tagChunker,
    });
    console.log(
      `Done. Indexed ${result.chunks} chunks from ${result.files} file(s)` +
        ` (defaultChunker=${result.defaultChunker})` +
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
