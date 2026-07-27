export const KNOWLEDGE_VECTOR_STORE = Symbol('KNOWLEDGE_VECTOR_STORE');

export interface KnowledgeChunk {
  vector: number[];
  text: string;
  source: string;
  chunkIndex: number;
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
  upsertBySource(chunks: KnowledgeChunk[]): Promise<void>;
  reset(): Promise<void>;
}
