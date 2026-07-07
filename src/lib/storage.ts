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
  Folder,
  TagColorMap,
  ViewMode,
  DocumentMeta,
} from './types';

const SETTINGS_KEY = 'notch:settings';
const APPEARANCE_KEY = 'notch:appearance';
const SCHEMA_VERSION_KEY = 'notch:schema:version';
const CURRENT_SCHEMA_VERSION = 2;

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

// Dark by default; light is the toggleable alternate. Inter (sans) substitutes
// the Helvetica Now UI tier per DESIGN.md; ink (#111111) is the monochrome
// default accent — the adaptive primary token inverts it per theme.
const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  fontFamily: 'sans',
  fontSize: 'md',
  accentColor: '#111111',
};

// ── Schema migration guard ───────────────────────────────────────────────────

export async function ensureSchema(): Promise<void> {
  const result = await browser.storage.local.get(SCHEMA_VERSION_KEY);
  const version = (result[SCHEMA_VERSION_KEY] as number) ?? 0;
  if (version < CURRENT_SCHEMA_VERSION) {
    log.info('storage', `Migrating schema from v${version} to v${CURRENT_SCHEMA_VERSION}`);

    if (version < 2) {
      // v2: Content Intelligence Engine — update existing documents with default values
      try {
        const allNotes = await db.notes.toArray();
        for (const note of allNotes) {
          const enrichedContent = note.content;
          const diagramCount = (
            enrichedContent?.match(
              /```(?:mermaid|plantuml|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|mindmap|timeline|gantt|pie|journey|gitGraph)\b/g,
            ) ?? []
          ).length;
          const calloutCount = (
            enrichedContent?.match(/\[!(?:NOTE|WARNING|TIP|DANGER|INFO)\]/g) ?? []
          ).length;

          await db.notes.put({
            ...note,
            enrichedContent: enrichedContent ?? note.textContent,
            diagramCount,
            calloutCount: calloutCount,
            hasToc: (enrichedContent ?? '').includes('## Table of Contents'),
            hasNumbering: true,
            qualityScore: Math.min(100, 60 + diagramCount * 5 + calloutCount * 3),
          });
        }
        log.success('storage', `Migrated ${allNotes.length} documents to v2 schema`);
      } catch (err) {
        log.warn('storage', 'Schema v2 migration error (non-fatal)', err);
      }
    }

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
  return {
    ...DEFAULT_APPEARANCE,
    ...((result[APPEARANCE_KEY] as Partial<AppearanceSettings>) ?? {}),
  };
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
  await db.transaction(
    'rw',
    db.notes,
    db.chunks,
    db.vectors,
    db.messages,
    db.highlights,
    async () => {
      const chunkIds = await db.chunks.where('noteId').equals(id).primaryKeys();
      await db.notes.delete(id);
      await db.chunks.where('noteId').equals(id).delete();
      await db.vectors.where('chunkId').anyOf(chunkIds).delete();
      await db.messages.where('documentId').equals(id).delete();
      await db.highlights.where('documentId').equals(id).delete();
    },
  );
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
  return db.providers.filter((p) => p.enabled).first();
}

/**
 * Wipe every stored API key without removing provider configs.
 * Strips `apiKey` from all provider records and clears the legacy
 * `settings.apiKey` field, so secrets are gone but base URLs / models remain.
 * Returns the number of keys cleared.
 */
export async function clearAllApiKeys(): Promise<number> {
  const provs = await db.providers.toArray();
  let cleared = 0;
  await Promise.all(
    provs.map((p) => {
      if (p.apiKey) cleared++;
      return db.providers.put({ ...p, apiKey: '' });
    }),
  );
  const s = await getSettings();
  if (s.apiKey) {
    cleared++;
    await saveSettings({ ...s, apiKey: '' });
  }
  log.info('storage', `Cleared ${cleared} stored API key(s)`);
  return cleared;
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
    log.info(
      'storage',
      `Storage: ${Math.round(pct * 100)}% used (${Math.round(usage / 1024 / 1024)}MB / ${Math.round(quota / 1024 / 1024)}MB)`,
    );

    if (pct > 0.9) {
      try {
        await browser.runtime.sendMessage({
          type: 'STORAGE_QUOTA_WARNING',
          payload: { usedBytes: usage, quotaBytes: quota },
        });
      } catch {
        /* no listeners */
      }
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
  } catch {
    /* ignore */
  }
  return false;
}

// ── Backward-compat aliases ──────────────────────────────────────────────────

// Legacy doc index (chrome.storage.local based)
const KEYS = {
  docIndex: 'notch:doc:index',
  meta: (id: string) => `notch:meta:${id}`,
};

// The library reads its document list via this index. Documents live in Dexie
// (db.notes), so derive the index from there — newest first — rather than a
// separate browser.storage list that capture never updated.
export async function getDocIndex(): Promise<string[]> {
  const notes = await db.notes.orderBy('createdAt').reverse().toArray();
  return notes.map((d) => d.id);
}

export async function saveDocIndex(index: string[]): Promise<void> {
  await browser.storage.local.set({ [KEYS.docIndex]: index });
}

export function deriveDocumentMeta(doc: Document): DocumentMeta {
  const topEntities = doc.entities?.slice(0, 3).map((e) => e.name);
  const topConcepts = doc.concepts?.slice(0, 3).map((c) => c.term);
  return {
    id: doc.id,
    title: doc.title,
    url: doc.url,
    domain: doc.domain,
    capturedAt: doc.capturedAt,
    wordCount: doc.wordCount,
    summary: doc.summary,
    tags: doc.tags,
    folder: doc.folder,
    isStarred: doc.starred,
    isArchived: doc.archived,
    isRead: false,
    mode: 'FAST',
    provider: '',
    entityCount: doc.entities?.length ?? 0,
    conceptCount: doc.concepts?.length ?? 0,
    hasTimeline: (doc.timeline?.length ?? 0) > 0,
    diagramCount: doc.diagramCount ?? 0,
    imageCount: doc.imageCount ?? doc.images?.length ?? 0,
    readingTimeMinutes: doc.readingTimeMinutes,
    documentType: doc.documentType,
    qualityScore: doc.qualityScore,
    topEntities,
    topConcepts,
  };
}

export async function getDocumentMetas(ids: string[]): Promise<DocumentMeta[]> {
  const docs = await db.notes.bulkGet(ids);
  return docs.filter((d): d is Document => d != null).map(deriveDocumentMeta);
}

export async function updateDocumentMeta(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const doc = await db.notes.get(id);
  if (!doc) return;
  await db.notes.put({ ...doc, ...patch });
}

const FOLDERS_KEY = 'notch:folders';
const TAG_COLORS_KEY = 'notch:tagColors';
const VIEW_MODE_KEY = 'notch:viewMode';

export async function getFolders(): Promise<Folder[]> {
  const result = await browser.storage.local.get(FOLDERS_KEY);
  return (result[FOLDERS_KEY] as Folder[]) ?? [];
}

export async function saveFolder(folder: Folder): Promise<void> {
  const folders = await getFolders();
  const idx = folders.findIndex((f) => f.id === folder.id);
  if (idx >= 0) folders[idx] = folder;
  else folders.push(folder);
  await browser.storage.local.set({ [FOLDERS_KEY]: folders });
}

export async function deleteFolder(folderId: string): Promise<void> {
  const folders = (await getFolders()).filter((f) => f.id !== folderId);
  await browser.storage.local.set({ [FOLDERS_KEY]: folders });
}

export async function getTagColors(): Promise<TagColorMap> {
  const result = await browser.storage.local.get(TAG_COLORS_KEY);
  return (result[TAG_COLORS_KEY] as TagColorMap) ?? {};
}

export async function setTagColor(tag: string, color: string | null): Promise<void> {
  const colors = await getTagColors();
  if (color === null) delete colors[tag];
  else colors[tag] = color;
  await browser.storage.local.set({ [TAG_COLORS_KEY]: colors });
}

export async function getViewMode(): Promise<ViewMode> {
  const result = await browser.storage.local.get(VIEW_MODE_KEY);
  return (result[VIEW_MODE_KEY] as ViewMode) ?? 'comfortable';
}

export async function saveViewMode(mode: ViewMode): Promise<void> {
  await browser.storage.local.set({ [VIEW_MODE_KEY]: mode });
}

// ── LIB-6: Related notes ─────────────────────────────────────────────────────

export interface RelatedNote {
  id: string;
  title: string;
  url: string;
  capturedAt: string;
  tags: string[];
  score: number;
  sharedTags: string[];
  sharedEntities: string[];
  sharedConcepts: string[];
}

/**
 * LIB-6: Find notes related to a given document, ranked by tag/entity/concept overlap.
 * Returns up to `maxResults` results, excluding the source document itself.
 */
export async function findRelatedNotes(documentId: string, maxResults = 5): Promise<RelatedNote[]> {
  const source = await db.notes.get(documentId);
  if (!source) return [];

  const sourceTags = new Set(source.tags ?? []);
  const sourceEntities = new Set((source.entities ?? []).map((e) => e.name.toLowerCase()));
  const sourceConcepts = new Set((source.concepts ?? []).map((c) => c.term.toLowerCase()));

  if (sourceTags.size === 0 && sourceEntities.size === 0 && sourceConcepts.size === 0) {
    // Nothing to relate by — return most recently captured excluding self
    const recent = await db.notes
      .orderBy('createdAt')
      .reverse()
      .filter((n) => n.id !== documentId && n.status === 'ready')
      .limit(maxResults)
      .toArray();
    return recent.map((n) => ({
      id: n.id,
      title: n.title,
      url: n.url,
      capturedAt: n.capturedAt,
      tags: n.tags,
      score: 0,
      sharedTags: [],
      sharedEntities: [],
      sharedConcepts: [],
    }));
  }

  const allNotes = await db.notes
    .filter((n) => n.id !== documentId && n.status === 'ready')
    .toArray();

  const scored: RelatedNote[] = allNotes.map((n) => {
    const sharedTags = (n.tags ?? []).filter((t) => sourceTags.has(t));
    const sharedEntities = (n.entities ?? [])
      .filter((e) => sourceEntities.has(e.name.toLowerCase()))
      .map((e) => e.name);
    const sharedConcepts = (n.concepts ?? [])
      .filter((c) => sourceConcepts.has(c.term.toLowerCase()))
      .map((c) => c.term);
    const score = sharedTags.length * 3 + sharedEntities.length * 2 + sharedConcepts.length;
    return {
      id: n.id,
      title: n.title,
      url: n.url,
      capturedAt: n.capturedAt,
      tags: n.tags,
      score,
      sharedTags,
      sharedEntities,
      sharedConcepts,
    };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
}

// ── LIB-7: Read/unread state ──────────────────────────────────────────────────

/**
 * LIB-7: Mark a document as read. Uses updateDocumentMeta which patches via Dexie.
 */
export async function markDocumentRead(id: string): Promise<void> {
  await updateDocumentMeta(id, { isRead: true, updatedAt: new Date().toISOString() });
}
