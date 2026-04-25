import { sendCaptureRequest, sendRAGRequest } from '../lib/ai-client';
import { chunkText, embedDocument, embedHistoryTurn, embedQuery } from '../lib/embedding-engine';
import { getChunksByDocument, saveChatMessage } from '../lib/idb';
import { buildOfflineCaptureMarkdown, answerWithOfflineNLP, rankChunksByKeywords } from '../lib/nlp-fallback';
import { parsePdfBytes } from '../lib/pdf-parser';
import { retrieveTopK } from '../lib/retrieval';
import { checkStorageQuota, getDocIndex, getDocument, getSettings, saveDocIndex, saveDocument } from '../lib/storage';
import { log } from '../lib/logger';
import type { Citation, DOMExtraction, Document, GenerationMode, NotchMessage } from '../lib/types';

export default defineBackground(() => {
  log.info('background', '=== Service worker started ===', { extensionId: browser.runtime.id });

  browser.runtime.onInstalled.addListener(async (details) => {
    log.info('background', `Install event: reason=${details.reason}`);
    if (details.reason === 'install') {
      const settings = await getSettings();
      if (settings.provider === 'gemini' && !settings.apiKeys.gemini) {
        log.info('background', 'No API key on install — opening Settings');
        browser.tabs.create({ url: browser.runtime.getURL('/options.html' as any) });
      }
    }
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

async function handleCapturePage(
  payload: { tabId: number; mode: GenerationMode; tags: string[] },
  sendResponse: (response: NotchMessage) => void,
) {
  const { tabId, mode, tags } = payload;
  log.info('background', `▶ Capture started — tab:${tabId} mode:${mode} tags:[${tags.join(',')}]`);
  try {
    // 1. Extract DOM
    log.info('background', `  [1/8] Extracting DOM from tab ${tabId}...`);
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

    const domPayload = extraction;
    log.success('background', `  [1/8] DOM extracted — ${domPayload.wordCount} words, ${domPayload.images.length} images, domain: ${domPayload.domain}`);

    // 2. Load settings
    log.info('background', '  [2/8] Loading settings...');
    const settings = await getSettings();
    const useOfflineCapture = settings.provider === 'offline' || mode === 'LOCAL';
    const rawResponse = useOfflineCapture
      ? buildOfflineCaptureMarkdown(domPayload.title, domPayload.textContent)
      : await sendCaptureRequest(domPayload.textContent, domPayload.images, mode, settings);
    log.success('background', `Capture response received (${rawResponse.length} chars)`);

    // Strip wrapping ```markdown ... ``` fence that some models add around the entire output
    const aiMarkdown = rawResponse
      .replace(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/m, '$1')
      .trim();

    // [4/8] Parse title + summary + structured fields from AI markdown
    log.info('background', '  [4/8] Parsing AI response (title, summary, entities, timeline, concepts)...');
    const titleMatch = aiMarkdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : domPayload.title;
    const summaryMatch = aiMarkdown.match(/^##\s+(?:SUMMARY|Summary)\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    // Parse key entities from "## Key Entities" section
    // Expects lines like: * **Name:** (Type) Description  or  * **Name** (Type) Description
    const keyEntities: Document['keyEntities'] = [];
    const entitiesMatch = aiMarkdown.match(/^##\s+Key Entities\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    if (entitiesMatch) {
      const lines = entitiesMatch[1].split('\n');
      lines.forEach((line, i) => {
        // Match: * **Name (optional colon):** (Type) Description
        const m = line.match(/^\s*[*-]\s+\*\*([^*:]+):?\*\*:?\s+\(([^)]+)\)\s+(.*)/);
        if (m) keyEntities.push({ name: m[1].trim(), type: m[2].trim(), paragraphIndex: i });
      });
    }

    // Parse timeline from "## Timeline" section
    // Expects lines like: * **Date:** Description
    const timeline: Document['timeline'] = [];
    const timelineMatch = aiMarkdown.match(/^##\s+Timeline\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    if (timelineMatch) {
      const lines = timelineMatch[1].split('\n');
      lines.forEach((line, i) => {
        const m = line.match(/^\s*[*-]\s+\*\*([^*]+)\*\*:?\s+(.*)/);
        if (m) timeline.push({ date: m[1].trim(), description: m[2].trim(), paragraphIndex: i });
      });
    }

    // Parse concepts from "## Concepts" section
    // Expects lines like: * **Term:** Definition
    const concepts: Document['concepts'] = [];
    const conceptsMatch = aiMarkdown.match(/^##\s+Concepts\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    if (conceptsMatch) {
      const lines = conceptsMatch[1].split('\n');
      lines.forEach((line, i) => {
        const m = line.match(/^\s*[*-]\s+\*\*([^*:]+):?\*\*:?\s+(.*)/);
        if (m) concepts.push({ term: m[1].trim(), definition: m[2].trim(), paragraphIndex: i });
      });
    }

    log.info('background', `  [4/8] Parsed — title: "${title}", entities: ${keyEntities.length}, timeline: ${timeline.length}, concepts: ${concepts.length}`);

    // [5/8] Build Document object
    log.info('background', '  [5/8] Building document object...');
    const doc: Document = {
      id: crypto.randomUUID(),
      title,
      url: domPayload.url,
      domain: domPayload.domain,
      capturedAt: new Date().toISOString(),
      wordCount: domPayload.wordCount,
      mode,
      provider: useOfflineCapture ? 'offline' : (settings.provider ?? 'gemini'),
      content: aiMarkdown,
      summary,
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

    // [6/8] Persist to IndexedDB + storage.local
    log.info('background', `  [6/8] Persisting document id=${doc.id} to storage...`);
    await saveDocument(doc);
    const index = await getDocIndex();
    await saveDocIndex([doc.id, ...index]);
    log.success('background', `  [6/8] Document saved — id: ${doc.id}, title: "${title}", words: ${domPayload.wordCount}`);

    // [7/8] Quota check
    log.info('background', '  [7/8] Checking storage quota...');
    await checkStorageQuota();

    // [8/8] Reply to popup
    log.success('background', `  [8/8] Capture complete — sending CAPTURE_COMPLETE to popup`);
    sendResponse({ type: 'CAPTURE_COMPLETE', payload: { documentId: doc.id } });

    // 8. Embed after a short delay to avoid CPU spike right after capture
    setTimeout(() => {
      embedDocument(doc.id, doc.content).catch(err =>
        log.error('background', 'Background embedding failed', err)
      );
    }, 1500);
  } catch (err) {
    log.error('background', 'Capture failed', err);
    sendResponse({ type: 'CAPTURE_ERROR', payload: { error: (err as Error).message } });
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

    // Build local embeddings immediately so PDF RAG works as soon as the reader opens.
    await embedDocument(doc.id, doc.content);

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
  const t0 = Date.now();
  log.info('background', `▶ RAG query — doc: ${documentId}, query: "${query.slice(0, 80)}${query.length > 80 ? '…' : ''}"`);
  try {
    await persistChatMessage(documentId, 'user', query);

    const settings = await getSettings();
    const useOffline = settings.provider === 'offline' || (settings.provider === 'gemini' && !settings.apiKeys.gemini);

    let chunks: Array<{ text: string; paragraphIndex: number; score: number; source: 'document' | 'history' }> = [];
    let embeddingRetrievalFailed = false;

    try {
      const queryEmbedding = await embedQuery(query);
      chunks = await retrieveTopK(documentId, queryEmbedding, 8);

      if (chunks.length === 0) {
        const doc = await getDocument(documentId);
        if (doc) {
          log.info('background', `No embeddings found for ${documentId}; generating now`);
          await embedDocument(documentId, doc.content);
          chunks = await retrieveTopK(documentId, queryEmbedding, 8);
        }
      }
    } catch (err) {
      embeddingRetrievalFailed = true;
      log.warn('background', 'Embedding retrieval unavailable; using keyword-only retrieval', err);
    }

    if (chunks.length === 0) {
      const storedChunks = await getChunksByDocument(documentId);
      if (storedChunks.length > 0) {
        chunks = storedChunks.map((chunk) => ({
          text: chunk.text,
          paragraphIndex: chunk.paragraphIndex,
          score: 0,
          source: chunk.source ?? 'document',
        }));
      } else {
        const doc = await getDocument(documentId);
        if (doc) {
          chunks = chunkText(doc.content).map((text, index) => ({
            text,
            paragraphIndex: index,
            score: 0,
            source: 'document' as const,
          }));
        }
      }
    }

    const rankedForAnswer = (useOffline || embeddingRetrievalFailed)
      ? rankChunksByKeywords(query, chunks, 6)
      : chunks.slice(0, 6);
    const answer = useOffline
      ? answerWithOfflineNLP(query, rankedForAnswer)
      : await sendRAGRequest(query, rankedForAnswer, settings);

    const citations = parseCitations(answer, rankedForAnswer);

    await persistChatMessage(documentId, 'notch', answer, citations);
    void embedHistoryTurn(documentId, query, answer);

    log.success('background', `RAG answered with ${citations.length} citations`);
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
