import type { DocumentChunk } from './types';

export interface RetrievedChunk {
  text: string;
  paragraphIndex: number;
  score: number;
  source: 'document' | 'history';
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function retrieveTopK(
  _documentId: string,
  _queryEmbedding: Float32Array,
  _k: number = 5
): Promise<RetrievedChunk[]> {
  // Keyword-based retrieval now handled via nlp-fallback.ts rankChunksByKeywords
  // This function is kept for API compatibility but returns empty
  // since we removed the transformer embeddings
  return [];
}