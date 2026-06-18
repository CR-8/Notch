import Dexie, { type Table } from 'dexie';
import type {
  Document,
  DocumentChunk,
  VectorRecord,
  Conversation,
  ChatMessage,
  ProviderConfig,
} from './types';

export class NotchDB extends Dexie {
  notes!: Table<Document, string>;
  chunks!: Table<DocumentChunk, string>;
  vectors!: Table<VectorRecord, string>;
  conversations!: Table<Conversation, string>;
  messages!: Table<ChatMessage, string>;
  providers!: Table<ProviderConfig, string>;

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
  }
}

export const db = new NotchDB();
