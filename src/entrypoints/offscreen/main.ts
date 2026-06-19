import { runCapturePipeline, runRAGPipeline } from '../../lib/pipeline';
import { log } from '../../lib/logger';
import type { RuntimeMessage, DOMExtraction } from '../../lib/types';

log.info('offscreen', 'Offscreen document ready');

browser.runtime.onMessage.addListener(async (message: RuntimeMessage) => {
  switch (message.type) {
    case 'CAPTURE_PAGE': {
      const payload = message.payload as { mode?: string; tags?: string[]; extraction?: DOMExtraction };
      // Only process if pre-extracted DOM was provided (background extracts, offscreen processes)
      if (!payload?.extraction) return;
      const mode = (payload.mode ?? 'BALANCED') as any;
      const tags = payload.tags ?? [];
      try {
        const documentId = await runCapturePipeline(payload.extraction, mode, tags);
        return { type: 'CAPTURE_COMPLETE' as const, payload: { documentId } };
      } catch (err) {
        return { type: 'CAPTURE_ERROR' as const, payload: { error: (err as Error).message } };
      }
    }
    case 'RAG_QUERY': {
      const { documentId, query, readingLevel } = message.payload as any;
      try {
        const { answer, citations } = await runRAGPipeline(query, documentId, undefined, readingLevel);
        return { type: 'RAG_RESPONSE' as const, payload: { answer, citations } };
      } catch (err) {
        return { type: 'RAG_ERROR' as const, payload: { error: (err as Error).message } };
      }
    }
    default:
      return;
  }
});
