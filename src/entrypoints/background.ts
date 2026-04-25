import { sendCaptureRequest, sendRAGRequest } from '../lib/ai-client';
import { embedDocument, embedQuery } from '../lib/embedding-engine';
import { retrieveTopK } from '../lib/retrieval';
import { checkStorageQuota, getDocIndex, getSettings, saveDocIndex, saveDocument } from '../lib/storage';
import { log } from '../lib/logger';
import type { Citation, DOMExtraction, Document, GenerationMode, NotchMessage } from '../lib/types';

export default defineBackground(() => {
  log.info('background', '=== Service worker started ===', { extensionId: browser.runtime.id });

  browser.runtime.onInstalled.addListener(async (details) => {
    log.info('background', `Install event: reason=${details.reason}`);
    if (details.reason === 'install') {
      const settings = await getSettings();
      if (!settings.apiKeys.gemini) {
        log.warn('background', 'No API key found on install → opening Settings page');
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
    log.info('background', `  [2/8] Settings loaded — provider: gemini, key: ${settings.apiKeys.gemini ? 'present (' + settings.apiKeys.gemini.slice(0,8) + '...)' : 'MISSING'}`);
    // 3. Call AI (with segmentation support for large documents)
    log.info('background', `  [3/8] Sending to AI — content: ${domPayload.textContent.length} chars (~${domPayload.wordCount} words)...`);
    const rawResponse = await sendCaptureRequest(
      domPayload.textContent,
      domPayload.images,
      mode,
      settings,
      (current, total) => {
        if (total > 1) {
          log.info('background', `  [3/8] AI frame progress: ${current + 1}/${total}`);
        }
      },
    );
    log.success('background', `  [3/8] AI response received — ${rawResponse.length} chars`);

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
      provider: 'gemini',
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

    // Background: embed after 3s delay to avoid CPU spike
    log.info('background', `  [bg] Scheduling embedding for doc ${doc.id} in 3s...`);
    //    Embedding is local-only (ONNX WASM), no Gemini key required.
    setTimeout(() => {
      embedDocument(doc.id, doc.content)
        .then(async () => {
          const updatedDoc: Document = { ...doc, embeddingsGenerated: true };
          await saveDocument(updatedDoc);
          log.success('background', `  [bg] Embeddings ready for doc ${doc.id}`);
        })
        .catch((err) =>
          log.error('background', `  [bg] Embedding failed for doc ${doc.id}: ${(err as Error).message}`, err)
        );
    }, 3000);
  } catch (err) {
    const errMsg = (err as Error).message ?? String(err);
    log.error('background', `✗ Capture FAILED: ${errMsg}`, err);
    sendResponse({ type: 'CAPTURE_ERROR', payload: { error: errMsg } });
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
    log.info('background', '  [rag 1/4] Embedding query...');
    const queryEmbedding = await embedQuery(query);
    log.info('background', `  [rag 2/4] Query embedded (${queryEmbedding.length} dims), retrieving top-5 chunks...`);
    const chunks = await retrieveTopK(documentId, queryEmbedding, 5);
    log.info('background', `  [rag 3/4] Retrieved ${chunks.length} chunks, calling LLM...`);
    const settings = await getSettings();
    const answer = await sendRAGRequest(query, chunks, settings);
    const citations = parseCitations(answer, chunks);
    const elapsed = Date.now() - t0;
    log.success('background', `  [rag 4/4] RAG complete in ${elapsed}ms — ${citations.length} citations, answer: ${answer.length} chars`);
    sendResponse({ type: 'RAG_RESPONSE', payload: { answer, citations } });
  } catch (err) {
    const errMsg = (err as Error).message ?? String(err);
    log.error('background', `✗ RAG query FAILED: ${errMsg}`, err);
    sendResponse({ type: 'RAG_ERROR', payload: { error: errMsg } });
  }
}

function parseCitations(answer: string, chunks: Array<{ paragraphIndex: number }>): Citation[] {
  const matches = [...answer.matchAll(/\[(\d+)\]/g)];
  const seen = new Set<number>();
  const citations: Citation[] = [];
  for (const match of matches) {
    const n = parseInt(match[1], 10);
    if (!seen.has(n) && n >= 1 && n <= chunks.length) {
      seen.add(n);
      citations.push({ chunkIndex: n - 1, paragraphIndex: chunks[n - 1].paragraphIndex });
    }
  }
  return citations;
}
