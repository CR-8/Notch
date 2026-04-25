import type { Document, Settings } from './types';
import { deleteDocumentFromIDB } from './idb';
import { browser } from 'wxt/browser';

const KEYS = {
  settings: 'notch:settings',
  docIndex: 'notch:doc:index',
  doc: (id: string) => `notch:doc:${id}`,
} as const;

const DEFAULT_SETTINGS: Settings = {
  ollamaEndpoint: 'http://localhost:11434',
  defaultMode: 'FAST',
  ollamaModel: 'llama3',
  apiKeys: {},
};

const QUOTA_BYTES = 10 * 1024 * 1024; // 10 MB
const QUOTA_WARNING_THRESHOLD = 9 * 1024 * 1024; // 9 MB

// --- Settings ---

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(KEYS.settings);
  return (result[KEYS.settings] as Settings) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEYS.settings]: settings });
}

// --- Document Index ---

export async function getDocIndex(): Promise<string[]> {
  const result = await browser.storage.local.get(KEYS.docIndex);
  return (result[KEYS.docIndex] as string[]) ?? [];
}

export async function saveDocIndex(index: string[]): Promise<void> {
  await browser.storage.local.set({ [KEYS.docIndex]: index });
}

// --- Documents ---

export async function getDocument(id: string): Promise<Document | null> {
  const key = KEYS.doc(id);
  const result = await browser.storage.local.get(key);
  return (result[key] as Document) ?? null;
}

export async function saveDocument(doc: Document): Promise<void> {
  await browser.storage.local.set({ [KEYS.doc(doc.id)]: doc });
}

export async function deleteDocumentFromStorage(id: string): Promise<void> {
  const index = await getDocIndex();
  await browser.storage.local.remove(KEYS.doc(id));
  await saveDocIndex(index.filter((i) => i !== id));
}

export async function deleteDocument(id: string): Promise<void> {
  await deleteDocumentFromStorage(id);
  await deleteDocumentFromIDB(id);
}

// --- Quota Monitoring ---

export async function checkStorageQuota(): Promise<void> {
  // getBytesInUse is Chrome-only; Firefox storage.local has no quota API
  const storage = browser.storage.local as typeof browser.storage.local & {
    getBytesInUse?: (keys?: string | string[] | null) => Promise<number>;
  };
  if (typeof storage.getBytesInUse !== 'function') return;
  const bytesInUse = await storage.getBytesInUse();
  if (bytesInUse > QUOTA_WARNING_THRESHOLD) {
    try {
      await browser.runtime.sendMessage({
        type: 'STORAGE_QUOTA_WARNING',
        payload: { usedBytes: bytesInUse, quotaBytes: QUOTA_BYTES },
      });
    } catch {
      // Ignore — no listeners open (e.g. library tab not open)
    }
  }
}
