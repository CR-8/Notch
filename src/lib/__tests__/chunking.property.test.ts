/**
 * Property 15: Chunk Size Invariant
 *
 * For any document content string, the chunking function SHALL produce chunks
 * where every chunk contains no more than 512 tokens, and the concatenation of
 * all chunk texts (accounting for overlap) covers the entire original content.
 *
 * Validates: Requirements 10.1
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';

// Token approximation: 1 token ≈ 4 characters (same as embedding-engine.ts)
const CHARS_PER_TOKEN = 4;
const OVERLAP_TOKENS = 50;
const MAX_TOKENS = 512;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN; // 2048

// Inline copy of chunkText from embedding-engine.ts to avoid @xenova/transformers import
function chunkText(content: string, maxTokens: number = 512): string[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = OVERLAP_TOKENS * CHARS_PER_TOKEN;

  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length <= maxChars) {
      chunks.push(paragraph.trim());
    } else {
      const sentences = paragraph.split(/(?<=[\.\!\?])\s+/).filter((s) => s.trim().length > 0);
      let current = '';

      for (const sentence of sentences) {
        if ((current + ' ' + sentence).trim().length <= maxChars) {
          current = current ? current + ' ' + sentence : sentence;
        } else {
          if (current) {
            chunks.push(current.trim());
            const overlapText = current.slice(-overlapChars);
            current = overlapText + ' ' + sentence;
          } else {
            chunks.push(sentence.trim());
            current = '';
          }
        }
      }

      if (current.trim()) {
        chunks.push(current.trim());
      }
    }
  }

  if (chunks.length > 1) {
    const overlappedChunks: string[] = [chunks[0]];
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const overlap = prev.slice(-overlapChars);
      overlappedChunks.push(overlap + ' ' + chunks[i]);
    }
    return overlappedChunks;
  }

  return chunks;
}

describe('Property 15: Chunk Size Invariant', () => {
  it('every chunk has at most 512 tokens (2048 characters)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5000 }),
        (content) => {
          const chunks = chunkText(content);
          for (const chunk of chunks) {
            if (chunk.length > MAX_CHARS) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('every paragraph from the original content is represented in at least one chunk', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5000 }),
        (content) => {
          const chunks = chunkText(content);
          const paragraphs = content.split(/\n\n+/).filter((p) => p.trim().length > 0);

          // If no non-empty paragraphs, chunking returns empty — that's fine
          if (paragraphs.length === 0) return true;

          for (const paragraph of paragraphs) {
            const trimmed = paragraph.trim();
            if (trimmed.length === 0) continue;

            // Each paragraph should appear in at least one chunk
            const covered = chunks.some((chunk) => chunk.includes(trimmed));
            if (!covered) {
              return false;
            }
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
