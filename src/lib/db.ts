import Dexie, { type Table } from 'dexie';
import type {
  Document,
  DocumentChunk,
  VectorRecord,
  Conversation,
  ChatMessage,
  ProviderConfig,
  DocumentHighlight,
} from './types';

export class NotchDB extends Dexie {
  notes!: Table<Document, string>;
  chunks!: Table<DocumentChunk, string>;
  vectors!: Table<VectorRecord, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<ChatMessage, string>;
  providers!: Table<ProviderConfig, string>;
  highlights!: Table<DocumentHighlight, string>;

  constructor() {
    super('notch_db');

    this.version(1).stores({
      notes: 'id, status, domain, starred, archived, createdAt',
      chunks: 'id, noteId, paragraphIndex',
      vectors: 'chunkId, providerId, embeddingModel, embeddingVersion',
      conversations: 'id, createdAt',
      messages: 'id, role, createdAt',
      providers: 'id, enabled',
    });

    this.version(2).stores({
      notes: 'id, status, domain, starred, archived, createdAt',
      chunks: 'id, noteId, paragraphIndex',
      vectors: 'chunkId, providerId, embeddingModel, embeddingVersion',
      conversations: 'id, createdAt',
      messages: 'id, role, createdAt',
      providers: 'id, enabled',
    }).upgrade(async () => {
      // v2: no schema changes, just a placeholder for future migrations
    });

    // v3: scope chat messages by document and add the highlights store.
    // This unifies all reader/RAG persistence onto Dexie (previously split
    // across a second, conflicting raw-IndexedDB opener on the same db name).
    this.version(3).stores({
      notes: 'id, status, domain, starred, archived, createdAt',
      chunks: 'id, noteId, paragraphIndex',
      vectors: 'chunkId, providerId, embeddingModel, embeddingVersion',
      conversations: 'id, createdAt',
      messages: 'id, documentId, role, createdAt',
      providers: 'id, enabled',
      highlights: 'id, documentId, createdAt',
    });

    // v4: Content Intelligence Engine support — no schema changes (new fields
    // are on the Document type which uses object store, not indexed keys).
    this.version(4).stores({
      notes: 'id, status, domain, starred, archived, createdAt, diagramCount, qualityScore',
      chunks: 'id, noteId, paragraphIndex',
      vectors: 'chunkId, providerId, embeddingModel, embeddingVersion',
      conversations: 'id, createdAt',
      messages: 'id, documentId, role, createdAt',
      providers: 'id, enabled',
      highlights: 'id, documentId, createdAt',
    });
  }
}

export const db = new NotchDB();
