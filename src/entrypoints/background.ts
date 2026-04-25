import { sendCaptureRequest, sendRAGRequest } from '../lib/ai-client';
import { embedDocument, embedQuery } from '../lib/embedding-engine';
import { retrieveTopK } from '../lib/retrieval';
import { checkStorageQuota, getDocIndex, getSettings, saveDocIndex, saveDocument } from '../lib/storage';
import { log } from '../lib/logger';
import type { Citation, DOMExtraction, Document, GenerationMode, NotchMessage } from '../lib/types';

export default defineBackground(() => {
  log.info('background', 'Service worker started', { id: browser.runtime.id });

  browser.runtime.onInstalled.addListener(async (details) => {
    log.info('background', `Extension installed — reason: ${details.reason}`);
    if (details.reason === 'install') {
      const settings = await getSettings();
      if (!settings.apiKeys.gemini) {
        log.info('background', 'No API key on install — opening Settings');
        browser.tabs.create({ url: browser.runtime.getURL('/options.html' as any) });
      }
    }
  });

  browser.runtime.onMessage.addListener((message: NotchMessage, _sender, sendResponse) => {
    log.info('background', `Message received: ${message.type}`);
    switch (message.type) {
      case 'CAPTURE_PAGE':
        handleCapturePage(message.payload, sendResponse);
        return true;
      case 'RAG_QUERY':
        handleRagQuery(message.payload, sendResponse);
        return true;
      case 'DOM_PAYLOAD':
        // Content script sends this as a fire-and-forget in older code paths — ignore silently
        return;
    }
  });
});

async function handleCapturePage(
  payload: { tabId: number; mode: GenerationMode; tags: string[] },
  sendResponse: (response: NotchMessage) => void,
) {
  const { tabId, mode, tags } = payload;
  log.info('background', `Capture started — tab: ${tabId}, mode: ${mode}`);
  try {
    // 1. Extract DOM — content script responds directly with DOMExtraction
    const extraction = await browser.tabs.sendMessage(
      tabId,
      { type: 'EXTRACT_DOM', payload: {} },
    ) as DOMExtraction | { error: string } | undefined;

    if (!extraction) {
      throw new Error('No response from content script. Make sure the page is fully loaded and try again.');
    }
    if ('error' in extraction) {
      throw new Error(`Content script error: ${extraction.error}`);
    }

    const domPayload = extraction;
    log.success('background', `DOM extracted — ${domPayload.wordCount} words from ${domPayload.domain}`);

    // 2. Call AI
    const settings = await getSettings();
    const rawResponse = await sendCaptureRequest(domPayload.textContent, domPayload.images, mode, settings);
    log.success('background', `AI response received (${rawResponse.length} chars)`);

    // Strip wrapping ```markdown ... ``` fence that some models add around the entire output
    const aiMarkdown = rawResponse
      .replace(/^```(?:markdown)?\s*\n([\s\S]*?)\n```\s*$/m, '$1')
      .trim();

    // 3. Parse title + summary + structured fields
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

    // 4. Build Document
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

    // 5. Persist — saveDocument writes full doc to IDB + meta to storage.local
    await saveDocument(doc);
    const index = await getDocIndex();
    await saveDocIndex([doc.id, ...index]);
    log.success('background', `Document saved — id: ${doc.id}, title: "${title}"`);

    // 6. Quota check
    await checkStorageQuota();

    // 7. Reply to popup immediately
    sendResponse({ type: 'CAPTURE_COMPLETE', payload: { documentId: doc.id } });

    // 8. Embed after a short delay to avoid CPU spike right after capture
    //    Only embed when a Gemini key is present (RAG is enabled)
    if (settings.apiKeys.gemini) {
      setTimeout(() => {
        embedDocument(doc.id, doc.content).catch(err =>
          log.error('background', 'Background embedding failed', err)
        );
      }, 3000);
    }
  } catch (err) {
    log.error('background', 'Capture failed', err);
    sendResponse({ type: 'CAPTURE_ERROR', payload: { error: (err as Error).message } });
  }
}

async function handleRagQuery(
  payload: { documentId: string; query: string },
  sendResponse: (response: NotchMessage) => void,
) {
  const { documentId, query } = payload;
  log.info('background', `RAG query — doc: ${documentId}`);
  try {
    const queryEmbedding = await embedQuery(query);
    const chunks = await retrieveTopK(documentId, queryEmbedding, 5);
    const settings = await getSettings();
    const answer = await sendRAGRequest(query, chunks, settings);
    const citations = parseCitations(answer, chunks);
    log.success('background', `RAG answered with ${citations.length} citations`);
    sendResponse({ type: 'RAG_RESPONSE', payload: { answer, citations } });
  } catch (err) {
    log.error('background', 'RAG query failed', err);
    sendResponse({ type: 'RAG_ERROR', payload: { error: (err as Error).message } });
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
