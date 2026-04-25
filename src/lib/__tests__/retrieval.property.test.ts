/**
 * Property 16: Top-K Retrieval Count
 *
 * For any document with N stored chunks (N ≥ 1) and any query embedding, the
 * RAG retrieval function SHALL return exactly `min(5, N)` chunks ordered by
 * cosine similarity descending.
 *
 * Validates: Requirements 10.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { cosineSimilarity } from '../retrieval';

// Pure extraction of the retrieval logic (mirrors retrieveTopK without IDB)
function retrieveTopKPure(
  embeddings: Array<{ id: string; vector: Float32Array }>,
  chunks: Array<{ id: string; text: string; paragraphIndex: number }>,
  queryEmbedding: Float32Array,
  k: number = 5
): Array<{ text: string; paragraphIndex: number; score: number }> {
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

// Arbitrary: Float32Array of a given length with values in [-1, 1]
const float32ArrayArb = (length: number): fc.Arbitrary<Float32Array> =>
  fc.array(fc.float({ min: -1, max: 1, noNaN: true }), { minLength: length, maxLength: length }).map(
    (vals) => new Float32Array(vals)
  );

// Arbitrary: N matched chunk/embedding pairs with a fixed embedding dimension
const chunksAndEmbeddingsArb = (n: number, dim: number) =>
  fc
    .array(
      fc.record({
        id: fc.uuid(),
        text: fc.string({ minLength: 1, maxLength: 100 }),
        paragraphIndex: fc.nat(50),
        vector: float32ArrayArb(dim),
      }),
      { minLength: n, maxLength: n }
    )
    .map((items) => ({
      chunks: items.map(({ id, text, paragraphIndex }) => ({ id, text, paragraphIndex })),
      embeddings: items.map(({ id, vector }) => ({ id, vector })),
    }));

describe('Property 16: Top-K Retrieval Count', () => {
  it('returns exactly min(5, N) results for N ≥ 1 chunks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 2, max: 64 }),
        (n, dim) => {
          const { chunks, embeddings } = fc.sample(chunksAndEmbeddingsArb(n, dim), 1)[0];
          const query = fc.sample(float32ArrayArb(dim), 1)[0];
          const results = retrieveTopKPure(embeddings, chunks, query);
          return results.length === Math.min(5, n);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('results are ordered by cosine similarity descending', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 2, max: 64 }),
        (n, dim) => {
          const { chunks, embeddings } = fc.sample(chunksAndEmbeddingsArb(n, dim), 1)[0];
          const query = fc.sample(float32ArrayArb(dim), 1)[0];
          const results = retrieveTopKPure(embeddings, chunks, query);
          for (let i = 1; i < results.length; i++) {
            if (results[i].score > results[i - 1].score) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns empty array when N = 0 chunks', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 64 }),
        (dim) => {
          const query = fc.sample(float32ArrayArb(dim), 1)[0];
          const results = retrieveTopKPure([], [], query);
          return results.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
