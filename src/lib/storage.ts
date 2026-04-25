import type { Document, DocumentMeta, Settings } from './types';
import { deleteDocumentFromIDB, saveDocumentToIDB, getDocumentFromIDB } from './idb';
import { browser } from 'wxt/browser';
import { log } from './logger';

// ── Storage keys (storage.local holds only settings + metas) ─────────────────
const KEYS = {
  settings:  'notch:settings',
  docIndex:  'notch:doc:index',
  meta:      (id: string) => `notch:meta:${id}`,
  // Legacy key — kept for backward-compat migration only
  legacyDoc: (id: string) => `notch:doc:${id}`,
} as const;

const DEFAULT_SETTINGS: Settings = {
  provider: 'gemini',
  ollamaEndpoint: 'http://localhost:11434',
  defaultMode: 'FAST',
  ollamaModel: 'llama3',
  apiKeys: {},
};

// ── Warm cache (session storage → in-memory fallback) ─────────────────────────
const CACHE_KEY = 'notch:meta:cache';
const CACHE_SIZE = 20;

// In-memory fallback for browsers without storage.session (e.g. Firefox MV2)
let _memCache: DocumentMeta[] | null = null;

async function readCache(): Promise<DocumentMeta[] | null> {
  try {
    if (browser.storage.session) {
      const r = await browser.storage.session.get(CACHE_KEY);
      return (r[CACHE_KEY] as DocumentMeta[]) ?? null;
    }
  } catch { /* session not available */ }
  return _memCache;
}

async function writeCache(metas: DocumentMeta[]): Promise<void> {
  const slice = metas.slice(0, CACHE_SIZE);
  _memCache = slice;
  try {
    if (browser.storage.session) {
      await browser.storage.session.set({ [CACHE_KEY]: slice });
    }
  } catch { /* session not available */ }
}

async function invalidateCache(): Promise<void> {
  _memCache = null;
  try {
    if (browser.storage.session) {
      await browser.storage.session.remove(CACHE_KEY);
    }
  } catch { /* session not available */ }
}

// ── Derive meta from a full document ─────────────────────────────────────────
export function deriveDocumentMeta(doc: Document): DocumentMeta {
  return {
    id:         doc.id,
    title:      doc.title,
    url:        doc.url,
    domain:     doc.domain,
    capturedAt: doc.capturedAt,
    wordCount:  doc.wordCount,
    summary:    doc.summary,
    tags:       doc.tags,
    isStarred:  doc.isStarred,
    isArchived: doc.isArchived,
    isRead:     doc.isRead,
    mode:       doc.mode,
    provider:   doc.provider,
  };
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(KEYS.settings);
  const saved = (result[KEYS.settings] as Partial<Settings> | undefined) ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    apiKeys: {
      ...DEFAULT_SETTINGS.apiKeys,
      ...(saved.apiKeys ?? {}),
    },
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEYS.settings]: settings });
}

// ── Document index ────────────────────────────────────────────────────────────

export async function getDocIndex(): Promise<string[]> {
  const result = await browser.storage.local.get(KEYS.docIndex);
  return (result[KEYS.docIndex] as string[]) ?? [];
}

export async function saveDocIndex(index: string[]): Promise<void> {
  await browser.storage.local.set({ [KEYS.docIndex]: index });
}

// ── Document meta ─────────────────────────────────────────────────────────────

export async function saveDocumentMeta(meta: DocumentMeta): Promise<void> {
  await browser.storage.local.set({ [KEYS.meta(meta.id)]: meta });
}

export async function getDocumentMeta(id: string): Promise<DocumentMeta | null> {
  const key = KEYS.meta(id);
  const result = await browser.storage.local.get(key);
  if (result[key]) return result[key] as DocumentMeta;

  // Backward-compat: derive from legacy full doc in storage.local
  const legacyKey = KEYS.legacyDoc(id);
  const legacyResult = await browser.storage.local.get(legacyKey);
  if (legacyResult[legacyKey]) {
    const doc = legacyResult[legacyKey] as Document;
    const meta = deriveDocumentMeta(doc);
    await saveDocumentMeta(meta);
    log.info('storage', `Migrated legacy doc ${id} to meta`);
    return meta;
  }

  // Try IndexedDB (new path)
  const idbDoc = await getDocumentFromIDB(id);
  if (idbDoc) {
    const meta = deriveDocumentMeta(idbDoc);
    await saveDocumentMeta(meta);
    return meta;
  }

  return null;
}

/**
 * Load all metas for the given IDs.
 * Checks warm cache first for the first CACHE_SIZE entries.
 */
export async function getDocumentMetas(ids: string[]): Promise<DocumentMeta[]> {
  if (ids.length === 0) return [];

  // Try warm cache for the first page
  const cached = await readCache();
  if (cached && cached.length > 0) {
    const cachedIds = new Set(cached.map(m => m.id));
    const allCached = ids.slice(0, CACHE_SIZE).every(id => cachedIds.has(id));
    if (allCached && ids.length <= CACHE_SIZE) {
      log.info('storage', `Serving ${cached.length} metas from warm cache`);
      return ids.map(id => cached.find(m => m.id === id)!).filter(Boolean);
    }
  }

  // Load from storage.local in one batch call
  const keys = ids.map(id => KEYS.meta(id));
  const result = await browser.storage.local.get(keys);

  const metas: DocumentMeta[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const meta = result[KEYS.meta(id)] as DocumentMeta | undefined;
    if (meta) {
      metas.push(meta);
    } else {
      missing.push(id);
    }
  }

  // Hydrate any missing metas from full docs (backward compat)
  if (missing.length > 0) {
    log.info('storage', `Hydrating ${missing.length} missing metas`);
    for (const id of missing) {
      const meta = await getDocumentMeta(id); // handles legacy + IDB
      if (meta) metas.push(meta);
    }
  }

  // Sort to match original index order
  const idOrder = new Map(ids.map((id, i) => [id, i]));
  metas.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));

  // Warm the cache with the first CACHE_SIZE
  await writeCache(metas.slice(0, CACHE_SIZE));

  return metas;
}

// ── Full documents (IndexedDB) ────────────────────────────────────────────────

export async function getDocument(id: string): Promise<Document | null> {
  // Try IndexedDB first (new path)
  const idbDoc = await getDocumentFromIDB(id);
  if (idbDoc) return idbDoc;

  // Backward-compat: fall back to storage.local legacy key
  const legacyKey = KEYS.legacyDoc(id);
  const result = await browser.storage.local.get(legacyKey);
  return (result[legacyKey] as Document) ?? null;
}

export async function saveDocument(doc: Document): Promise<void> {
  // Full doc → IndexedDB
  await saveDocumentToIDB(doc);

  // Meta → storage.local (tiny, fast)
  const meta = deriveDocumentMeta(doc);
  await saveDocumentMeta(meta);

  // Invalidate warm cache so next library open gets fresh data
  await invalidateCache();

  log.success('storage', `Saved doc + meta for ${doc.id}`);
}

export async function deleteDocumentFromStorage(id: string): Promise<void> {
  const index = await getDocIndex();
  // Remove meta from storage.local
  await browser.storage.local.remove([KEYS.meta(id), KEYS.legacyDoc(id)]);
  await saveDocIndex(index.filter((i) => i !== id));
  await invalidateCache();
}

export async function deleteDocument(id: string): Promise<void> {
  await deleteDocumentFromStorage(id);
  await deleteDocumentFromIDB(id); // removes doc + chunks + embeddings
  log.success('storage', `Deleted document ${id}`);
}

/**
 * Update only the meta fields that change on star/archive/read mutations.
 * Avoids loading the full document from IDB just to flip a boolean.
 */
export async function updateDocumentMeta(
  id: string,
  patch: Partial<Pick<DocumentMeta, 'isStarred' | 'isArchived' | 'isRead' | 'tags'>>,
): Promise<void> {
  const meta = await getDocumentMeta(id);
  if (!meta) return;
  const updated = { ...meta, ...patch };
  await saveDocumentMeta(updated);
  await invalidateCache();

  // Also patch the full doc in IDB so they stay in sync
  const doc = await getDocumentFromIDB(id);
  if (doc) {
    await saveDocumentToIDB({ ...doc, ...patch });
  }
}

// ── Quota monitoring (navigator.storage.estimate — works in both browsers) ───

export async function checkStorageQuota(): Promise<void> {
  try {
    if (!navigator.storage?.estimate) return;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (quota === 0) return;
    const pct = usage / quota;
    log.info('storage', `Storage usage: ${Math.round(pct * 100)}% (${Math.round(usage / 1024 / 1024)} MB / ${Math.round(quota / 1024 / 1024)} MB)`);
    if (pct > 0.9) {
      try {
        await browser.runtime.sendMessage({
          type: 'STORAGE_QUOTA_WARNING',
          payload: { usedBytes: usage, quotaBytes: quota },
        });
      } catch { /* no listeners */ }
    }
  } catch (err) {
    log.warn('storage', 'Could not estimate storage quota', err);
  }
}
