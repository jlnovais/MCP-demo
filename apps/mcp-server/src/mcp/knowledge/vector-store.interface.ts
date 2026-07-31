export const KNOWLEDGE_VECTOR_STORE = Symbol('KNOWLEDGE_VECTOR_STORE');

export interface KnowledgeChunk {
  vector: number[];
  text: string;
  source: string;
  chunkIndex: number;
  /** SHA-256 of the source file's extracted text; shared by all chunks of that source. */
  contentHash: string;
}

export interface KnowledgeSearchHit {
  text: string;
  source: string;
  chunkIndex: number;
  distance: number;
}

export interface KnowledgeVectorStore {
  /** Backend id for logging (e.g. "lancedb" | "postgres"). */
  readonly name: string;
  ensureReady(vectorDimensions: number): Promise<void>;
  search(queryVector: number[], topK: number): Promise<KnowledgeSearchHit[]>;
  /** Map of source filename → contentHash. Empty if the store has no rows / no table. */
  getSourceContentHashes(): Promise<Map<string, string>>;
  upsertBySource(chunks: KnowledgeChunk[]): Promise<void>;
  reset(): Promise<void>;
}
