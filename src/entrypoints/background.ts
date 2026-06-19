import { getSettings, saveDocument, checkStorageQuota, requestPersist, ensureSchema, getProvider, getAllNotes } from '../lib/storage';
import { testProviderConnection } from '../lib/providers/registry';
import { runCapturePipeline, runRAGPipeline, generateEmbeddingsForDocument, translateText } from '../lib/pipeline';
import { importNotchPDF } from '../lib/import';
import { findDuplicateId } from '../lib/dedupe';
import { log } from '../lib/logger';
import type { DOMExtraction, GenerationMode, RuntimeMessage, TestResult } from '../lib/types';

function trySendToPopup(msg: RuntimeMessage): void {
  try {
    browser.runtime.sendMessage(msg).catch(() => {});
  } catch { /* no popup */ }
}

export default defineBackground(() => {
  log.info('background', '=== Notch service worker started ===');

  // ONB-1/2: open the welcome flow on fresh install.
  browser.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') }).catch(() => {});
    }
  });

  ensureSchema().catch((err) => log.warn('background', 'Schema migration error', err));

  requestPersist().then((granted) => {
    log.info('background', `Persistent storage ${granted ? 'granted' : 'not granted'}`);
  });

  // Resume stuck captures on startup
  (async () => {
    try {
      const stuck = await (await import('../lib/storage')).getNotesByStatus('captured');
      for (const note of stuck) {
        log.warn('background', `Found stuck capture: ${note.id} - "${note.title}"`);
        note.status = 'failed';
        await saveDocument(note);
      }
    } catch { /* db might not be ready */ }
  })();

  browser.runtime.onMessage.addListener(async (message: RuntimeMessage) => {
    log.info('background', `Message: ${message.type}`);
    switch (message.type) {
      case 'CAPTURE_PAGE':
        return handleCapture(message.payload.mode, message.payload.tags, message.payload.tabId, message.payload.url);
      case 'TEST_CONNECTION':
        return handleTestConnection(message.payload.providerId);
      case 'RAG_QUERY':
        return handleRAG(message.payload.documentId, message.payload.query, message.payload.readingLevel);
      case 'GENERATE_EMBEDDINGS':
        return handleGenerateEmbeddings(message.payload.documentId);
      case 'IMPORT_PDF':
        return handleImportPDF(message.payload.fileName, message.payload.bytes);
      case 'TRANSLATE':
        return handleTranslate(message.payload.text, message.payload.targetLanguage);
      case 'ENRICH_DOCUMENT':
        return handleEnrichDocument(message.payload.documentId, message.payload.mode);
      default:
        return;
    }
  });
});

async function handleEnrichDocument(documentId: string, mode: 'FAST' | 'BALANCED' | 'DEEP'): Promise<RuntimeMessage> {
  try {
    const doc = await (await import('../lib/storage')).getDocument(documentId);
    if (!doc) throw new Error(`Document not found: ${documentId}`);

    const content = doc.content ?? doc.summary ?? '';
    if (!content) throw new Error('Document has no content to enrich');

    // Analyze the content and generate enrichment metadata
    const diagramCount = (content.match(/```(?:mermaid|plantuml|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|mindmap|timeline|gantt|pie|journey|gitGraph)\b/g) ?? []).length;
    const calloutCount = (content.match(/\[!(?:NOTE|WARNING|TIP|DANGER|INFO)\]/g) ?? []).length;
    const hasDiagrams = diagramCount > 0;
    const hasCallouts = calloutCount > 0;

    // Enhance the document metadata
    const updatedDoc = {
      ...doc,
      enrichedContent: content,
      diagramCount,
      calloutCount,
      hasToc: content.includes('## Table of Contents'),
      hasNumbering: true,
      qualityScore: Math.min(100, 60 + diagramCount * 5 + calloutCount * 3),
    };

    await (await import('../lib/storage')).saveDocument(updatedDoc);

    return {
      type: 'ENRICH_COMPLETE',
      payload: {
        documentId,
        enriched: true,
        diagramCount,
        calloutCount,
      },
    } as RuntimeMessage;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `Enrichment failed: ${message}`, err);
    return {
      type: 'ENRICH_ERROR',
      payload: { error: message },
    } as RuntimeMessage;
  }
}

async function handleRAG(documentId: string, query: string, readingLevel?: import('../lib/types').ReadingLevel): Promise<RuntimeMessage> {
  try {
    const { answer, citations } = await runRAGPipeline(query, documentId, undefined, readingLevel);
    return { type: 'RAG_RESPONSE', payload: { answer, citations } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `RAG failed: ${message}`, err);
    return { type: 'RAG_ERROR', payload: { error: message } };
  }
}

async function handleTranslate(text: string, targetLanguage: string): Promise<RuntimeMessage> {
  try {
    const translated = await translateText(text, targetLanguage);
    return { type: 'TRANSLATE_RESULT', payload: { translated } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `Translate failed: ${message}`, err);
    return { type: 'TRANSLATE_ERROR', payload: { error: message } };
  }
}

async function handleGenerateEmbeddings(documentId: string): Promise<RuntimeMessage> {
  try {
    await generateEmbeddingsForDocument(documentId);
    return { type: 'CAPTURE_COMPLETE', payload: { documentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `Embedding generation failed: ${message}`, err);
    return { type: 'CAPTURE_ERROR', payload: { error: message } };
  }
}

async function handleImportPDF(fileName: string, bytes: number[]): Promise<RuntimeMessage> {
  try {
    const file = new File([new Uint8Array(bytes)], fileName, { type: 'application/pdf' });
    const documentId = await importNotchPDF(file);
    return { type: 'CAPTURE_COMPLETE', payload: { documentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `PDF import failed: ${message}`, err);
    return { type: 'CAPTURE_ERROR', payload: { error: message } };
  }
}

async function handleCapture(mode: GenerationMode, tags: string[], tabId?: number, url?: string): Promise<RuntimeMessage> {
  try {
    // BUG-001: prefer the tabId/url resolved by the caller (popup), which runs in a
    // real window context. A Chrome MV3 service worker has no "current window", so
    // tabs.query({currentWindow:true}) can return [] here — fall back progressively.
    const tab = await resolveActiveTab(tabId, url);
    if (!tab?.id) throw new Error('No active tab found — open a page and try again');

    // CAP-5: if this page is already saved, open the existing note instead of
    // capturing a duplicate.
    if (tab.url) {
      const existing = await getAllNotes().catch(() => []);
      const dupId = findDuplicateId(tab.url, existing.map(n => ({ id: n.id, url: n.url })));
      if (dupId) {
        log.info('background', `Duplicate detected for ${tab.url}, returning existing ${dupId}`);
        return { type: 'CAPTURE_COMPLETE', payload: { documentId: dupId } };
      }
    }

    trySendToPopup({ type: 'CAPTURE_PROGRESS', payload: { step: 'Extracting page content...', pct: 5 } });

    const extraction = await extractDOM(tab.id, tab.url ?? '');

    trySendToPopup({ type: 'CAPTURE_PROGRESS', payload: { step: 'Starting AI structuring...', pct: 15 } });

    const documentId = await runCapturePipeline(extraction, mode, tags, (step, pct) => {
      trySendToPopup({ type: 'CAPTURE_PROGRESS', payload: { step, pct } });
    });

    trySendToPopup({ type: 'CAPTURE_PROGRESS', payload: { step: 'Checking storage...', pct: 95 } });
    await checkStorageQuota();

    log.success('background', `Capture complete: ${documentId}`);
    return { type: 'CAPTURE_COMPLETE', payload: { documentId } };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `Capture failed: ${message}`, err);
    trySendToPopup({ type: 'CAPTURE_ERROR', payload: { error: message } });
    return { type: 'CAPTURE_ERROR', payload: { error: message } };
  }
}

/**
 * BUG-001: resolve the active tab reliably across Chrome / Brave / Edge / Firefox.
 * Order: (1) tabId handed down by the popup, (2) active tab of the current window,
 * (3) active tab of the last-focused window, (4) any active tab. Service workers in
 * Chromium have no associated window, so `currentWindow:true` alone is unreliable.
 */
async function resolveActiveTab(
  tabId?: number,
  url?: string,
): Promise<{ id?: number; url?: string } | undefined> {
  if (typeof tabId === 'number') {
    try {
      const tab = await browser.tabs.get(tabId);
      if (tab?.id) return { id: tab.id, url: tab.url ?? url };
    } catch {
      // tab closed between popup click and handling — fall through to queries
    }
  }

  const queries: Parameters<typeof browser.tabs.query>[0][] = [
    { active: true, currentWindow: true },
    { active: true, lastFocusedWindow: true },
    { active: true },
  ];
  for (const q of queries) {
    try {
      const [tab] = await browser.tabs.query(q);
      if (tab?.id) return { id: tab.id, url: tab.url };
    } catch { /* try the next strategy */ }
  }
  return undefined;
}

async function extractDOM(tabId: number, url: string): Promise<DOMExtraction> {
  try {
    const extraction = await browser.tabs.sendMessage(tabId, { type: 'EXTRACT_DOM', payload: {} }) as
      | DOMExtraction
      | { error: string }
      | undefined;

    if (!extraction) throw new Error('No response from content script');
    if ('error' in extraction) throw new Error(extraction.error);
    return extraction;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/Receiving end does not exist|Could not establish connection/i.test(msg)) throw err;

    log.warn('background', `Content script not available for tab ${tabId}, using scripting API`);

    const results = await browser.scripting?.executeScript({
      target: { tabId },
      func: () => {
        const body = document.body ?? document.documentElement;
        const textContent = body?.innerText ?? '';
        const structuredHTML = body?.innerHTML ?? '';
        const title = document.title || 'Untitled';
        const images = Array.from(document.querySelectorAll('img'))
          .map((img) => {
            let ctx = '';
            let el: Element | null = img;
            while (el && el.tagName !== 'P') el = el.parentElement;
            if (el) ctx = (el as HTMLElement).innerText ?? '';
            return { url: img.src, alt: img.alt ?? '', paragraphContext: ctx };
          })
          .filter((i) => i.url);
        return {
          title,
          url: window.location.href,
          domain: window.location.hostname,
          textContent,
          cleanedHtml: structuredHTML,
          images,
          wordCount: textContent.split(/\s+/).filter(Boolean).length,
          metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
        } as DOMExtraction;
      },
    });

    const result = results?.[0]?.result;
    if (result) return result;
    throw new Error('Could not extract DOM from tab');
  }
}

async function handleTestConnection(providerId: string): Promise<RuntimeMessage> {
  try {
    const provider = await getProvider(providerId);
    if (!provider) throw new Error(`Provider ${providerId} not found`);
    const result: TestResult = await testProviderConnection(provider);
    return { type: 'TEST_CONNECTION_RESULT', payload: { providerId, result } };
  } catch (err) {
    return {
      type: 'TEST_CONNECTION_RESULT',
      payload: { providerId, result: { success: false, latencyMs: 0, error: (err as Error).message } },
    };
  }
}
