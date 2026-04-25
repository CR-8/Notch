/**
 * Property 17: Tag Persistence Round-Trip
 *
 * For any Document with arbitrary tag arrays, `saveDocument` → `getDocument`
 * returns the same tags in the same order.
 *
 * Validates: Requirements 11.3
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { saveDocument, getDocument } from '../storage';
import type {
  Document,
  Entity,
  TimelineEvent,
  Concept,
  ImageRef,
  GenerationMode,
  LLMProvider,
} from '../types';

// ── Chrome mock (same pattern as storage.property.test.ts) ───────────────────

const store = new Map<string, unknown>();

global.chrome = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) store.set(k, v);
      }),
      remove: vi.fn(async (key: string) => {
        store.delete(key);
      }),
      getBytesInUse: vi.fn(async () => 0),
    },
  },
  runtime: { sendMessage: vi.fn() },
} as unknown as typeof chrome;

// ── Arbitraries ───────────────────────────────────────────────────────────────

const generationModeArb: fc.Arbitrary<GenerationMode> = fc.constantFrom('FAST', 'DEEP', 'LOCAL');
const llmProviderArb: fc.Arbitrary<LLMProvider> = fc.constantFrom(
  'gemini',
  'openai',
  'anthropic',
  'ollama',
);

const entityArb: fc.Arbitrary<Entity> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  type: fc.string({ minLength: 1, maxLength: 30 }),
  paragraphIndex: fc.nat(100),
});

const timelineEventArb: fc.Arbitrary<TimelineEvent> = fc.record({
  date: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ minLength: 1, maxLength: 200 }),
  paragraphIndex: fc.nat(100),
});

const conceptArb: fc.Arbitrary<Concept> = fc.record({
  term: fc.string({ minLength: 1, maxLength: 50 }),
  definition: fc.string({ minLength: 1, maxLength: 300 }),
  paragraphIndex: fc.nat(100),
});

const imageRefArb: fc.Arbitrary<ImageRef> = fc.record({
  url: fc.webUrl(),
  alt: fc.string({ maxLength: 100 }),
  sectionIndex: fc.nat(50),
  paragraphContext: fc.string({ maxLength: 200 }),
});

/** Arbitrary tag string — any non-empty string up to 50 chars. */
const tagArb = fc.string({ minLength: 1, maxLength: 50 });

/** Arbitrary Document with an arbitrary tags array. */
const documentArb: fc.Arbitrary<Document> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  url: fc.webUrl(),
  domain: fc.domain(),
  capturedAt: fc
    .integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map((ms) => new Date(ms).toISOString()),
  wordCount: fc.nat(100000),
  mode: generationModeArb,
  provider: llmProviderArb,
  content: fc.string({ maxLength: 5000 }),
  summary: fc.string({ maxLength: 500 }),
  keyEntities: fc.array(entityArb, { maxLength: 10 }),
  timeline: fc.array(timelineEventArb, { maxLength: 10 }),
  concepts: fc.array(conceptArb, { maxLength: 10 }),
  tags: fc.array(tagArb, { maxLength: 30 }),
  images: fc.array(imageRefArb, { maxLength: 10 }),
  isStarred: fc.boolean(),
  isArchived: fc.boolean(),
  isRead: fc.boolean(),
  embeddingsGenerated: fc.boolean(),
  missingImageQueries: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 5 }),
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Property 17: Tag Persistence Round-Trip', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('saveDocument → getDocument returns the same tags in the same order', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        await saveDocument(doc);
        const retrieved = await getDocument(doc.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.tags).toEqual(doc.tags);
      }),
      { numRuns: 100 },
    );
  });

  it('empty tag array is preserved after round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        documentArb.map((doc) => ({ ...doc, tags: [] })),
        async (doc) => {
          store.clear();
          await saveDocument(doc);
          const retrieved = await getDocument(doc.id);
          expect(retrieved!.tags).toEqual([]);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('tag order is preserved — tags are not sorted or reordered', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(tagArb, { minLength: 2, maxLength: 20 }),
        fc.uuid(),
        async (tags, id) => {
          store.clear();
          const doc = await buildMinimalDoc(id, tags);
          await saveDocument(doc);
          const retrieved = await getDocument(id);
          expect(retrieved!.tags).toStrictEqual(tags);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('duplicate tags are preserved as-is', async () => {
    await fc.assert(
      fc.asyncProperty(
        tagArb,
        fc.integer({ min: 2, max: 5 }),
        fc.uuid(),
        async (tag, count, id) => {
          store.clear();
          const tags = Array.from({ length: count }, () => tag);
          const doc = await buildMinimalDoc(id, tags);
          await saveDocument(doc);
          const retrieved = await getDocument(id);
          expect(retrieved!.tags).toEqual(tags);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('tags with special characters are preserved', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 10 }),
        fc.uuid(),
        async (tags, id) => {
          store.clear();
          const doc = await buildMinimalDoc(id, tags);
          await saveDocument(doc);
          const retrieved = await getDocument(id);
          expect(retrieved!.tags).toEqual(tags);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function buildMinimalDoc(id: string, tags: string[]): Promise<Document> {
  return {
    id,
    title: 'Test Document',
    url: 'https://example.com',
    domain: 'example.com',
    capturedAt: new Date().toISOString(),
    wordCount: 0,
    mode: 'FAST',
    provider: 'gemini',
    content: '',
    summary: '',
    keyEntities: [],
    timeline: [],
    concepts: [],
    tags,
    images: [],
    isStarred: false,
    isArchived: false,
    isRead: false,
    embeddingsGenerated: false,
    missingImageQueries: [],
  };
}
