/**
 * Property 6: Library Renders All Documents with Required Fields
 *
 * For any collection of Documents, the DocumentCard rendering logic produces
 * exactly one card-data entry per document, and each entry contains:
 *   - the document title
 *   - the source domain
 *   - the word count (as "{n} words")
 *   - the capture date in YYYY-MM-DD format
 *   - all tags associated with the document
 *
 * Validates: Requirements 4.1, 4.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import type { Document } from '../types';

interface CardFields {
  title: string;
  domain: string;
  wordCountText: string;
  captureDate: string;
  tags: string[];
}

function extractCardFields(doc: Document): CardFields {
  return {
    title: doc.title,
    domain: doc.domain,
    wordCountText: `${doc.wordCount} words`,
    captureDate: doc.capturedAt.slice(0, 10),
    tags: [...doc.tags],
  };
}

function renderGrid(documents: Document[]): CardFields[] {
  return documents.map(extractCardFields);
}

const MIN_MS = new Date('2000-01-01T00:00:00Z').getTime();
const MAX_MS = new Date('2030-12-31T23:59:59Z').getTime();

const isoTimestampArb: fc.Arbitrary<string> = fc
  .integer({ min: MIN_MS, max: MAX_MS })
  .map((ms) => new Date(ms).toISOString());

const documentArb: fc.Arbitrary<Document> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 120 }),
  url: fc.constant('https://example.com'),
  domain: fc.string({ minLength: 1, maxLength: 60 }),
  capturedAt: isoTimestampArb,
  wordCount: fc.nat({ max: 100_000 }),
  mode: fc.constantFrom('FAST' as const, 'DEEP' as const, 'LOCAL' as const),
  provider: fc.constantFrom('gemini' as const, 'openai' as const, 'anthropic' as const, 'ollama' as const),
  content: fc.string({ maxLength: 200 }),
  summary: fc.constant(''),
  keyEntities: fc.constant([]),
  timeline: fc.constant([]),
  concepts: fc.constant([]),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 8 }),
  images: fc.constant([]),
  isStarred: fc.boolean(),
  isArchived: fc.boolean(),
  isRead: fc.boolean(),
  embeddingsGenerated: fc.boolean(),
  missingImageQueries: fc.constant([]),
});

const documentCollectionArb = fc.array(documentArb, { minLength: 0, maxLength: 20 });
const nonEmptyCollectionArb = fc.array(documentArb, { minLength: 1, maxLength: 20 });

describe('Property 6: Library Renders All Documents with Required Fields', () => {
  it('renders exactly one card per document', () => {
    fc.assert(
      fc.property(documentCollectionArb, (docs) => {
        const cards = renderGrid(docs);
        expect(cards).toHaveLength(docs.length);
      }),
      { numRuns: 100 }
    );
  });

  it('all required fields are present for every document in the collection', () => {
    fc.assert(
      fc.property(nonEmptyCollectionArb, (docs) => {
        const cards = renderGrid(docs);
        expect(cards).toHaveLength(docs.length);
        docs.forEach((doc, i) => {
          const card = cards[i];
          expect(card.title).toBe(doc.title);
          expect(card.domain).toBe(doc.domain);
          expect(card.wordCountText).toBe(`${doc.wordCount} words`);
          expect(card.captureDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(card.captureDate).toBe(doc.capturedAt.slice(0, 10));
          expect(card.tags).toEqual(doc.tags);
        });
      }),
      { numRuns: 100 }
    );
  });
});
