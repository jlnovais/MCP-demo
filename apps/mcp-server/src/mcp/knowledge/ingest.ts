import * as path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { KnowledgeService } from './knowledge.service';

/**
 * Standalone ingestion entrypoint.
 *
 * Reads .md/.markdown/.txt files from a directory (default: apps/mcp-server/knowledge),
 * chunks + embeds them with Voyage AI, and (re)writes the LanceDB knowledge table.
 *
 * Usage:
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server
 *   npm run ingest:knowledge -w @mcp-demo/mcp-server -- ./path/to/docs
 */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const knowledge = app.get(KnowledgeService, { strict: false });

    const argDir = process.argv[2];
    const directory = argDir
      ? path.resolve(argDir)
      : path.join(process.cwd(), 'knowledge');

    console.log(`Ingesting knowledge base from: ${directory}`);
    const { files, chunks } = await knowledge.ingestFromDirectory(directory);
    console.log(`Done. Indexed ${chunks} chunks from ${files} file(s).`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error('Knowledge ingestion failed:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
