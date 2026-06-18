import { browser } from 'wxt/browser';
import { db } from './db';
import { log } from './logger';
import type {
  Document,
  DocumentChunk,
  ProviderConfig,
  Settings,
  AppearanceSettings,
  AIRuntimeConfig,
  ChatMessage,
} from './types';

const SETTINGS_KEY = 'notch:settings';
const APPEARANCE_KEY = 'notch:appearance';
const SCHEMA_VERSION_KEY = 'notch:schema:version';
const CURRENT_SCHEMA_VERSION = 1;

const DEFAULT_RUNTIME: AIRuntimeConfig = {
  chat: {
    providerId: '',
    modeModels: { FAST: '', BALANCED: '', DEEP: '' },
  },
  embedding: {
    providerId: '',
    model: '',
    dimensions: 768,
    version: 1,
  },
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  fontFamily: 'mono',
  fontSize: 'md',
  accentColor: '#e07c3a',
};

const DEFAULT_CHAT_MODELS: Record<string, string> = {
  FAST: 'gemini-2.0-flash',
  BALANCED: 'gemini-1.5-pro',
  DEEP: 'gemini-2.0-pro-exp',
};

// ── Schema migration guard ───────────────────────────────────────────────────

export async function ensureSchema(): Promise<void> {
  const result = await browser.storage.local.get(SCHEMA_VERSION_KEY);
  const version = (result[SCHEMA_VERSION_KEY] as number) ?? 0;
  if (version < CURRENT_SCHEMA_VERSION) {
    log.info('storage', `Migrating schema from v${version} to v${CURRENT_SCHEMA_VERSION}`);
    // Future migrations go here
    await browser.storage.local.set({ [SCHEMA_VERSION_KEY]: CURRENT_SCHEMA_VERSION });
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(SETTINGS_KEY);
  return (result[SETTINGS_KEY] as Settings) ?? { runtime: DEFAULT_RUNTIME, defaults: { tags: [] } };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [SETTINGS_KEY]: settings });
  log.info('storage', 'Settings saved');
}

// ── Appearance ───────────────────────────────────────────────────────────────

export async function getAppearance(): Promise<AppearanceSettings> {
  const result = await browser.storage.local.get(APPEARANCE_KEY);
  return { ...DEFAULT_APPEARANCE, ...(result[APPEARANCE_KEY] as Partial<AppearanceSettings> ?? {}) };
}

export async function saveAppearance(settings: AppearanceSettings): Promise<void> {
  await browser.storage.local.set({ [APPEARANCE_KEY]: settings });
}

// ── Documents ────────────────────────────────────────────────────────────────

export async function saveDocument(doc: Document): Promise<void> {
  await db.notes.put(doc);
}

export async function getDocument(id: string): Promise<Document | undefined> {
  return db.notes.get(id);
}

export async function deleteDocument(id: string): Promise<void> {
  await db.transaction('rw', db.notes, db.chunks, db.vectors, db.messages, async () => {
    await db.notes.delete(id);
    await db.chunks.where('noteId').equals(id).delete();
    await db.vectors.where('chunkId').anyOf(
      (await db.chunks.where('noteId').equals(id).primaryKeys())
    ).delete();
    await db.messages.where('id').anyOf(
      (await db.messages.filter(m => m.id.startsWith(id)).primaryKeys())
    ).delete();
  });
}

export async function getAllNotes(): Promise<Document[]> {
  return db.notes.toArray();
}

export async function getNotesByStatus(status: string): Promise<Document[]> {
  return db.notes.where('status').equals(status).toArray();
}

// ── Chunks ───────────────────────────────────────────────────────────────────

export async function saveChunks(chunks: DocumentChunk[]): Promise<void> {
  await db.chunks.bulkPut(chunks);
}

export async function getChunksByNote(noteId: string): Promise<DocumentChunk[]> {
  return db.chunks.where('noteId').equals(noteId).sortBy('paragraphIndex');
}

// ── Providers ────────────────────────────────────────────────────────────────

export async function saveProvider(cfg: ProviderConfig): Promise<void> {
  await db.providers.put(cfg);
}

export async function getProvider(id: string): Promise<ProviderConfig | undefined> {
  return db.providers.get(id);
}

export async function getAllProviders(): Promise<ProviderConfig[]> {
  return db.providers.toArray();
}

export async function deleteProvider(id: string): Promise<void> {
  await db.providers.delete(id);
}

export async function getEnabledProvider(): Promise<ProviderConfig | undefined> {
  return db.providers.filter(p => p.enabled).first();
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function saveMessage(msg: ChatMessage): Promise<void> {
  await db.messages.put(msg);
}

export async function getMessagesByConversation(conversationId: string): Promise<ChatMessage[]> {
  return db.messages.where('id').startsWith(conversationId).sortBy('createdAt');
}

// ── Quota monitoring ─────────────────────────────────────────────────────────

export async function checkStorageQuota(): Promise<{ usage: number; quota: number; pct: number }> {
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage ?? 0;
    const quota = estimate.quota ?? 0;
    const pct = quota > 0 ? usage / quota : 0;
    log.info('storage', `Storage: ${Math.round(pct * 100)}% used (${Math.round(usage / 1024 / 1024)}MB / ${Math.round(quota / 1024 / 1024)}MB)`);

    if (pct > 0.9) {
      try {
        await browser.runtime.sendMessage({
          type: 'STORAGE_QUOTA_WARNING',
          payload: { usedBytes: usage, quotaBytes: quota },
        });
      } catch { /* no listeners */ }
    }

    return { usage, quota, pct };
  } catch {
    return { usage: 0, quota: 0, pct: 0 };
  }
}

export async function requestPersist(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch { /* ignore */ }
  return false;
}

// ── Backward-compat aliases ──────────────────────────────────────────────────

// Legacy doc index (chrome.storage.local based)
const KEYS = {
  docIndex: 'notch:doc:index',
  meta: (id: string) => `notch:meta:${id}`,
};

export async function getDocIndex(): Promise<string[]> {
  const result = await browser.storage.local.get(KEYS.docIndex);
  return (result[KEYS.docIndex] as string[]) ?? [];
}

export async function saveDocIndex(index: string[]): Promise<void> {
  await browser.storage.local.set({ [KEYS.docIndex]: index });
}

export function deriveDocumentMeta(doc: Document): import('./types').DocumentMeta {
  return {
    id: doc.id, title: doc.title, url: doc.url, domain: doc.domain,
    capturedAt: doc.capturedAt, wordCount: doc.wordCount, summary: doc.summary,
    tags: doc.tags, folder: undefined, isStarred: doc.starred,
    isArchived: doc.archived, isRead: false, mode: 'FAST', provider: '',
  };
}

export async function getDocumentMetas(ids: string[]): Promise<import('./types').DocumentMeta[]> {
  const docs = await db.notes.bulkGet(ids);
  return docs.filter((d): d is Document => d != null).map(deriveDocumentMeta);
}

export async function updateDocumentMeta(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const doc = await db.notes.get(id);
  if (!doc) return;
  await db.notes.put({ ...doc, ...patch } as Document);
}

export async function getFolders(): Promise<import('./types').Folder[]> {
  return [];
}

export async function saveFolder(_folder: import('./types').Folder): Promise<void> {
  // no-op
}

export async function deleteFolder(_folderId: string): Promise<void> {
  // no-op
}

export async function getTagColors(): Promise<import('./types').TagColorMap> {
  return {};
}

export async function setTagColor(_tag: string, _color: string | null): Promise<void> {
  // no-op
}

export async function getViewMode(): Promise<'compact' | 'comfortable' | 'detailed'> {
  return 'comfortable';
}

export async function saveViewMode(_mode: 'compact' | 'comfortable' | 'detailed'): Promise<void> {
  // no-op
}
