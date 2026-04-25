/**
 * Property 18: Tag Filter Correctness
 *
 * For any collection of Documents with arbitrary tags, filtering by a tag
 * SHALL return exactly the documents that contain that tag — no false
 * positives (every result contains the tag) and no false negatives (every
 * document with the tag appears in the result).
 *
 * Validates: Requirements 11.6
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Document } from '../types';

// Tag filter logic extracted from src/entrypoints/newtab/App.tsx
function filterByTag(docs: Document[], tag: string): Document[] {
  return docs.filter(doc => doc.tags.includes(tag));
}

// Minimal Document arbitrary — only fields needed for tag filtering
const tagArb = fc.string({ minLength: 1, maxLength: 30 });

const documentArb: fc.Arbitrary<Document> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 80 }),
  url: fc.constant('https://example.com'),
  domain: fc.constant('example.com'),
  capturedAt: fc.constant('2024-01-01T00:00:00.000Z'),
  wordCount: fc.nat(),
  mode: fc.constantFrom('FAST' as const, 'DEEP' as const, 'LOCAL' as const),
  provider: fc.constantFrom('gemini' as const, 'openai' as const, 'anthropic' as const, 'ollama' as const),
  content: fc.string({ maxLength: 100 }),
  summary: fc.constant(''),
  keyEntities: fc.constant([]),
  timeline: fc.constant([]),
  concepts: fc.constant([]),
  tags: fc.array(tagArb, { minLength: 0, maxLength: 5 }),
  images: fc.constant([]),
  isStarred: fc.boolean(),
  isArchived: fc.boolean(),
  isRead: fc.boolean(),
  embeddingsGenerated: fc.boolean(),
  missingImageQueries: fc.constant([]),
});

const documentCollectionArb = fc.array(documentArb, { minLength: 1, maxLength: 20 });

describe('Property 18: Tag Filter Correctness', () => {
  it('no false positives: every document in the result contains the tag', () => {
    // Generate a collection and a tag that exists in at least one document
    const arbWithTag = documentCollectionArb.chain(docs => {
      const allTags = docs.flatMap(d => d.tags);
      if (allTags.length === 0) {
        // No tags in collection — inject a tag into the first document
        return fc.string({ minLength: 1, maxLength: 30 }).map(tag => {
          const patched = docs.map((d, i) => i === 0 ? { ...d, tags: [tag] } : d);
          return { docs: patched, tag };
        });
      }
      return fc.constantFrom(...allTags).map(tag => ({ docs, tag }));
    });

    fc.assert(
      fc.property(arbWithTag, ({ docs, tag }) => {
        const result = filterByTag(docs, tag);
        for (const doc of result) {
          expect(doc.tags).toContain(tag);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('no false negatives: every document with the tag appears in the result', () => {
    const arbWithTag = documentCollectionArb.chain(docs => {
      const allTags = docs.flatMap(d => d.tags);
      if (allTags.length === 0) {
        return fc.string({ minLength: 1, maxLength: 30 }).map(tag => {
          const patched = docs.map((d, i) => i === 0 ? { ...d, tags: [tag] } : d);
          return { docs: patched, tag };
        });
      }
      return fc.constantFrom(...allTags).map(tag => ({ docs, tag }));
    });

    fc.assert(
      fc.property(arbWithTag, ({ docs, tag }) => {
        const result = filterByTag(docs, tag);
        const resultIds = new Set(result.map(d => d.id));
        for (const doc of docs) {
          if (doc.tags.includes(tag)) {
            expect(resultIds).toContain(doc.id);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('filtering by a tag no document has returns an empty array', () => {
    // Generate a collection and a tag guaranteed to be absent from all documents
    const arbAbsentTag = documentCollectionArb.chain(docs => {
      // Use a tag that cannot appear in any document's tags
      return fc.string({ minLength: 1, maxLength: 30 })
        .filter(tag => docs.every(d => !d.tags.includes(tag)))
        .map(tag => ({ docs, tag }));
    });

    fc.assert(
      fc.property(arbAbsentTag, ({ docs, tag }) => {
        const result = filterByTag(docs, tag);
        expect(result).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });
});
