import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'node:path';
import * as lancedb from '@lancedb/lancedb';
import {
  KnowledgeChunk,
  KnowledgeSearchHit,
  KnowledgeVectorStore,
} from './vector-store.interface';

interface KnowledgeRow extends Record<string, unknown> {
  vector: number[];
  text: string;
  source: string;
  chunkIndex: number;
}

type KnowledgeSearchRow = KnowledgeRow & { _distance?: number };

const DEFAULT_TABLE = 'knowledge';

export class LanceDbVectorStore implements KnowledgeVectorStore {
  readonly name = 'lancedb';
  private readonly logger = new Logger(LanceDbVectorStore.name);
  private readonly dbPath: string;
  private readonly tableName: string;
  private tablePromise: Promise<lancedb.Table> | null = null;

  constructor(private readonly config: ConfigService) {
    this.dbPath =
      this.config.get<string>('LANCEDB_PATH') ??
      path.join(process.cwd(), 'data', 'lancedb');
    this.tableName = this.config.get<string>('LANCEDB_TABLE') ?? DEFAULT_TABLE;
  }

  ensureReady(vectorDimensions: number): Promise<void> {
    // LanceDB creates the table on first write; dimensions are unused here.
    void vectorDimensions;
    return Promise.resolve();
  }

  private async connect(): Promise<lancedb.Connection> {
    return lancedb.connect(this.dbPath);
  }

  private async openTable(): Promise<lancedb.Table> {
    if (!this.tablePromise) {
      this.tablePromise = (async () => {
        const db = await this.connect();
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

  private invalidateTableCache(): void {
    this.tablePromise = null;
  }

  async search(
    queryVector: number[],
    topK: number,
  ): Promise<KnowledgeSearchHit[]> {
    const table = await this.openTable();
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

  private async readAllRows(db: lancedb.Connection): Promise<KnowledgeRow[]> {
    const names = await db.tableNames();
    if (!names.includes(this.tableName)) {
      return [];
    }
    const table = await db.openTable(this.tableName);
    const rows = (await table.query().toArray()) as KnowledgeRow[];
    return rows.map((row) => ({
      vector: row.vector,
      text: String(row.text ?? ''),
      source: String(row.source ?? ''),
      chunkIndex: Number(row.chunkIndex ?? 0),
    }));
  }

  private async writeAllRows(
    db: lancedb.Connection,
    rows: KnowledgeChunk[],
  ): Promise<void> {
    const names = await db.tableNames();
    if (names.includes(this.tableName)) {
      await db.dropTable(this.tableName);
    }
    if (rows.length === 0) {
      this.invalidateTableCache();
      return;
    }
    await db.createTable(this.tableName, rows as KnowledgeRow[]);
    this.invalidateTableCache();
  }

  async upsertBySource(chunks: KnowledgeChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const db = await this.connect();
    const sources = new Set(chunks.map((chunk) => chunk.source));
    const existing = await this.readAllRows(db);
    const kept = existing.filter((row) => !sources.has(row.source));
    const merged: KnowledgeChunk[] = [...kept, ...chunks];

    this.logger.log(
      `Upserting ${chunks.length} chunk(s) for ${sources.size} source(s); ` +
        `keeping ${kept.length} existing row(s)`,
    );
    await this.writeAllRows(db, merged);
  }

  async reset(): Promise<void> {
    const db = await this.connect();
    const names = await db.tableNames();
    if (names.includes(this.tableName)) {
      await db.dropTable(this.tableName);
      this.logger.log(`Dropped LanceDB table "${this.tableName}"`);
    }
    this.invalidateTableCache();
  }
}
