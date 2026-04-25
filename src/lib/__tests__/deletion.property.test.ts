/**
 * Property 19: Storage Deletion Atomicity
 *
 * After `deleteDocument(id)`, verify:
 *   1. Document is absent from storage (getDocument returns null)
 *   2. ID is absent from the doc index (getDocIndex does not contain the id)
 *   3. All chunks/embeddings are absent from IndexedDB
 *      (getChunksByDocument and getEmbeddingsByDocument return empty arrays)
 *
 * Validates: Requirements 14.4
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { saveDocument, saveDocIndex, getDocument, getDocIndex, deleteDocument } from '../storage';
import type { Document, Entity, TimelineEvent, Concept, ImageRef, GenerationMode, LLMProvider } from '../types';

// --- In-memory IDB store (module-level so vi.mock factory can close over it) ---

const idbChunks = new Map<string, unknown[]>();
const idbEmbeddings = new Map<string, unknown[]>();

vi.mock('../idb', () => ({
  saveDocumentToIDB: vi.fn(async (doc: any) => {
    (globalThis as any).__idbDocStore?.set(doc.id, doc);
  }),
  getDocumentFromIDB: vi.fn(async (id: string) => {
    return (globalThis as any).__idbDocStore?.get(id) ?? null;
  }),
  deleteDocumentFromIDB: vi.fn(async (id: string) => {
    (globalThis as any).__idbDocStore?.delete(id);
    idbChunks.delete(id);
    idbEmbeddings.delete(id);
  }),
  getChunksByDocument: vi.fn(async (id: string) => idbChunks.get(id) ?? []),
  getEmbeddingsByDocument: vi.fn(async (id: string) => idbEmbeddings.get(id) ?? []),
  saveChunk: vi.fn(),
  saveEmbedding: vi.fn(),
  openDB: vi.fn(),
}));

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

describe('Property 19: Storage Deletion Atomicity', () => {
  beforeEach(() => {
    store.clear();
    idbChunks.clear();
    idbEmbeddings.clear();
    (globalThis as any).__idbDocStore?.clear();
    vi.clearAllMocks();
  });

  it('deleteDocument removes document from chrome.storage.local', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        await saveDocument(doc);
        await saveDocIndex([doc.id]);

        await deleteDocument(doc.id);

        const retrieved = await getDocument(doc.id);
        expect(retrieved).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('deleteDocument removes ID from the doc index', async () => {
    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        await saveDocument(doc);
        await saveDocIndex([doc.id]);

        await deleteDocument(doc.id);

        const index = await getDocIndex();
        expect(index).not.toContain(doc.id);
      }),
      { numRuns: 100 }
    );
  });

  it('deleteDocument removes all chunks from IndexedDB', async () => {
    const { getChunksByDocument } = await import('../idb');

    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        idbChunks.set(doc.id, [{ id: `${doc.id}_0`, documentId: doc.id, text: 'chunk' }]);

        await saveDocument(doc);
        await saveDocIndex([doc.id]);

        await deleteDocument(doc.id);

        const chunks = await (getChunksByDocument as ReturnType<typeof vi.fn>)(doc.id);
        expect(chunks).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('deleteDocument removes all embeddings from IndexedDB', async () => {
    const { getEmbeddingsByDocument } = await import('../idb');

    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        idbEmbeddings.set(doc.id, [{ id: `${doc.id}_0`, documentId: doc.id, vector: new Float32Array([0.1, 0.2]) }]);

        await saveDocument(doc);
        await saveDocIndex([doc.id]);

        await deleteDocument(doc.id);

        const embeddings = await (getEmbeddingsByDocument as ReturnType<typeof vi.fn>)(doc.id);
        expect(embeddings).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('all three deletion conditions hold simultaneously for any document', async () => {
    const { getChunksByDocument, getEmbeddingsByDocument } = await import('../idb');

    await fc.assert(
      fc.asyncProperty(documentArb, async (doc) => {
        store.clear();
        idbChunks.set(doc.id, [{ id: `${doc.id}_0`, documentId: doc.id, text: 'chunk' }]);
        idbEmbeddings.set(doc.id, [{ id: `${doc.id}_0`, documentId: doc.id, vector: new Float32Array([0.5]) }]);

        await saveDocument(doc);
        await saveDocIndex([doc.id]);

        await deleteDocument(doc.id);

        // Condition 1: document absent from storage
        const retrieved = await getDocument(doc.id);
        expect(retrieved).toBeNull();

        // Condition 2: ID absent from index
        const index = await getDocIndex();
        expect(index).not.toContain(doc.id);

        // Condition 3: chunks and embeddings absent from IDB
        const chunks = await (getChunksByDocument as ReturnType<typeof vi.fn>)(doc.id);
        const embeddings = await (getEmbeddingsByDocument as ReturnType<typeof vi.fn>)(doc.id);
        expect(chunks).toEqual([]);
        expect(embeddings).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  it('deleting a non-existent document leaves storage and index unchanged', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (id) => {
        store.clear();
        // Pre-populate index with a different id to verify it is not disturbed
        const otherId = '00000000-0000-0000-0000-000000000001';
        await saveDocIndex([otherId]);

        await deleteDocument(id);

        const retrieved = await getDocument(id);
        expect(retrieved).toBeNull();

        const index = await getDocIndex();
        expect(index).not.toContain(id);
        expect(index).toContain(otherId);
      }),
      { numRuns: 50 }
    );
  });
});
