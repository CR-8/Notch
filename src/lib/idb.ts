import { db } from './db';
import { deleteDocument } from './storage';
import type { ChatMessage, Document, DocumentChunk, DocumentHighlight } from './types';

// This module historically opened a *second* IndexedDB connection on the same
// database name as Dexie (db.ts) with a different version/schema, which made the
// two openers conflict inside the reader page. It now delegates to the single
// Dexie database so highlights, chat history, chunks and documents all share one
// consistent store. The exported surface is unchanged for existing callers.

// ── Documents ─────────────────────────────────────────────────────────────────

export async function saveDocumentToIDB(doc: Document): Promise<void> {
  await db.notes.put(doc);
}

export async function getDocumentFromIDB(id: string): Promise<Document | null> {
  return (await db.notes.get(id)) ?? null;
}

export async function deleteDocumentFromIDB(documentId: string): Promise<void> {
  await deleteDocument(documentId);
}

// ── Chunks ───────────────────────────────────────────────────────────────────

export async function saveChunk(chunk: DocumentChunk): Promise<void> {
  await db.chunks.put(chunk);
}

export async function getChunksByDocument(documentId: string): Promise<DocumentChunk[]> {
  return db.chunks.where('noteId').equals(documentId).sortBy('paragraphIndex');
}

// ── Chat history ─────────────────────────────────────────────────────────────

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  await db.messages.put(message);
}

export async function getChatMessagesByDocument(documentId: string): Promise<ChatMessage[]> {
  const messages = await db.messages.where('documentId').equals(documentId).toArray();
  return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// ── Highlights ─────────────────────────────────────────────────────────────────

export async function saveHighlight(highlight: DocumentHighlight): Promise<void> {
  await db.highlights.put(highlight);
}

export async function getHighlightsByDocument(documentId: string): Promise<DocumentHighlight[]> {
  const highlights = await db.highlights.where('documentId').equals(documentId).toArray();
  return highlights.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function deleteHighlight(id: string): Promise<void> {
  await db.highlights.delete(id);
}
