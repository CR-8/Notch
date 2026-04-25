import type { Document, DocumentChunk } from './types';

const DB_NAME = 'notch_db';
const DB_VERSION = 2; // bumped: added 'documents' store

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('chunks')) {
        const chunksStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunksStore.createIndex('documentId', 'documentId', { unique: false });
      }

      if (!db.objectStoreNames.contains('embeddings')) {
        const embeddingsStore = db.createObjectStore('embeddings', { keyPath: 'id' });
        embeddingsStore.createIndex('documentId', 'documentId', { unique: false });
      }

      // v2: full documents live here, not in storage.local
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => { _db = request.result; resolve(_db!); };
    request.onerror = () => reject(request.error);
  });
}

// ── Full document store ───────────────────────────────────────────────────────

export async function saveDocumentToIDB(doc: Document): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readwrite');
    const req = tx.objectStore('documents').put(doc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getDocumentFromIDB(id: string): Promise<Document | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('documents', 'readonly');
    const req = tx.objectStore('documents').get(id);
    req.onsuccess = () => resolve((req.result as Document) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteDocumentFromIDB(documentId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chunks', 'embeddings', 'documents'], 'readwrite');

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    // Delete full doc
    tx.objectStore('documents').delete(documentId);

    // Delete chunks
    const chunksReq = tx.objectStore('chunks').index('documentId').getAllKeys(documentId);
    chunksReq.onsuccess = () => {
      for (const key of chunksReq.result) tx.objectStore('chunks').delete(key);
    };
    chunksReq.onerror = () => tx.abort();

    // Delete embeddings
    const embReq = tx.objectStore('embeddings').index('documentId').getAllKeys(documentId);
    embReq.onsuccess = () => {
      for (const key of embReq.result) tx.objectStore('embeddings').delete(key);
    };
    embReq.onerror = () => tx.abort();
  });
}

// ── Chunks ────────────────────────────────────────────────────────────────────

export async function saveChunk(chunk: DocumentChunk): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    const { embedding: _embedding, ...chunkWithoutEmbedding } = chunk;
    const req = tx.objectStore('chunks').put(chunkWithoutEmbedding);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readonly');
    const req = tx.objectStore('chunks').index('documentId').getAll(documentId);
    req.onsuccess = () => resolve(req.result as DocumentChunk[]);
    req.onerror = () => reject(req.error);
  });
}

// ── Embeddings ────────────────────────────────────────────────────────────────

export async function saveEmbedding(id: string, documentId: string, vector: Float32Array): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('embeddings', 'readwrite');
    const req = tx.objectStore('embeddings').put({ id, documentId, vector });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getEmbeddingsByDocument(documentId: string): Promise<Array<{ id: string; vector: Float32Array }>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('embeddings', 'readonly');
    const req = tx.objectStore('embeddings').index('documentId').getAll(documentId);
    req.onsuccess = () => resolve(req.result as Array<{ id: string; vector: Float32Array }>);
    req.onerror = () => reject(req.error);
  });
}
