import { runCapturePipeline, runRAGPipeline } from '../../lib/pipeline';
import { log } from '../../lib/logger';
import type { RuntimeMessage } from '../../lib/types';

log.info('offscreen', 'Offscreen document ready');

browser.runtime.onMessage.addListener(async (message: RuntimeMessage) => {
  switch (message.type) {
    case 'CAPTURE_PAGE': {
      const payload = message.payload as any;
      const { mode, tags } = payload;
      try {
        const documentId = await runCapturePipeline(payload.extraction, mode, tags);
        return { type: 'CAPTURE_COMPLETE' as const, payload: { documentId } };
      } catch (err) {
        return { type: 'CAPTURE_ERROR' as const, payload: { error: (err as Error).message } };
      }
    }
    default:
      return;
  }
});
