import { runCapturePipeline, runRAGPipeline } from '../../lib/pipeline';
import { log } from '../../lib/logger';
import type { GenerationMode, RuntimeMessage, DOMExtraction } from '../../lib/types';

log.info('offscreen', 'Offscreen document ready');

async function handleOffscreenMessage(
  message: RuntimeMessage,
): Promise<RuntimeMessage | undefined> {
  switch (message.type) {
    case 'CAPTURE_PAGE': {
      const payload = message.payload as typeof message.payload & { extraction?: DOMExtraction };
      const extraction = payload?.extraction;
      if (!extraction) return undefined;
      const mode: GenerationMode = payload.mode ?? 'BALANCED';
      const tags = payload.tags ?? [];
      try {
        const documentId = await runCapturePipeline(extraction, mode, tags);
        return { type: 'CAPTURE_COMPLETE' as const, payload: { documentId } };
      } catch (err) {
        return { type: 'CAPTURE_ERROR' as const, payload: { error: (err as Error).message } };
      }
    }
    case 'RAG_QUERY': {
      const { documentId, query, readingLevel } = message.payload;
      try {
        const { answer, citations } = await runRAGPipeline(
          query,
          documentId,
          undefined,
          readingLevel,
        );
        return { type: 'RAG_RESPONSE' as const, payload: { answer, citations } };
      } catch (err) {
        return { type: 'RAG_ERROR' as const, payload: { error: (err as Error).message } };
      }
    }
    default:
      return;
  }
}

browser.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  void handleOffscreenMessage(message)
    .then(sendResponse)
    .catch(() => {});
  return true;
});
