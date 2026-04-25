/**
 * Property 4: Document Storage Round-Trip
 *
 * For any valid Document object, persisting it to the Storage_Layer and reading
 * it back by ID SHALL produce a Document equal to the original, with all fields
 * preserved including content, tags, images, and metadata.
 *
 * Validates: Requirements 2.5, 14.1, 14.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { saveDocument, getDocument } from '../storage';
import type { Document, Entity, TimelineEvent, Concept, ImageRef, GenerationMode, LLMProvider } from '../types';

// --- Chrome mock ---

const store = new Map<string, unknown>();

global.chrome = {
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store.get(key) })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) store.set(k, v);
      }),
      remove: vi.fn(async (key: string) => { store.delete(key); }),
      getBytesInUse: vi.fn(async () => 0),
    },
  },
  runtime: { sendMessage: vi.fn() },
} as unknown as typeof chrome;

// --- Arbitraries ---

const generationModeArb: fc.Arbitrary<GenerationMode> = fc.constantFrom('FAST', 'DEEP', 'LOCAL');
const llmProviderArb: fc.Arbitrary<LLMProvider> = fc.constantFrom('gemini', 'openai', 'anthropic', 'ollama');

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

const documentArb: fc.Arbitrary<Document> = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 1, maxLength: 200 }),
  url: fc.webUrl(),
  domain: fc.domain(),
  capturedAt: fc.integer({ min: new Date('2020-01-01').getTime(), max: new Date('2030-01-01').getTime() })
    .map(ms => new Date(ms).toISOString()),
  wordCount: fc.nat(100000),
  mode: generationModeArb,
  provider: llmProviderArb,
  content: fc.string({ maxLength: 5000 }),
  summary: fc.string({ maxLength: 500 }),
  keyEntities: fc.array(entityArb, { maxLength: 10 }),
  timeline: fc.array(timelineEventArb, { maxLength: 10 }),
  concepts: fc.array(conceptArb, { maxLength: 10 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 20 }),
  images: fc.array(imageRefArb, { maxLength: 10 }),
  isStarred: fc.boolean(),
  isArchived: fc.boolean(),
  isRead: fc.boolean(),
  embeddingsGenerated: fc.boolean(),
  missingImageQueries: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { maxLength: 5 }),
});

// --- Tests ---

describe('Property 4: Document Storage Round-Trip', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('saveDocument → getDocument returns a deeply equal Document for any valid Document', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        await saveDocument(doc);
        const retrieved = await getDocument(doc.id);
        expect(retrieved).toEqual(doc);
      }),
      { numRuns: 100 }
    );
  });

  it('all scalar fields are preserved after round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        await saveDocument(doc);
        const retrieved = await getDocument(doc.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(doc.id);
        expect(retrieved!.title).toBe(doc.title);
        expect(retrieved!.url).toBe(doc.url);
        expect(retrieved!.domain).toBe(doc.domain);
        expect(retrieved!.capturedAt).toBe(doc.capturedAt);
        expect(retrieved!.wordCount).toBe(doc.wordCount);
        expect(retrieved!.mode).toBe(doc.mode);
        expect(retrieved!.provider).toBe(doc.provider);
        expect(retrieved!.content).toBe(doc.content);
        expect(retrieved!.summary).toBe(doc.summary);
        expect(retrieved!.isStarred).toBe(doc.isStarred);
        expect(retrieved!.isArchived).toBe(doc.isArchived);
        expect(retrieved!.isRead).toBe(doc.isRead);
        expect(retrieved!.embeddingsGenerated).toBe(doc.embeddingsGenerated);
      }),
      { numRuns: 100 }
    );
  });

  it('tags array is preserved in the same order after round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        await saveDocument(doc);
        const retrieved = await getDocument(doc.id);
        expect(retrieved!.tags).toEqual(doc.tags);
      }),
      { numRuns: 100 }
    );
  });

  it('images array is preserved after round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        await saveDocument(doc);
        const retrieved = await getDocument(doc.id);
        expect(retrieved!.images).toEqual(doc.images);
      }),
      { numRuns: 100 }
    );
  });

  it('getDocument returns null for an unknown id', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (id) => {
        store.clear();
        const result = await getDocument(id);
        expect(result).toBeNull();
      }),
      { numRuns: 50 }
    );
  });
});
