import * as path from 'node:path';
import {
  HTMLNodeParser,
  MarkdownNodeParser,
  SentenceSplitter,
  type Document,
  type TextNode,
} from 'llamaindex';

export const CHUNKER_VALUES = ['sentence', 'markdown', 'html'] as const;
export type ChunkerName = (typeof CHUNKER_VALUES)[number];

export const KNOWLEDGE_FILE_TYPES = [
  'text',
  'html',
  'markdown',
  'pdf',
] as const;
export type KnowledgeFileType = (typeof KNOWLEDGE_FILE_TYPES)[number];

export const DEFAULT_CHUNKER: ChunkerName = 'sentence';
export const DEFAULT_CHUNK_SIZE = 512;
export const DEFAULT_CHUNK_OVERLAP = 64;

/** Per-type chunker env (empty/undefined → fall back to `default`). */
export interface ChunkerEnvConfig {
  default?: string | null;
  text?: string | null;
  html?: string | null;
  markdown?: string | null;
  pdf?: string | null;
}

/** Shared LlamaIndex node-parser surface used by ingest. */
export interface KnowledgeNodeParser {
  getNodesFromDocuments(
    documents: Document[],
  ): TextNode[] | Promise<TextNode[]>;
}

export function isChunkerName(value: string): value is ChunkerName {
  return (CHUNKER_VALUES as readonly string[]).includes(value);
}

/**
 * Resolve a single chunker name from an explicit value and/or env string.
 * Defaults to `sentence`. Throws on unknown non-empty values.
 */
export function resolveChunker(
  explicit?: string | null,
  fromEnv?: string | null,
): ChunkerName {
  const raw = (explicit ?? fromEnv ?? DEFAULT_CHUNKER).trim().toLowerCase();
  if (!raw) {
    return DEFAULT_CHUNKER;
  }
  if (!isChunkerName(raw)) {
    throw new Error(
      `Unsupported chunker "${raw}". Use one of: ${CHUNKER_VALUES.join(', ')}.`,
    );
  }
  return raw;
}

/** Map a knowledge file name to a logical type (or `undefined` if unknown). */
export function resolveFileType(
  fileName: string,
): KnowledgeFileType | undefined {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.txt':
      return 'text';
    case '.html':
    case '.htm':
      return 'html';
    case '.md':
    case '.markdown':
      return 'markdown';
    case '.pdf':
      return 'pdf';
    default:
      return undefined;
  }
}

function typedChunkerEnv(
  config: ChunkerEnvConfig,
  fileType: KnowledgeFileType | undefined,
): string | null | undefined {
  if (!fileType) {
    return undefined;
  }
  return config[fileType];
}

/**
 * Resolve the chunker for one file.
 * Priority: CLI override → type-specific env → default `CHUNKER` → `sentence`.
 */
export function resolveChunkerForFile(
  fileName: string,
  config: ChunkerEnvConfig = {},
  explicitCli?: string | null,
): ChunkerName {
  if (explicitCli != null && String(explicitCli).trim() !== '') {
    return resolveChunker(explicitCli);
  }

  const fileType = resolveFileType(fileName);
  const typed = typedChunkerEnv(config, fileType);
  if (typed != null && String(typed).trim() !== '') {
    return resolveChunker(typed);
  }

  return resolveChunker(undefined, config.default);
}

export function createNodeParser(
  chunker: ChunkerName = DEFAULT_CHUNKER,
  options?: { chunkSize?: number; chunkOverlap?: number },
): KnowledgeNodeParser {
  if (chunker === 'markdown') {
    return new MarkdownNodeParser();
  }
  if (chunker === 'html') {
    return new HTMLNodeParser();
  }

  return new SentenceSplitter({
    chunkSize: options?.chunkSize ?? DEFAULT_CHUNK_SIZE,
    chunkOverlap: options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP,
  });
}

/** Split one document and return non-empty trimmed chunk texts. */
export async function splitDocumentText(
  parser: KnowledgeNodeParser,
  document: Document,
): Promise<string[]> {
  const nodes = await parser.getNodesFromDocuments([document]);
  return nodes
    .map((node) => node.getText().trim())
    .filter((text) => text.length > 0);
}
