import { describe, it, expect } from 'vitest';
import { cosineSimilarity, normalise, parseCitations, buildRAGPrompt } from '../retrieval';
import type { RetrievedChunk } from '../retrieval';

function chunk(partial: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    id: partial.id ?? 'c1',
    noteId: partial.noteId ?? 'n1',
    text: partial.text ?? 'text',
    paragraphIndex: partial.paragraphIndex ?? 0,
    charStart: 0,
    charEnd: 10,
    heading: partial.heading ?? '',
    score: partial.score ?? 0,
  };
}

describe('cosineSimilarity', () => {
  it('is 1 for identical vectors', () => {
    const a = new Float32Array([1, 2, 3]);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1, 5);
  });

  it('is 0 for orthogonal vectors', () => {
    const a = new Float32Array([1, 0]);
    const b = new Float32Array([0, 1]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('is 0 when a vector is all zeros', () => {
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 1]))).toBe(0);
  });
});

describe('normalise', () => {
  it('returns a unit-length vector', () => {
    const v = normalise([3, 4]);
    const len = Math.sqrt(v[0] * v[0] + v[1] * v[1]);
    expect(len).toBeCloseTo(1, 5);
  });
});

describe('parseCitations', () => {
  it('maps [N] markers to chunks and de-duplicates', () => {
    const chunks = [
      chunk({ id: 'a', paragraphIndex: 1 }),
      chunk({ id: 'b', paragraphIndex: 2 }),
    ];
    const citations = parseCitations('Fact one [1] and two [2], and again [1].', chunks);
    expect(citations).toHaveLength(2);
    expect(citations.map(c => c.chunkId)).toEqual(['a', 'b']);
  });

  it('ignores out-of-range markers', () => {
    const citations = parseCitations('See [9].', [chunk({ id: 'a' })]);
    expect(citations).toHaveLength(0);
  });
});

describe('buildRAGPrompt', () => {
  it('includes the excerpts and the user question', () => {
    const prompt = buildRAGPrompt('What is X?', [chunk({ text: 'X is a thing.' })]);
    expect(prompt).toContain('X is a thing.');
    expect(prompt).toContain('What is X?');
  });
});
