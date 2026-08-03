import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Document } from 'llamaindex';
import {
  CHUNKER_VALUES,
  createNodeParser,
  splitDocumentText,
  type ChunkerName,
} from './chunker';

/**
 * Offline demo: split the same file with SentenceSplitter and MarkdownNodeParser
 * and print chunk counts + previews. No Voyage / vector store required.
 *
 * Usage:
 *   npm run compare:chunkers -w @mcp-demo/mcp-server
 *   npm run compare:chunkers -w @mcp-demo/mcp-server -- knowledge/wallet-faq.md
 */
function preview(text: string, max = 100): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

async function main(): Promise<void> {
  const argPath = process.argv[2];
  const filePath = argPath
    ? path.resolve(argPath)
    : path.join(process.cwd(), 'knowledge', 'wallet-faq.md');

  const content = (await fs.readFile(filePath, 'utf-8')).trim();
  if (!content) {
    throw new Error(`File is empty: ${filePath}`);
  }

  console.log(`Comparing chunkers on: ${filePath}`);
  console.log(`Source length: ${content.length} characters\n`);

  for (const chunker of CHUNKER_VALUES as readonly ChunkerName[]) {
    const chunks = await splitDocumentText(
      createNodeParser(chunker),
      new Document({
        text: content,
        metadata: { source: path.basename(filePath), chunker },
      }),
    );

    console.log(`=== ${chunker} (${chunks.length} chunk(s)) ===`);
    chunks.forEach((text, index) => {
      console.log(`  [${index}] (${text.length} chars) ${preview(text)}`);
    });
    console.log('');
  }

  console.log(
    'Tip: ingest with --chunker markdown --tag-chunker (and again with sentence)',
    'so both live in the store, then search the same query and compare sources.',
  );
}

main().catch((error) => {
  console.error('Chunker comparison failed:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
