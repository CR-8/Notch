import type { ChatMessage, Document, DocumentChunk, DocumentHighlight } from './types';

const DB_NAME = 'notch_db';
const DB_VERSION = 5; // v5: added highlights store

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Chunks store (embeddings now stored inline with chunks)
      if (!db.objectStoreNames.contains('chunks')) {
        const chunksStore = db.createObjectStore('chunks', { keyPath: 'id' });
        chunksStore.createIndex('documentId', 'documentId', { unique: false });
      }

      // Full documents
      if (!db.objectStoreNames.contains('documents')) {
        db.createObjectStore('documents', { keyPath: 'id' });
      }

      // Chat history
      if (!db.objectStoreNames.contains('chatHistory')) {
        const chatStore = db.createObjectStore('chatHistory', { keyPath: 'id' });
        chatStore.createIndex('documentId', 'documentId', { unique: false });
        chatStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Highlights
      if (!db.objectStoreNames.contains('highlights')) {
        const highlightsStore = db.createObjectStore('highlights', { keyPath: 'id' });
        highlightsStore.createIndex('documentId', 'documentId', { unique: false });
        highlightsStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Remove old stores if they exist (v4 migration)
      if (db.objectStoreNames.contains('embeddings')) {
        db.deleteObjectStore('embeddings');
      }
    };

    request.onsuccess = () => { _db = request.result; resolve(_db!); };
    request.onerror = () => reject(request.error);
  });
}

// ── Documents ─────────────────────────────────────────────────────────────────

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
    const tx = db.transaction(['chunks', 'documents', 'chatHistory'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);

    tx.objectStore('documents').delete(documentId);

    const chunksReq = tx.objectStore('chunks').index('documentId').getAllKeys(documentId);
    chunksReq.onsuccess = () => {
      for (const key of chunksReq.result) tx.objectStore('chunks').delete(key);
    };
    chunksReq.onerror = () => tx.abort();

    const chatReq = tx.objectStore('chatHistory').index('documentId').getAllKeys(documentId);
    chatReq.onsuccess = () => {
      for (const key of chatReq.result) tx.objectStore('chatHistory').delete(key);
    };
    chatReq.onerror = () => tx.abort();
  });
}

// ── Chunks ───────────────────────────────────────────────────────────────────

export async function saveChunk(chunk: DocumentChunk): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readwrite');
    const req = tx.objectStore('chunks').put(chunk);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chunks', 'readonly');
    const req = tx.objectStore('chunks').index('documentId').getAll(documentId);
    req.onsuccess = () => {
      const chunks = req.result as DocumentChunk[];
      chunks.sort((a, b) => a.paragraphIndex - b.paragraphIndex);
      resolve(chunks);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Chat history ─────────────────────────────────────────────────────────────

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chatHistory', 'readwrite');
    const req = tx.objectStore('chatHistory').put(message);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getChatMessagesByDocument(documentId: string): Promise<ChatMessage[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('chatHistory', 'readonly');
    const req = tx.objectStore('chatHistory').index('documentId').getAll(documentId);
    req.onsuccess = () => {
      const messages = (req.result as ChatMessage[])
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(messages);
    };
    req.onerror = () => reject(req.error);
  });
}

// ── Highlights ─────────────────────────────────────────────────────────────────

export async function saveHighlight(highlight: DocumentHighlight): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('highlights', 'readwrite');
    const req = tx.objectStore('highlights').put(highlight);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getHighlightsByDocument(documentId: string): Promise<DocumentHighlight[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('highlights', 'readonly');
    const req = tx.objectStore('highlights').index('documentId').getAll(documentId);
    req.onsuccess = () => {
      const highlights = (req.result as DocumentHighlight[])
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      resolve(highlights);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteHighlight(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('highlights', 'readwrite');
    const req = tx.objectStore('highlights').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}