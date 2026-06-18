import { getSettings, saveDocument, checkStorageQuota, requestPersist, ensureSchema, getProvider } from '../lib/storage';
import { getChatProvider, testProviderConnection } from '../lib/providers/registry';
import { runCapturePipeline, runRAGPipeline } from '../lib/pipeline';
import { log } from '../lib/logger';
import { AIClientError } from '../lib/providers/errors';
import type { DOMExtraction, GenerationMode, RuntimeMessage, TestResult } from '../lib/types';

function trySendToPopup(msg: RuntimeMessage): void {
  try {
    browser.runtime.sendMessage(msg).catch(() => {});
  } catch { /* no popup */ }
}

export default defineBackground(() => {
  log.info('background', '=== Notch service worker started ===');

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
        return handleCapture(message.payload.mode, message.payload.tags);
      case 'TEST_CONNECTION':
        return handleTestConnection(message.payload.providerId);
      default:
        return;
    }
  });
});

async function handleCapture(mode: GenerationMode, tags: string[]): Promise<RuntimeMessage> {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab?.id) throw new Error('No active tab found');

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
