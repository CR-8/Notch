/**
 * Vitest setup file — mocks wxt/browser and idb so storage.ts works in the node test environment.
 */
import { vi } from 'vitest';

// ── Mock wxt/browser → proxy to global.chrome ────────────────────────────────
vi.mock('wxt/browser', () => ({
  browser: new Proxy({} as typeof chrome, {
    get(_target, prop: string) {
      const c = (globalThis as any).chrome;
      if (!c) return undefined;
      const val = (c as any)[prop];
      return typeof val === 'function' ? val.bind(c) : val;
    },
  }),
}));

// ── In-memory IDB store for tests ─────────────────────────────────────────────
// Tests that need IDB behaviour can override these maps directly.
const idbDocStore = new Map<string, unknown>();

vi.mock('../idb', () => ({
  saveDocumentToIDB: vi.fn(async (doc: any) => { idbDocStore.set(doc.id, doc); }),
  getDocumentFromIDB: vi.fn(async (id: string) => idbDocStore.get(id) ?? null),
  deleteDocumentFromIDB: vi.fn(async (id: string) => { idbDocStore.delete(id); }),
  saveChunk: vi.fn(),
  saveEmbedding: vi.fn(),
  getChunksByDocument: vi.fn(async () => []),
  getEmbeddingsByDocument: vi.fn(async () => []),
  openDB: vi.fn(),
}));

// Expose the store so individual tests can clear/inspect it
(globalThis as any).__idbDocStore = idbDocStore;
