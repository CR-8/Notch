/**
 * Property 9: Document State Mutations Persist and Reflect
 *
 * For any Document and mutation operation (star/unstar/archive/unarchive),
 * applying the mutation and persisting via saveDocument SHALL result in
 * getDocument returning a Document with the mutated field updated and all
 * other fields unchanged.
 *
 * Validates: Requirements 4.7, 4.8, 4.9, 4.10
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { saveDocument, getDocument } from '../storage';
import type { Document, Entity, TimelineEvent, Concept, ImageRef, GenerationMode, LLMProvider } from '../types';

// --- Chrome mock (same pattern as storage.property.test.ts) ---

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

type MutationType = 'star' | 'unstar' | 'archive' | 'unarchive';

const mutationArb: fc.Arbitrary<MutationType> = fc.constantFrom('star', 'unstar', 'archive', 'unarchive');

function applyMutation(doc: Document, mutation: MutationType): Document {
  switch (mutation) {
    case 'star':      return { ...doc, isStarred: true };
    case 'unstar':    return { ...doc, isStarred: false };
    case 'archive':   return { ...doc, isArchived: true };
    case 'unarchive': return { ...doc, isArchived: false };
  }
}

// --- Tests ---

describe('Property 9: Document State Mutations Persist and Reflect', () => {
  beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
  });

  it('mutated document persists and reflects the correct state for any mutation', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, mutationArb, async (doc, mutation) => {
        store.clear();
        const mutated = applyMutation(doc, mutation);
        await saveDocument(mutated);
        const retrieved = await getDocument(doc.id);

        expect(retrieved).not.toBeNull();

        if (mutation === 'star') {
          expect(retrieved!.isStarred).toBe(true);
        } else if (mutation === 'unstar') {
          expect(retrieved!.isStarred).toBe(false);
        } else if (mutation === 'archive') {
          expect(retrieved!.isArchived).toBe(true);
        } else if (mutation === 'unarchive') {
          expect(retrieved!.isArchived).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('star mutation does not change unrelated fields', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        const mutated = { ...doc, isStarred: true };
        await saveDocument(mutated);
        const retrieved = await getDocument(doc.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.isStarred).toBe(true);
        // unrelated fields unchanged
        expect(retrieved!.isArchived).toBe(doc.isArchived);
        expect(retrieved!.id).toBe(doc.id);
        expect(retrieved!.title).toBe(doc.title);
        expect(retrieved!.url).toBe(doc.url);
        expect(retrieved!.content).toBe(doc.content);
        expect(retrieved!.tags).toEqual(doc.tags);
      }),
      { numRuns: 100 }
    );
  });

  it('unstar mutation does not change unrelated fields', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        const mutated = { ...doc, isStarred: false };
        await saveDocument(mutated);
        const retrieved = await getDocument(doc.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.isStarred).toBe(false);
        expect(retrieved!.isArchived).toBe(doc.isArchived);
        expect(retrieved!.id).toBe(doc.id);
        expect(retrieved!.title).toBe(doc.title);
        expect(retrieved!.content).toBe(doc.content);
        expect(retrieved!.tags).toEqual(doc.tags);
      }),
      { numRuns: 100 }
    );
  });

  it('archive mutation does not change unrelated fields', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        const mutated = { ...doc, isArchived: true };
        await saveDocument(mutated);
        const retrieved = await getDocument(doc.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.isArchived).toBe(true);
        expect(retrieved!.isStarred).toBe(doc.isStarred);
        expect(retrieved!.id).toBe(doc.id);
        expect(retrieved!.title).toBe(doc.title);
        expect(retrieved!.content).toBe(doc.content);
        expect(retrieved!.tags).toEqual(doc.tags);
      }),
      { numRuns: 100 }
    );
  });

  it('unarchive mutation does not change unrelated fields', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        const mutated = { ...doc, isArchived: false };
        await saveDocument(mutated);
        const retrieved = await getDocument(doc.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.isArchived).toBe(false);
        expect(retrieved!.isStarred).toBe(doc.isStarred);
        expect(retrieved!.id).toBe(doc.id);
        expect(retrieved!.title).toBe(doc.title);
        expect(retrieved!.content).toBe(doc.content);
        expect(retrieved!.tags).toEqual(doc.tags);
      }),
      { numRuns: 100 }
    );
  });

  it('sequential mutations reflect the last applied state', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        // star then unstar — final state should be unstarred
        await saveDocument({ ...doc, isStarred: true });
        await saveDocument({ ...doc, isStarred: false });
        const retrieved = await getDocument(doc.id);
        expect(retrieved!.isStarred).toBe(false);

        // archive then unarchive — final state should be unarchived
        await saveDocument({ ...doc, isArchived: true });
        await saveDocument({ ...doc, isArchived: false });
        const retrieved2 = await getDocument(doc.id);
        expect(retrieved2!.isArchived).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
