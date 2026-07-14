import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as lancedb from '@lancedb/lancedb';
import { VoyageAIEmbedding } from '@llamaindex/voyage-ai';
import { Document, SentenceSplitter } from 'llamaindex';
import { PDFParse } from 'pdf-parse';

export interface KnowledgeSearchHit {
  text: string;
  source: string;
  chunkIndex: number;
  distance: number;
}

interface KnowledgeRow extends Record<string, unknown> {
  vector: number[];
  text: string;
  source: string;
  chunkIndex: number;
}

type KnowledgeSearchRow = KnowledgeRow & { _distance?: number };

const SUPPORTED_EXTENSIONS = /\.(md|markdown|txt|pdf)$/i;
const PDF_EXTENSION = /\.pdf$/i;
const DEFAULT_TOP_K = 4;
const DEFAULT_MODEL = 'voyage-3.5';
const DEFAULT_TABLE = 'knowledge';
const DEFAULT_CHUNK_SIZE = 512;
const DEFAULT_CHUNK_OVERLAP = 64;

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly dbPath: string;
  private readonly tableName: string;
  private readonly embedModel: VoyageAIEmbedding;
  private tablePromise: Promise<lancedb.Table> | null = null;

  constructor(private readonly config: ConfigService) {
    this.dbPath =
      this.config.get<string>('LANCEDB_PATH') ??
      path.join(process.cwd(), 'data', 'lancedb');
    this.tableName = this.config.get<string>('LANCEDB_TABLE') ?? DEFAULT_TABLE;

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

  private async openTable(): Promise<lancedb.Table> {
    if (!this.tablePromise) {
      this.tablePromise = (async () => {
        const db = await lancedb.connect(this.dbPath);
        const names = await db.tableNames();
        if (!names.includes(this.tableName)) {
          throw new Error(
            `Knowledge base table "${this.tableName}" was not found at "${this.dbPath}". ` +
              'Ingest documents first with: npm run ingest:knowledge -w @mcp-demo/mcp-server',
          );
        }
        return db.openTable(this.tableName);
      })();
    }
    return this.tablePromise;
  }

  async search(
    query: string,
    topK = DEFAULT_TOP_K,
  ): Promise<KnowledgeSearchHit[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const table = await this.openTable();

    const queryVector = await this.embedModel.getQueryEmbedding({
      type: 'text',
      text: trimmed,
    });
    if (!queryVector) {
      throw new Error('Failed to compute an embedding for the query.');
    }

    const rows = (await table
      .vectorSearch(queryVector)
      .limit(topK)
      .toArray()) as KnowledgeSearchRow[];

    return rows.map((row) => ({
      text: String(row.text ?? ''),
      source: String(row.source ?? ''),
      chunkIndex: Number(row.chunkIndex ?? 0),
      distance: typeof row._distance === 'number' ? row._distance : Number.NaN,
    }));
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

  async ingestFromDirectory(
    directory: string,
  ): Promise<{ files: number; chunks: number }> {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const files = entries
      .filter(
        (entry) => entry.isFile() && SUPPORTED_EXTENSIONS.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort();

    if (files.length === 0) {
      throw new Error(
        `No .md/.markdown/.txt/.pdf files found to ingest in "${directory}".`,
      );
    }

    const splitter = new SentenceSplitter({
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
    });

    const rows: KnowledgeRow[] = [];
    for (const fileName of files) {
      this.logger.log(`Processing embedding for file: ${fileName}`);

      const filePath = path.join(directory, fileName);
      const content = (await this.extractText(filePath)).trim();
      if (!content) {
        this.logger.warn(`Skipping empty file: ${fileName}`);
        continue;
      }

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
        });
        const textPreview = text.length > 80 ? `${text.slice(0, 80)}...` : text;
        this.logger.log(`  [${index}] chunk: "${textPreview}"`);
      });
    }

    if (rows.length === 0) {
      throw new Error(`No content could be extracted from "${directory}".`);
    }

    const db = await lancedb.connect(this.dbPath);
    const names = await db.tableNames();
    if (names.includes(this.tableName)) {
      await db.dropTable(this.tableName);
    }
    await db.createTable(this.tableName, rows);

    // Force the read path to reopen the freshly written table.
    this.tablePromise = null;

    return { files: files.length, chunks: rows.length };
  }
}
