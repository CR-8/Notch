import type { DocumentChunk } from './types';

const DB_NAME = 'notch_db';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
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
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChunk(chunk: DocumentChunk): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    const { embedding: _embedding, ...chunkWithoutEmbedding } = chunk;
    const request = tx.objectStore('chunks').put(chunkWithoutEmbedding);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function saveEmbedding(id: string, documentId: string, vector: Float32Array): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('embeddings', 'readwrite');
    const request = tx.objectStore('embeddings').put({ id, documentId, vector });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readonly');
    const index = tx.objectStore('chunks').index('documentId');
    const request = index.getAll(documentId);
    request.onsuccess = () => resolve(request.result as DocumentChunk[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getEmbeddingsByDocument(documentId: string): Promise<Array<{ id: string; vector: Float32Array }>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('embeddings', 'readonly');
    const index = tx.objectStore('embeddings').index('documentId');
    const request = index.getAll(documentId);
    request.onsuccess = () => resolve(request.result as Array<{ id: string; vector: Float32Array }>);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteDocumentFromIDB(documentId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['chunks', 'embeddings'], 'readwrite');

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    const chunksIndex = tx.objectStore('chunks').index('documentId');
    const embeddingsIndex = tx.objectStore('embeddings').index('documentId');

    const chunksRequest = chunksIndex.getAllKeys(documentId);
    chunksRequest.onsuccess = () => {
      for (const key of chunksRequest.result) {
        tx.objectStore('chunks').delete(key);
      }
    };
    chunksRequest.onerror = () => tx.abort();

    const embeddingsRequest = embeddingsIndex.getAllKeys(documentId);
    embeddingsRequest.onsuccess = () => {
      for (const key of embeddingsRequest.result) {
        tx.objectStore('embeddings').delete(key);
      }
    };
    embeddingsRequest.onerror = () => tx.abort();
  });
}

export { openDB };
