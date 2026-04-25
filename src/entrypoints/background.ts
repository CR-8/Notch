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
    }
  });
});

async function handleCapturePage(
  payload: { tabId: number; mode: GenerationMode; tags: string[] },
  sendResponse: (response: NotchMessage) => void,
) {
  const { tabId, mode, tags } = payload;
  log.info('background', `Capture started — tab: ${tabId}, mode: ${mode}, tags: [${tags.join(', ')}]`);
  try {
    // 1. Extract DOM
    const extraction = await browser.tabs.sendMessage(tabId, { type: 'EXTRACT_DOM', payload: {} }) as DOMExtraction | { type: string; payload: DOMExtraction };
    const domPayload = (extraction as { type: string; payload: DOMExtraction }).type === 'DOM_PAYLOAD'
      ? (extraction as { type: string; payload: DOMExtraction }).payload
      : extraction as DOMExtraction;
    log.success('background', `DOM extracted — ${domPayload.wordCount} words from ${domPayload.domain}`);

    // 2. Get settings and call AI
    const settings = await getSettings();
    const aiMarkdown = await sendCaptureRequest(domPayload.textContent, domPayload.images, mode, settings);
    log.success('background', `AI response received (${aiMarkdown.length} chars)`);

    // 3. Provider
    const provider: import('../lib/types').LLMProvider = 'gemini';

    // 4. Parse title
    const titleMatch = aiMarkdown.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : domPayload.title;

    // 5. Parse summary
    const summaryMatch = aiMarkdown.match(/^##\s+SUMMARY\s*\n([\s\S]*?)(?=\n##\s|\s*$)/im);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    // 6. Build Document
    const doc: Document = {
      id: crypto.randomUUID(),
      title,
      url: domPayload.url,
      domain: domPayload.domain,
      capturedAt: new Date().toISOString(),
      wordCount: domPayload.wordCount,
      mode,
      provider,
      content: aiMarkdown,
      summary,
      keyEntities: [],
      timeline: [],
      concepts: [],
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

    // 7. Persist
    await saveDocument(doc);
    const index = await getDocIndex();
    await saveDocIndex([doc.id, ...index]);
    log.success('background', `Document saved — id: ${doc.id}, title: "${title}"`);

    // 8. Quota check
    await checkStorageQuota();

    // 9. Reply
    sendResponse({ type: 'CAPTURE_COMPLETE', payload: { documentId: doc.id } });

    // 10. Embed (fire and forget)
    embedDocument(doc.id, doc.content).catch(err =>
      log.error('background', 'Background embedding failed', err)
    );
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
  try {
    const queryEmbedding = await embedQuery(query);
    const chunks = await retrieveTopK(documentId, queryEmbedding, 5);
    const settings = await getSettings();
    const answer = await sendRAGRequest(query, chunks, settings);
    const citations = parseCitations(answer, chunks);
    sendResponse({ type: 'RAG_RESPONSE', payload: { answer, citations } });
  } catch (err) {
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
