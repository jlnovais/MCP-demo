import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';
import { toSql } from 'pgvector';
import {
  KnowledgeChunk,
  KnowledgeSearchHit,
  KnowledgeVectorStore,
} from './vector-store.interface';

const DEFAULT_TABLE = 'knowledge_chunks';
const DEFAULT_PORT = 5432;

function quoteIdent(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(identifier)) {
    throw new Error(
      `Invalid Postgres identifier "${identifier}". Use letters, numbers, and underscores only.`,
    );
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}

export class PostgresVectorStore implements KnowledgeVectorStore {
  readonly name = 'postgres';
  private readonly logger = new Logger(PostgresVectorStore.name);
  private readonly tableName: string;
  private readonly quotedTable: string;
  private readonly pool: Pool;
  private readyDimensions: number | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('POSTGRES_HOST');
    const user = this.config.get<string>('POSTGRES_USER');
    const password = this.config.get<string>('POSTGRES_PASSWORD');
    const database = this.config.get<string>('POSTGRES_DB');
    const port = this.config.get<number>('POSTGRES_PORT') ?? DEFAULT_PORT;

    const missing = [
      ['POSTGRES_HOST', host],
      ['POSTGRES_USER', user],
      ['POSTGRES_DB', database],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(
        `VECTOR_STORE=postgres requires: ${missing.join(', ')}. ` +
          'Set them in apps/mcp-server/.env (see .env.template).',
      );
    }

    this.tableName = this.config.get<string>('POSTGRES_TABLE') ?? DEFAULT_TABLE;
    this.quotedTable = quoteIdent(this.tableName);

    // Empty / unset password is allowed (common for local Postgres).
    this.pool = new Pool({
      host,
      port,
      user,
      password: password ?? '',
      database,
    });
  }

  async ensureReady(vectorDimensions: number): Promise<void> {
    if (this.readyDimensions === vectorDimensions) {
      return;
    }

    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');

      const existing = await client.query<{
        udt_name: string;
      }>(
        `SELECT a.atttypid::regtype::text AS udt_name
         FROM pg_attribute a
         JOIN pg_class c ON c.oid = a.attrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE c.relname = $1
           AND n.nspname = 'public'
           AND a.attname = 'embedding'
           AND a.attnum > 0
           AND NOT a.attisdropped`,
        [this.tableName],
      );

      if (existing.rows.length > 0) {
        const typeName = existing.rows[0].udt_name;
        const match = /vector\((\d+)\)/i.exec(typeName);
        if (match) {
          const existingDims = Number(match[1]);
          if (existingDims !== vectorDimensions) {
            throw new Error(
              `Postgres table "${this.tableName}" has embedding vector(${existingDims}) ` +
                `but the current model produces ${vectorDimensions}-dimensional vectors. ` +
                'Re-ingest with --reset after changing VOYAGE_EMBED_MODEL.',
            );
          }
        }
      } else {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${this.quotedTable} (
            id BIGSERIAL PRIMARY KEY,
            text TEXT NOT NULL,
            source TEXT NOT NULL,
            chunk_index INT NOT NULL,
            embedding vector(${vectorDimensions}) NOT NULL,
            content_hash TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (source, chunk_index)
          )
        `);
      }

      // Existing tables created before timestamps / content_hash existed.
      await client.query(`
        ALTER TABLE ${this.quotedTable}
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          ADD COLUMN IF NOT EXISTS content_hash TEXT NOT NULL DEFAULT ''
      `);

      const indexName = `${this.tableName}_embedding_hnsw_idx`;
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${quoteIdent(indexName)}
        ON ${this.quotedTable}
        USING hnsw (embedding vector_cosine_ops)
      `);

      this.readyDimensions = vectorDimensions;
      this.logger.log(
        `Postgres knowledge table "${this.tableName}" ready (vector(${vectorDimensions}))`,
      );
    } finally {
      client.release();
    }
  }

  async search(
    queryVector: number[],
    topK: number,
  ): Promise<KnowledgeSearchHit[]> {
    await this.ensureReady(queryVector.length);

    const result = await this.pool.query<{
      text: string;
      source: string;
      chunk_index: number;
      distance: number;
    }>(
      `SELECT
         text,
         source,
         chunk_index,
         (embedding <=> $1::vector) AS distance
       FROM ${this.quotedTable}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [toSql(queryVector), topK],
    );

    return result.rows.map((row) => ({
      text: row.text,
      source: row.source,
      chunkIndex: Number(row.chunk_index),
      distance: Number(row.distance),
    }));
  }

  async getSourceContentHashes(): Promise<Map<string, string>> {
    const client = await this.pool.connect();
    try {
      const exists = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE c.relname = $1 AND n.nspname = 'public' AND c.relkind = 'r'
         ) AS exists`,
        [this.tableName],
      );
      if (!exists.rows[0]?.exists) {
        return new Map();
      }

      const hasColumn = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = $1
             AND column_name = 'content_hash'
         ) AS exists`,
        [this.tableName],
      );
      if (!hasColumn.rows[0]?.exists) {
        return new Map();
      }

      const result = await client.query<{
        source: string;
        content_hash: string;
      }>(
        `SELECT DISTINCT ON (source) source, content_hash
         FROM ${this.quotedTable}
         ORDER BY source`,
      );

      const hashes = new Map<string, string>();
      for (const row of result.rows) {
        if (row.content_hash) {
          hashes.set(row.source, row.content_hash);
        }
      }
      return hashes;
    } finally {
      client.release();
    }
  }

  async upsertBySource(chunks: KnowledgeChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }

    const dimensions = chunks[0].vector.length;
    await this.ensureReady(dimensions);

    const sources = [...new Set(chunks.map((chunk) => chunk.source))];
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM ${this.quotedTable} WHERE source = ANY($1::text[])`,
        [sources],
      );
      await this.insertChunks(client, chunks);
      await client.query('COMMIT');
      this.logger.log(
        `Upserted ${chunks.length} chunk(s) for ${sources.length} source(s)`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async reset(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      const exists = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE c.relname = $1 AND n.nspname = 'public' AND c.relkind = 'r'
         ) AS exists`,
        [this.tableName],
      );

      if (exists.rows[0]?.exists) {
        await client.query(`TRUNCATE TABLE ${this.quotedTable}`);
        this.logger.log(`Truncated Postgres table "${this.tableName}"`);
      }
      this.readyDimensions = null;
    } finally {
      client.release();
    }
  }

  private async insertChunks(
    client: PoolClient,
    chunks: KnowledgeChunk[],
  ): Promise<void> {
    const batchSize = 100;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const values: unknown[] = [];
      const placeholders: string[] = [];

      batch.forEach((chunk, index) => {
        const offset = index * 5;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}::vector, $${offset + 5})`,
        );
        values.push(
          chunk.text,
          chunk.source,
          chunk.chunkIndex,
          toSql(chunk.vector),
          chunk.contentHash,
        );
      });

      await client.query(
        `INSERT INTO ${this.quotedTable} (text, source, chunk_index, embedding, content_hash)
         VALUES ${placeholders.join(', ')}`,
        values,
      );
    }
  }
}
