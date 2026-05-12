import { AIClientError, sendCaptureRequest, sendRAGRequest } from '../lib/ai-client';
import { getChunksByDocument, saveChatMessage, saveChunk } from '../lib/idb';
import { buildOfflineCaptureMarkdown, answerWithOfflineNLP, rankChunksByKeywords } from '../lib/nlp-fallback';
import { parsePdfBytes } from '../lib/pdf-parser';
import { checkStorageQuota, getAppearance, getDocIndex, getDocument, getSettings, saveDocIndex, saveDocument } from '../lib/storage';
import { log } from '../lib/logger';
import { sanitizeAiResponse, sanitizeUserInput } from '../lib/sanitize';
import type { Citation, DOMExtraction, Document, DocumentChunk, GenerationMode, NotchMessage } from '../lib/types';

function extractPageDom(): DOMExtraction {
  const body = document.body ?? document.documentElement;
  const readableText = body?.innerText ?? document.documentElement?.innerText ?? '';
  const readableHtml = body?.innerHTML ?? document.documentElement?.outerHTML ?? '';

  const images = Array.from(document.querySelectorAll('img'))
    .map((img) => {
      let paragraphContext = '';
      let el: Element | null = img;
      while (el && el.tagName !== 'P') el = el.parentElement;
      if (el) paragraphContext = (el as HTMLElement).innerText ?? '';
      return { url: img.src, alt: img.alt ?? '', paragraphContext };
    })
    .filter((img) => img.url);

  return {
    title: document.title || body?.querySelector('title')?.textContent || 'Untitled document',
    url: window.location.href,
    domain: window.location.hostname,
    textContent: readableText,
    structuredHTML: readableHtml,
    images,
    wordCount: readableText.split(/\s+/).filter(Boolean).length,
    metaDescription: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
  };
}

function isQuotaExhaustedError(err: unknown): boolean {
  if (err instanceof AIClientError) {
    return err.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(err.message);
  }
  if (err instanceof Error) {
    return /429|RESOURCE_EXHAUSTED|quota/i.test(err.message);
  }
  return false;
}

async function extractDomFromTab(tabId: number): Promise<DOMExtraction> {
  try {
    const extraction = await browser.tabs.sendMessage(
      tabId,
      { type: 'EXTRACT_DOM', payload: {} },
    ) as DOMExtraction | { error: string } | undefined;

    if (!extraction) {
      throw new Error('No response from content script. Ensure the page is fully loaded and try again.');
    }
    if ('error' in extraction) {
      throw new Error(`Content script error: ${extraction.error}`);
    }

    return extraction;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/Receiving end does not exist|Could not establish connection/i.test(message)) {
      throw err;
    }

    log.warn('background', `Content script unavailable for tab ${tabId}; trying direct DOM injection`, err);

    const scripting = (browser as typeof browser & { scripting?: { executeScript?: Function } }).scripting;
    if (scripting?.executeScript) {
      const results = await scripting.executeScript({
        target: { tabId },
        func: extractPageDom,
      }) as Array<{ result?: DOMExtraction }>;

      const result = results?.[0]?.result;
      if (result) return result;
    }

    const tabsApi = browser.tabs as typeof browser.tabs & { executeScript?: Function };
    if (tabsApi.executeScript) {
      const results = await tabsApi.executeScript(tabId, {
        code: `(${extractPageDom.toString()})()`,
      }) as Array<DOMExtraction>;

      const result = results?.[0];
      if (result) return result;
    }

    throw new Error(`Unable to extract DOM from tab ${tabId}. Open a normal web page and try again.`);
  }
}

export default defineBackground(() => {
  log.info('background', '=== Service worker started ===', { extensionId: browser.runtime.id });

  // Apply global appearance settings to all open tabs
  async function applyAppearanceGlobally() {
    try {
      const appearance = await getAppearance();
      const resolvedTheme = appearance.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : appearance.theme;

      const script = `
        (function() {
          document.documentElement.dataset.theme = '${resolvedTheme}';
          document.body.dataset.theme = '${resolvedTheme}';
          document.documentElement.style.setProperty('--color-primary', '${appearance.accentColor}');
          document.documentElement.style.setProperty('--font-family', '${appearance.fontFamily}');
        })();
      `;

      const windows = await browser.windows.getAll({ populate: true });
      for (const win of windows) {
        if (win.tabs) {
          for (const tab of win.tabs) {
            if (tab.id && tab.url?.startsWith('http')) {
              try {
                await browser.tabs.executeScript(tab.id, { code: script });
              } catch { /* tab may not allow scripts */ }
            }
          }
        }
      }
      log.info('background', `Applied appearance globally: theme=${resolvedTheme}, accent=${appearance.accentColor}`);
    } catch (err) {
      log.warn('background', 'Failed to apply appearance globally', err);
    }
  }

  // Initial apply on startup
  applyAppearanceGlobally();

  // Listen for appearance changes and re-apply
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes['notch:appearance']) {
      applyAppearanceGlobally();
    }
  });

  browser.runtime.onInstalled.addListener(async (details) => {
    log.info('background', `Install event: reason=${details.reason}`);
    applyAppearanceGlobally();
  });

  browser.runtime.onMessage.addListener((message: NotchMessage, _sender, sendResponse) => {
    log.info('background', `↓ Message received: type=${message.type}`);
    switch (message.type) {
      case 'CAPTURE_PAGE':
        handleCapturePage(message.payload, sendResponse);
        return true;
      case 'RAG_QUERY':
        handleRagQuery(message.payload, sendResponse);
        return true;
      case 'IMPORT_PDF':
        handleImportPdf(message.payload, sendResponse);
        return true;
      case 'DOM_PAYLOAD':
        return;
    }
  });
});

// ── Chunk creation for RAG ───────────────────────────────────────────────────

function createChunksFromContent(documentId: string, content: string): DocumentChunk[] {
  // Split content by paragraphs (double newlines) and assign paragraph indices
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  const chunks: DocumentChunk[] = [];

  // Group paragraphs into chunks of ~3-4 paragraphs each (roughly 500-800 chars)
  const CHUNK_SIZE = 4;
  let currentChunk: string[] = [];
  let paragraphIndex = 0;

  for (const para of paragraphs) {
    currentChunk.push(para);

    if (currentChunk.length >= CHUNK_SIZE || para.length > 600) {
      chunks.push({
        id: crypto.randomUUID(),
        documentId,
        chunkIndex: chunks.length,
        text: currentChunk.join('\n\n'),
        paragraphIndex,
      });
      paragraphIndex += currentChunk.length;
      currentChunk = [];
    }
  }

  // Don't forget the last chunk if any
  if (currentChunk.length > 0) {
    chunks.push({
      id: crypto.randomUUID(),
      documentId,
      chunkIndex: chunks.length,
      text: currentChunk.join('\n\n'),
      paragraphIndex,
    });
  }

  return chunks;
}

async function handleCapturePage(
  payload: { tabId: number; mode: GenerationMode; tags: string[] },
  sendResponse: (response: NotchMessage) => void,
) {
  const { tabId, mode, tags } = payload;
  log.info('background', `▶ Capture started — tab:${tabId} mode:${mode} tags:[${tags.join(',')}]`);
  try {
    log.info('background', `  [1/8] Extracting DOM from tab ${tabId}...`);
    const domPayload = await extractDomFromTab(tabId);
    log.success('background', `  [1/8] DOM extracted — ${domPayload.wordCount} words, ${domPayload.images.length} images, domain: ${domPayload.domain}`);

    log.info('background', '  [2/8] Loading settings...');
    const settings = await getSettings();
    const useOfflineCapture = settings.provider === 'offline' || mode === 'LOCAL';
    let captureProvider: Document['provider'] = useOfflineCapture ? 'offline' : (settings.provider ?? 'anthropic');
    let rawResponse: string;

    if (useOfflineCapture) {
      rawResponse = buildOfflineCaptureMarkdown(domPayload.title, domPayload.textContent);
    } else {
      try {
        rawResponse = await sendCaptureRequest(domPayload.textContent, domPayload.images, mode, settings);
      } catch (err) {
        if (!isQuotaExhaustedError(err)) throw err;

        log.warn('background', 'Quota exceeded during capture. Falling back to offline markdown for this page.', err);
        captureProvider = 'offline';
        rawResponse = buildOfflineCaptureMarkdown(domPayload.title, domPayload.textContent);
      }
    }
    log.success('background', `Capture response received (${rawResponse.length} chars)`);

    const sanitizedResponse = sanitizeAiResponse(rawResponse);
    const aiMarkdown = sanitizedResponse
      .replace(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/m, '$1')
      .trim();

    log.info('background', '  [4/8] Parsing AI response (title, summary, key points, entities, timeline, concepts)...');
    const titleMatch = aiMarkdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : domPayload.title;
    const summaryMatch = aiMarkdown.match(/^##\s+(?:SUMMARY|Summary)\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    const keyPoints: string[] = [];
    const keyPointsMatch = aiMarkdown.match(/^##\s+Key Points\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    if (keyPointsMatch) {
      let skipped = 0;
      for (const line of keyPointsMatch[1].split('\n')) {
        const m = line.match(/^\s*[*-]\s+(.*)/);
        if (m && m[1].trim()) keyPoints.push(m[1].trim());
        else if (line.trim()) skipped++;
      }
      if (skipped > 0) log.warn('background', `${skipped} Key Point lines could not be parsed`);
    }

    const keyEntities: Document['keyEntities'] = [];
    const entitiesMatch = aiMarkdown.match(/^##\s+Key Entities\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    if (entitiesMatch) {
      let skipped = 0;
      entitiesMatch[1].split('\n').forEach((line, i) => {
        const m = line.match(/^\s*[*-]\s+\*\*([^*:]+):?\*\*:?\s+\(([^)]+)\)\s+(.*)/);
        if (m && m[1].trim() && m[2].trim() && m[3].trim()) {
          keyEntities.push({ name: m[1].trim(), type: m[2].trim(), paragraphIndex: i });
        } else {
          skipped++;
        }
      });
      if (skipped > 0) log.warn('background', `${skipped} Key Entity lines could not be parsed`);
    }

    const timeline: Document['timeline'] = [];
    const timelineMatch = aiMarkdown.match(/^##\s+Timeline\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    if (timelineMatch) {
      let skipped = 0;
      timelineMatch[1].split('\n').forEach((line, i) => {
        const m = line.match(/^\s*[*-]\s+\*\*([^*]+)\*\*:?\s+(.*)/);
        if (m && m[1].trim() && m[2].trim()) {
          timeline.push({ date: m[1].trim(), description: m[2].trim(), paragraphIndex: i });
        } else {
          skipped++;
        }
      });
      if (skipped > 0) log.warn('background', `${skipped} Timeline lines could not be parsed`);
    }

    const concepts: Document['concepts'] = [];
    const conceptsMatch = aiMarkdown.match(/^##\s+Concepts\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    if (conceptsMatch) {
      let skipped = 0;
      conceptsMatch[1].split('\n').forEach((line, i) => {
        const m = line.match(/^\s*[*-]\s+\*\*([^*:]+):?\*\*:?\s+(.*)/);
        if (m && m[1].trim() && m[2].trim()) {
          concepts.push({ term: m[1].trim(), definition: m[2].trim(), paragraphIndex: i });
        } else {
          skipped++;
        }
      });
      if (skipped > 0) log.warn('background', `${skipped} Concept lines could not be parsed`);
    }

    log.info('background', `  [4/8] Parsed — title: "${title}", key points: ${keyPoints.length}, entities: ${keyEntities.length}, timeline: ${timeline.length}, concepts: ${concepts.length}`);

    log.info('background', '  [5/8] Building document object...');
    const doc: Document = {
      id: crypto.randomUUID(),
      title,
      url: domPayload.url,
      domain: domPayload.domain,
      capturedAt: new Date().toISOString(),
      wordCount: domPayload.wordCount,
      mode,
      provider: captureProvider,
      content: aiMarkdown,
      summary,
      keyPoints,
      keyEntities,
      timeline,
      concepts,
      tags,
      images: domPayload.images.map(img => ({
        url: img.url,
        alt: img.alt,
        sectionIndex: 0,
        paragraphContext: img.paragraphContext,
      })),
      isStarred: false,
      isArchived: false,
      isRead: false,
      embeddingsGenerated: false,
      missingImageQueries: [],
    };

    log.info('background', `  [6/8] Persisting document id=${doc.id} to storage...`);
    await saveDocument(doc);
    const index = await getDocIndex();
    await saveDocIndex([doc.id, ...index]);
    log.success('background', `  [6/8] Document saved — id: ${doc.id}, title: "${title}", words: ${domPayload.wordCount}`);

    // Create and save document chunks for RAG
    log.info('background', '  [6.5/8] Creating document chunks for RAG...');
    const chunks = createChunksFromContent(doc.id, aiMarkdown);
    for (const chunk of chunks) {
      await saveChunk(chunk);
    }
    log.success('background', `  [6.5/8] Created ${chunks.length} chunks`);

    log.info('background', '  [7/8] Checking storage quota...');
    await checkStorageQuota();

    log.success('background', `  [8/8] Capture complete — sending CAPTURE_COMPLETE to popup`);
    sendResponse({ type: 'CAPTURE_COMPLETE', payload: { documentId: doc.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('background', `Capture failed: ${message}`, err);
    sendResponse({ type: 'CAPTURE_ERROR', payload: { error: message } });
  }
}

async function handleImportPdf(
  payload: { fileName: string; bytes: number[]; tags: string[] },
  sendResponse: (response: NotchMessage) => void,
) {
  const { fileName, bytes, tags } = payload;
  log.info('background', `PDF import started — ${fileName}`);

  try {
    const parsed = await parsePdfBytes(bytes, fileName);
    const markdown = buildOfflineCaptureMarkdown(parsed.title, parsed.content);
    const doc: Document = {
      id: crypto.randomUUID(),
      title: parsed.title,
      url: `file://${fileName}`,
      domain: 'local-pdf',
      capturedAt: new Date().toISOString(),
      wordCount: parsed.wordCount,
      mode: 'LOCAL',
      provider: 'offline',
      content: markdown,
      summary: '',
      keyEntities: [],
      timeline: [],
      concepts: [],
      tags,
      images: [],
      isStarred: false,
      isArchived: false,
      isRead: false,
      embeddingsGenerated: false,
      missingImageQueries: [],
    };

    await saveDocument(doc);
    const index = await getDocIndex();
    await saveDocIndex([doc.id, ...index]);
    await checkStorageQuota();

    sendResponse({ type: 'CAPTURE_COMPLETE', payload: { documentId: doc.id } });
    log.success('background', `PDF import completed — ${doc.id}`);
  } catch (err) {
    log.error('background', 'PDF import failed', err);
    sendResponse({ type: 'CAPTURE_ERROR', payload: { error: (err as Error).message } });
  }
}

async function handleRagQuery(
  payload: { documentId: string; query: string },
  sendResponse: (response: NotchMessage) => void,
) {
  const { documentId, query } = payload;
  const sanitizedQuery = sanitizeUserInput(query);
  const t0 = Date.now();
  log.info('background', `▶ RAG query — doc: ${documentId}, query: "${sanitizedQuery.slice(0, 80)}${sanitizedQuery.length > 80 ? '…' : ''}"`);
  try {
    await persistChatMessage(documentId, 'user', sanitizedQuery);

    const settings = await getSettings();
    const useOffline = settings.provider === 'offline';

    const storedChunks = await getChunksByDocument(documentId);
    const chunks = storedChunks.length > 0
      ? storedChunks.map((chunk) => ({
          text: chunk.text,
          paragraphIndex: chunk.paragraphIndex,
          source: chunk.source ?? 'document' as const,
        }))
      : [];

    const offlineRankedChunks = rankChunksByKeywords(sanitizedQuery, chunks, 6);
    // Use offline mode when: offline provider OR no chunks available from document
    const chunksForAnswer = useOffline || chunks.length === 0 ? offlineRankedChunks : chunks.slice(0, 6);

    let answer: string;
    if (useOffline) {
      answer = answerWithOfflineNLP(sanitizedQuery, chunksForAnswer);
    } else {
      try {
        answer = await sendRAGRequest(sanitizedQuery, chunksForAnswer, settings);
      } catch (err) {
        if (!isQuotaExhaustedError(err)) throw err;

        log.warn('background', 'Quota exceeded during RAG. Falling back to offline NLP answer.', err);
        chunksForAnswer.length = 0;
        chunksForAnswer.push(...offlineRankedChunks);
        answer = answerWithOfflineNLP(sanitizedQuery, chunksForAnswer);
      }
    }

    answer = sanitizeAiResponse(answer);
    const citations = parseCitations(answer, chunksForAnswer);

    await persistChatMessage(documentId, 'notch', answer, citations);

    const elapsed = Date.now() - t0;
    log.success('background', `RAG answered with ${citations.length} citations in ${elapsed}ms`);
    sendResponse({ type: 'RAG_RESPONSE', payload: { answer, citations } });
  } catch (err) {
    log.error('background', 'RAG query failed', err);
    await persistChatMessage(documentId, 'notch', '', undefined, true);
    sendResponse({ type: 'RAG_ERROR', payload: { error: (err as Error).message } });
  }
}

function parseCitations(
  answer: string,
  chunks: Array<{ paragraphIndex: number; source?: 'document' | 'history' }>,
): Citation[] {
  const matches = [...answer.matchAll(/\[(\d+)\]/g)];
  const seen = new Set<number>();
  const citations: Citation[] = [];
  for (const match of matches) {
    const n = parseInt(match[1], 10);
    const chunk = chunks[n - 1];
    if (!seen.has(n) && n >= 1 && n <= chunks.length && chunk && chunk.source !== 'history' && chunk.paragraphIndex >= 0) {
      seen.add(n);
      citations.push({ chunkIndex: n - 1, paragraphIndex: chunk.paragraphIndex });
    }
  }
  return citations;
}

async function persistChatMessage(
  documentId: string,
  role: 'user' | 'notch',
  text: string,
  citations?: Citation[],
  isError?: boolean,
): Promise<void> {
  await saveChatMessage({
    id: crypto.randomUUID(),
    documentId,
    role,
    text,
    citations,
    isError,
    createdAt: new Date().toISOString(),
  });
}