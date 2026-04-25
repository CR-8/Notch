/**
 * Property 8: Document Sort Order Invariant
 *
 * For any collection of Documents, after sorting by `capturedAt` descending
 * (newest first), each document's timestamp SHALL be >= the next document's
 * timestamp. The same invariant holds for oldest-first (ascending) and
 * title A–Z (case-insensitive ascending) sort orders.
 *
 * Validates: Requirements 4.6
 */

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import type { Document } from '../types';

// Sort functions extracted from src/entrypoints/newtab/App.tsx
function sortNewest(docs: Document[]): Document[] {
  return [...docs].sort(
    (a, b) => new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime()
  );
}

function sortOldest(docs: Document[]): Document[] {
  return [...docs].sort(
    (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
  );
}

function sortTitleAZ(docs: Document[]): Document[] {
  return [...docs].sort((a, b) => a.title.localeCompare(b.title));
}

// Generate a valid ISO 8601 timestamp within a reasonable range.
// Use integer ms since epoch to avoid fc.date() shrinking to invalid dates.
const MIN_MS = new Date('2000-01-01T00:00:00Z').getTime();
const MAX_MS = new Date('2030-12-31T23:59:59Z').getTime();

const isoTimestampArb: fc.Arbitrary<string> = fc
  .integer({ min: MIN_MS, max: MAX_MS })
  .map((ms) => new Date(ms).toISOString());

// Minimal Document arbitrary — only fields needed for sort testing
const documentArb: fc.Arbitrary<Document> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 80 }),
  url: fc.constant('https://example.com'),
  domain: fc.constant('example.com'),
  capturedAt: isoTimestampArb,
  wordCount: fc.nat(),
  mode: fc.constantFrom('FAST' as const, 'DEEP' as const, 'LOCAL' as const),
  provider: fc.constantFrom('gemini' as const, 'openai' as const, 'anthropic' as const, 'ollama' as const),
  content: fc.string({ maxLength: 100 }),
  summary: fc.constant(''),
  keyEntities: fc.constant([]),
  timeline: fc.constant([]),
  concepts: fc.constant([]),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  images: fc.constant([]),
  isStarred: fc.boolean(),
  isArchived: fc.boolean(),
  isRead: fc.boolean(),
  embeddingsGenerated: fc.boolean(),
  missingImageQueries: fc.constant([]),
});

const documentCollectionArb = fc.array(documentArb, { minLength: 0, maxLength: 20 });

describe('Property 8: Document Sort Order Invariant', () => {
  it('newest-first: each capturedAt >= the next capturedAt', () => {
    fc.assert(
      fc.property(documentCollectionArb, (docs) => {
        const sorted = sortNewest(docs);
        for (let i = 0; i < sorted.length - 1; i++) {
          const curr = new Date(sorted[i].capturedAt).getTime();
          const next = new Date(sorted[i + 1].capturedAt).getTime();
          if (curr < next) {
            throw new Error(
              `Sort violation at [${i}]: ${sorted[i].capturedAt} < ${sorted[i + 1].capturedAt}`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('oldest-first: each capturedAt <= the next capturedAt', () => {
    fc.assert(
      fc.property(documentCollectionArb, (docs) => {
        const sorted = sortOldest(docs);
        for (let i = 0; i < sorted.length - 1; i++) {
          const curr = new Date(sorted[i].capturedAt).getTime();
          const next = new Date(sorted[i + 1].capturedAt).getTime();
          if (curr > next) {
            throw new Error(
              `Sort violation at [${i}]: ${sorted[i].capturedAt} > ${sorted[i + 1].capturedAt}`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('title A-Z: each title <= the next title (localeCompare)', () => {
    fc.assert(
      fc.property(documentCollectionArb, (docs) => {
        const sorted = sortTitleAZ(docs);
        for (let i = 0; i < sorted.length - 1; i++) {
          const cmp = sorted[i].title.localeCompare(sorted[i + 1].title);
          if (cmp > 0) {
            throw new Error(
              `Sort violation at [${i}]: "${sorted[i].title}" > "${sorted[i + 1].title}"`
            );
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
