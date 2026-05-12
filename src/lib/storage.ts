import type { Document, DocumentMeta, Folder, Settings, TagColorMap, ViewMode, AppearanceSettings } from './types';
import { deleteDocumentFromIDB, saveDocumentToIDB, getDocumentFromIDB } from './idb';
import { browser } from 'wxt/browser';
import { log } from './logger';

const KEYS = {
  settings: 'notch:settings',
  docIndex: 'notch:doc:index',
  folders: 'notch:folders',
  tagColors: 'notch:tag-colors',
  viewMode: 'notch:view-mode',
  appearance: 'notch:appearance',
  meta: (id: string) => `notch:meta:${id}`,
  legacyDoc: (id: string) => `notch:doc:${id}`,
} as const;

const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  provider: 'anthropic',
  baseUrl: '',
  modelId: 'claude-3-5-sonnet-20241022',
  defaultMode: 'FAST',
};

const FALLBACK_MODELS: Record<string, string> = {
  anthropic: 'claude-3-5-sonnet-20241022',
  'openai-compatible': 'openai/gpt-4o',
  offline: 'local',
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: 'dark',
  fontFamily: 'mono',
  fontSize: 'md',
  accentColor: '#e07c3a',
};

// ── Warm cache ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'notch:meta:cache';
const CACHE_SIZE = 20;
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

// ── Derive meta from full document ─────────────────────────────────────────────

export function deriveDocumentMeta(doc: Document): DocumentMeta {
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
    isStarred: doc.isStarred,
    isArchived: doc.isArchived,
    isRead: doc.isRead,
    mode: doc.mode,
    provider: doc.provider,
  };
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(KEYS.settings);
  const saved = (result[KEYS.settings] as Partial<Settings> | undefined) ?? {};
  const settings = { ...DEFAULT_SETTINGS, ...saved };

  // Apply fallback model based on provider if current model is invalid
  if (settings.provider === 'anthropic') {
    // Anthropic uses direct API, model should be claude-* format
    if (!settings.modelId.startsWith('claude-') && settings.modelId !== 'custom') {
      settings.modelId = FALLBACK_MODELS.anthropic;
    }
  } else if (settings.provider === 'openai-compatible') {
    // OpenAI compatible uses provider format like "openai/gpt-4o"
    // If model is empty or looks like anthropic direct, reset
    if (!settings.modelId || settings.modelId.startsWith('claude-')) {
      settings.modelId = FALLBACK_MODELS['openai-compatible'];
    }
  } else if (settings.provider === 'offline') {
    settings.modelId = 'local';
  }

  return settings;
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

  // Backward-compat: derive from legacy doc in storage.local
  const legacyKey = KEYS.legacyDoc(id);
  const legacyResult = await browser.storage.local.get(legacyKey);
  if (legacyResult[legacyKey]) {
    const doc = legacyResult[legacyKey] as Document;
    const meta = deriveDocumentMeta(doc);
    await saveDocumentMeta(meta);
    log.info('storage', `Migrated legacy doc ${id} to meta`);
    return meta;
  }

  // Try IndexedDB
  const idbDoc = await getDocumentFromIDB(id);
  if (idbDoc) {
    const meta = deriveDocumentMeta(idbDoc);
    await saveDocumentMeta(meta);
    return meta;
  }

  return null;
}

export async function getDocumentMetas(ids: string[]): Promise<DocumentMeta[]> {
  if (ids.length === 0) return [];

  const cached = await readCache();
  if (cached && cached.length > 0) {
    const cachedIds = new Set(cached.map(m => m.id));
    const allCached = ids.slice(0, CACHE_SIZE).every(id => cachedIds.has(id));
    if (allCached && ids.length <= CACHE_SIZE) {
      return ids.map(id => cached.find(m => m.id === id)!).filter(Boolean);
    }
  }

  const keys = ids.map(id => KEYS.meta(id));
  const result = await browser.storage.local.get(keys);

  const metas: DocumentMeta[] = [];
  const missing: string[] = [];

  for (const id of ids) {
    const meta = result[KEYS.meta(id)] as DocumentMeta | undefined;
    if (meta) metas.push(meta);
    else missing.push(id);
  }

  if (missing.length > 0) {
    log.info('storage', `Hydrating ${missing.length} missing metas`);
    for (const id of missing) {
      const meta = await getDocumentMeta(id);
      if (meta) metas.push(meta);
    }
  }

  const idOrder = new Map(ids.map((id, i) => [id, i]));
  metas.sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
  await writeCache(metas.slice(0, CACHE_SIZE));

  return metas;
}

// ── Full documents ─────────────────────────────────────────────────────────────

export async function getDocument(id: string): Promise<Document | null> {
  const idbDoc = await getDocumentFromIDB(id);
  if (idbDoc) return idbDoc;

  const legacyKey = KEYS.legacyDoc(id);
  const result = await browser.storage.local.get(legacyKey);
  return (result[legacyKey] as Document) ?? null;
}

export async function saveDocument(doc: Document): Promise<void> {
  await saveDocumentToIDB(doc);
  const meta = deriveDocumentMeta(doc);
  await saveDocumentMeta(meta);
  await invalidateCache();
  log.success('storage', `Saved doc + meta for ${doc.id}`);
}

export async function deleteDocumentFromStorage(id: string): Promise<void> {
  const index = await getDocIndex();
  await browser.storage.local.remove([KEYS.meta(id), KEYS.legacyDoc(id)]);
  await saveDocIndex(index.filter(i => i !== id));
  await invalidateCache();
}

export async function deleteDocument(id: string): Promise<void> {
  await deleteDocumentFromStorage(id);
  await deleteDocumentFromIDB(id);
  log.success('storage', `Deleted document ${id}`);
}

export async function updateDocumentMeta(
  id: string,
  patch: Partial<Pick<DocumentMeta, 'isStarred' | 'isArchived' | 'isRead' | 'tags' | 'folder'>>,
): Promise<void> {
  const meta = await getDocumentMeta(id);
  if (!meta) return;
  const updated = { ...meta, ...patch };
  await saveDocumentMeta(updated);
  await invalidateCache();

  const doc = await getDocumentFromIDB(id);
  if (doc) {
    await saveDocumentToIDB({ ...doc, ...patch });
  }
}

// ── Quota monitoring ──────────────────────────────────────────────────────────

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

// ── Folders ───────────────────────────────────────────────────────────────────

export async function getFolders(): Promise<Folder[]> {
  const result = await browser.storage.local.get(KEYS.folders);
  return (result[KEYS.folders] as Folder[]) ?? [];
}

export async function saveFolder(folder: Folder): Promise<void> {
  const folders = await getFolders();
  const idx = folders.findIndex(f => f.id === folder.id);
  if (idx >= 0) folders[idx] = folder;
  else folders.push(folder);
  await browser.storage.local.set({ [KEYS.folders]: folders });
}

export async function deleteFolder(folderId: string): Promise<void> {
  const folders = await getFolders();
  await browser.storage.local.set({ [KEYS.folders]: folders.filter(f => f.id !== folderId) });
  await moveFolderDocuments(folderId, undefined);
}

export async function renameFolder(id: string, newName: string): Promise<void> {
  const folders = await getFolders();
  const idx = folders.findIndex(f => f.id === id);
  if (idx < 0) return;
  folders[idx] = { ...folders[idx], name: newName };
  await browser.storage.local.set({ [KEYS.folders]: folders });
}

export async function moveFolderDocuments(fromFolderId: string, toFolderId: string | undefined): Promise<void> {
  const index = await getDocIndex();
  const keys = index.map(id => KEYS.meta(id));
  const result = await browser.storage.local.get(keys);
  const patches: Record<string, DocumentMeta> = {};
  for (const id of index) {
    const meta = result[KEYS.meta(id)] as DocumentMeta | undefined;
    if (meta?.folder === fromFolderId) {
      patches[KEYS.meta(id)] = { ...meta, folder: toFolderId };
    }
  }
  if (Object.keys(patches).length > 0) await browser.storage.local.set(patches);
  await invalidateCache();
}

// ── Tag colors ───────────────────────────────────────────────────────────────

export async function getTagColors(): Promise<TagColorMap> {
  const result = await browser.storage.local.get(KEYS.tagColors);
  return (result[KEYS.tagColors] as TagColorMap) ?? {};
}

export async function setTagColor(tag: string, color: string | null): Promise<void> {
  const map = await getTagColors();
  if (color === null) delete map[tag];
  else map[tag] = color;
  await browser.storage.local.set({ [KEYS.tagColors]: map });
}

// ── View mode ─────────────────────────────────────────────────────────────────

export async function getViewMode(): Promise<ViewMode> {
  const result = await browser.storage.local.get(KEYS.viewMode);
  return (result[KEYS.viewMode] as ViewMode) ?? 'comfortable';
}

export async function saveViewMode(mode: ViewMode): Promise<void> {
  await browser.storage.local.set({ [KEYS.viewMode]: mode });
}

// ── Appearance ─────────────────────────────────────────────────────────────────

export async function getAppearance(): Promise<AppearanceSettings> {
  const result = await browser.storage.local.get(KEYS.appearance);
  const saved = result[KEYS.appearance] as Partial<AppearanceSettings> | undefined;
  return { ...DEFAULT_APPEARANCE, ...saved };
}

export async function saveAppearance(settings: AppearanceSettings): Promise<void> {
  await browser.storage.local.set({ [KEYS.appearance]: settings });
}