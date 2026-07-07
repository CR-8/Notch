import { useCallback, useRef } from 'react';
import { browser } from 'wxt/browser';
import type { Citation } from '@/lib/types';

/**
 * Real AI actions for the reader's selection toolbar and Ask-AI flow.
 *
 * Everything here routes through the SAME background messaging the ChatPanel
 * uses (`RAG_QUERY` / `TRANSLATE`) — there is no synthetic/echo fallback. When
 * no provider is configured the background answers `RAG_ERROR`, which we surface
 * verbatim so the user knows to configure a key in Settings rather than being
 * shown fabricated text.
 */

export type AiAction = 'explain' | 'summarize' | 'simplify' | 'expand' | 'rewrite' | 'key-points';

const PROMPTS: Record<AiAction, (excerpt: string) => string> = {
  explain: (t) =>
    `Explain the following excerpt from the current document clearly and concisely, assuming the reader is smart but unfamiliar with the specifics:\n\n"""${t}"""`,
  summarize: (t) =>
    `Summarize the following excerpt from the current document in 2–3 tight sentences:\n\n"""${t}"""`,
  simplify: (t) =>
    `Rewrite the following excerpt in plain, simple language a newcomer could follow, preserving all meaning:\n\n"""${t}"""`,
  expand: (t) =>
    `Expand on the following excerpt with additional detail, context, and a concrete example grounded in this document:\n\n"""${t}"""`,
  rewrite: (t) =>
    `Rewrite the following excerpt to improve clarity, flow, and precision without changing its meaning:\n\n"""${t}"""`,
  'key-points': (t) =>
    `Extract the key points from the following excerpt as a short bullet list:\n\n"""${t}"""`,
};

export interface AiRunResult {
  answer: string;
  citations?: Citation[];
}

type ChunkListener = (msg: { type: string; payload?: { chunk?: string } }) => void;

export function useReaderAI(documentId: string) {
  const activeListener = useRef<ChunkListener | null>(null);

  const query = useCallback(
    (prompt: string, onStream?: (partial: string) => void): Promise<AiRunResult> => {
      // Detach any previous stream listener before starting a new run.
      if (activeListener.current) {
        browser.runtime.onMessage.removeListener(activeListener.current);
        activeListener.current = null;
      }

      const listener: ChunkListener = (msg) => {
        if (msg.type === 'RAG_CHUNK' && msg.payload?.chunk) {
          onStream?.(msg.payload.chunk);
        }
      };
      activeListener.current = listener;
      browser.runtime.onMessage.addListener(listener);

      const cleanup = () => {
        if (activeListener.current === listener) {
          browser.runtime.onMessage.removeListener(listener);
          activeListener.current = null;
        }
      };

      return browser.runtime
        .sendMessage({ type: 'RAG_QUERY', payload: { documentId, query: prompt } })
        .then(
          (res: {
            type: string;
            payload?: { answer?: string; citations?: Citation[]; error?: string };
          }) => {
            cleanup();
            if (res?.type === 'RAG_ERROR') {
              throw new Error(
                res.payload?.error || 'AI request failed. Check your provider in Settings.',
              );
            }
            return {
              answer: res?.payload?.answer ?? '',
              citations: res?.payload?.citations,
            };
          },
        )
        .catch((err: unknown) => {
          cleanup();
          throw err instanceof Error ? err : new Error('AI request failed.');
        });
    },
    [documentId],
  );

  const runAction = useCallback(
    (action: AiAction, excerpt: string, onStream?: (partial: string) => void) =>
      query(PROMPTS[action](excerpt), onStream),
    [query],
  );

  const ask = useCallback(
    (excerpt: string, question: string, onStream?: (partial: string) => void) =>
      query(
        `Regarding this excerpt from the current document:\n\n"""${excerpt}"""\n\nAnswer this question: ${question}`,
        onStream,
      ),
    [query],
  );

  const translate = useCallback((text: string, targetLanguage: string): Promise<string> => {
    return browser.runtime
      .sendMessage({ type: 'TRANSLATE', payload: { text, targetLanguage } })
      .then((res: { type: string; payload?: { translated?: string; error?: string } }) => {
        if (res?.type === 'TRANSLATE_RESULT') return res.payload?.translated ?? '';
        throw new Error(res?.payload?.error || 'Translation failed.');
      });
  }, []);

  const abort = useCallback(() => {
    browser.runtime.sendMessage({ type: 'ABORT_RAG' }).catch(() => {});
    if (activeListener.current) {
      browser.runtime.onMessage.removeListener(activeListener.current);
      activeListener.current = null;
    }
  }, []);

  return { runAction, ask, translate, abort };
}
