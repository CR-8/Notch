/**
 * Property 7: Fuzzy Search Returns Relevant Results
 *
 * For any collection of Documents and any document within that collection,
 * searching with the document's exact title as the query SHALL include that
 * document in the Fuse.js search results.
 *
 * Validates: Requirements 4.3
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import Fuse from 'fuse.js';
import type { Document } from '../types';

// Fuse options extracted from src/entrypoints/newtab/App.tsx
const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'tags', weight: 0.3 },
    { name: 'content', weight: 0.2 },
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
};

// Minimal document arbitrary — only fields needed for Fuse search
const documentArb: fc.Arbitrary<Pick<Document, 'id' | 'title' | 'tags' | 'content'>> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 2, maxLength: 80 }).filter((s) => s.trim().length >= 2),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 5 }),
  content: fc.string({ maxLength: 200 }),
});

// A non-empty array of documents where all titles are unique (avoids ambiguity)
const documentCollectionArb = fc
  .array(documentArb, { minLength: 1, maxLength: 10 })
  .filter((docs) => {
    const titles = docs.map((d) => d.title);
    return new Set(titles).size === titles.length;
  });

describe('Property 7: Fuzzy Search Returns Relevant Results', () => {
  it('exact title match always appears in Fuse results', () => {
    fc.assert(
      fc.property(documentCollectionArb, (docs) => {
        // Pick the first document as the target
        const target = docs[0];
        const fuse = new Fuse(docs, fuseOptions);
        const results = fuse.search(target.title);
        const resultIds = results.map((r) => r.item.id);
        expect(resultIds).toContain(target.id);
      }),
      { numRuns: 100 }
    );
  });

  it('exact title match appears in results for every document in the collection', () => {
    fc.assert(
      fc.property(documentCollectionArb, (docs) => {
        const fuse = new Fuse(docs, fuseOptions);
        for (const target of docs) {
          const results = fuse.search(target.title);
          const resultIds = results.map((r) => r.item.id);
          expect(resultIds).toContain(target.id);
        }
      }),
      { numRuns: 100 }
    );
  });
});
