import { getEmbeddingsByDocument, getChunksByDocument } from './idb';

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
  documentId: string,
  queryEmbedding: Float32Array,
  k: number = 5
): Promise<Array<{ text: string; paragraphIndex: number; score: number }>> {
  const [embeddings, chunks] = await Promise.all([
    getEmbeddingsByDocument(documentId),
    getChunksByDocument(documentId),
  ]);

  const chunkMap = new Map(chunks.map((c) => [c.id, c]));

  const scored = embeddings
    .map(({ id, vector }) => {
      const chunk = chunkMap.get(id);
      if (!chunk) return null;
      return {
        text: chunk.text,
        paragraphIndex: chunk.paragraphIndex,
        score: cosineSimilarity(queryEmbedding, vector),
      };
    })
    .filter((r): r is { text: string; paragraphIndex: number; score: number } => r !== null);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, Math.min(k, scored.length));
}
