import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { VoyageAIEmbedding } from '@llamaindex/voyage-ai';
import { Document, SentenceSplitter } from 'llamaindex';
import { PDFParse } from 'pdf-parse';
import {
  KNOWLEDGE_VECTOR_STORE,
  KnowledgeChunk,
  KnowledgeSearchHit,
} from './vector-store.interface';
import type { KnowledgeVectorStore } from './vector-store.interface';

export type { KnowledgeSearchHit };

const SUPPORTED_EXTENSIONS = /\.(md|markdown|txt|pdf|html)$/i;
const PDF_EXTENSION = /\.pdf$/i;
const DEFAULT_TOP_K = 4;
const DEFAULT_MODEL = 'voyage-3.5';
const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_CHUNK_OVERLAP = 64;

export interface IngestOptions {
  /** When true, delete all embeddings before writing. Default: false (upsert by source). */
  reset?: boolean;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly embedModel: VoyageAIEmbedding;

  constructor(
    private readonly config: ConfigService,
    @Inject(KNOWLEDGE_VECTOR_STORE)
    private readonly store: KnowledgeVectorStore,
  ) {
    const apiKey = this.config.get<string>('VOYAGE_API_KEY');
    const model =
      this.config.get<string>('VOYAGE_EMBED_MODEL') ?? DEFAULT_MODEL;

    // useInputTypes: 'both' lets Voyage tag queries and documents differently,
    // which improves retrieval quality without any extra wiring on our side.
    this.embedModel = new VoyageAIEmbedding({
      ...(apiKey ? { apiKey } : {}),
      model,
      useInputTypes: 'both',
    });
  }

  get vectorStoreName(): string {
    return this.store.name;
  }

  async search(
    query: string,
    topK = DEFAULT_TOP_K,
  ): Promise<KnowledgeSearchHit[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const queryVector = await this.embedModel.getQueryEmbedding({
      type: 'text',
      text: trimmed,
    });
    if (!queryVector) {
      throw new Error('Failed to compute an embedding for the query.');
    }

    return this.store.search(queryVector, topK);
  }

  private async extractText(filePath: string): Promise<string> {
    if (PDF_EXTENSION.test(filePath)) {
      const buffer = await fs.readFile(filePath);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        // pageJoiner: '' suppresses the default "-- page X of Y --" markers so
        // they don't leak into the embedded text.
        const result = await parser.getText({ pageJoiner: '' });
        // PDF extraction tends to produce stray line breaks and trailing spaces;
        // collapse them so the sentence splitter sees clean paragraphs.
        return result.text
          .replace(/[ \t]+\n/g, '\n')
          .replace(/\n{3,}/g, '\n\n');
      } finally {
        await parser.destroy();
      }
    }

    return fs.readFile(filePath, 'utf-8');
  }

  private contentHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  async ingestFromDirectory(
    directory: string,
    options: IngestOptions = {},
  ): Promise<{
    files: number;
    chunks: number;
    skipped: number;
    reset: boolean;
  }> {
    const reset = options.reset === true;

    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = entries
      .filter(
        (entry) => entry.isFile() && SUPPORTED_EXTENSIONS.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort();

    if (files.length === 0) {
      throw new Error(
        `No .md/.markdown/.txt/.pdf/.html files found to ingest in "${directory}".`,
      );
    }

    const existingHashes = reset
      ? new Map<string, string>()
      : await this.store.getSourceContentHashes();

    const splitter = new SentenceSplitter({
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    });

    const rows: KnowledgeChunk[] = [];
    let skipped = 0;
    let emptySkipped = 0;

    for (const fileName of files) {
      const filePath = path.join(directory, fileName);
      const content = (await this.extractText(filePath)).trim();
      if (!content) {
        this.logger.warn(`Skipping empty file: ${fileName}`);
        emptySkipped += 1;
        continue;
      }

      const hash = this.contentHash(content);
      if (!reset && existingHashes.get(fileName) === hash) {
        this.logger.log(`Skipping unchanged file: ${fileName}`);
        skipped += 1;
        continue;
      }

      this.logger.log(`Processing embedding for file: ${fileName}`);

      const nodes = splitter.getNodesFromDocuments([
        new Document({ text: content, metadata: { source: fileName } }),
      ]);
      const chunks = nodes
        .map((node) => node.getText().trim())
        .filter((text) => text.length > 0);

      const vectors = await this.embedModel.getTextEmbeddings(chunks);
      this.logger.log(`Computed ${chunks.length} embeddings for ${fileName}`);
      chunks.forEach((text, index) => {
        const vector = vectors[index];
        rows.push({
          vector,
          text,
          source: fileName,
          chunkIndex: index,
          contentHash: hash,
        });
        const textPreview = text.length > 80 ? `${text.slice(0, 80)}...` : text;
        this.logger.log(`  [${index}] chunk: "${textPreview}"`);
      });
    }

    const processedFiles = files.length - skipped - emptySkipped;

    if (rows.length === 0) {
      if (skipped > 0 && !reset) {
        this.logger.log(
          `All ${skipped} file(s) unchanged; nothing to re-embed`,
        );
        return { files: 0, chunks: 0, skipped, reset };
      }
      throw new Error(`No content could be extracted from "${directory}".`);
    }

    const dimensions = rows[0].vector.length;
    await this.store.ensureReady(dimensions);

    if (reset) {
      this.logger.log(
        `Resetting vector store "${this.store.name}" before ingest`,
      );
      await this.store.reset();
      await this.store.ensureReady(dimensions);
    }

    await this.store.upsertBySource(rows);

    return { files: processedFiles, chunks: rows.length, skipped, reset };
  }
}
