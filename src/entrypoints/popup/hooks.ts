import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, getAllProviders, getAllNotes } from '@/lib/storage';
import { privacyLabel, shouldRunOffline } from '@/lib/privacy';
import type { DOMExtraction, GenerationMode } from '@/lib/types';

// ── Active-tab page context ──────────────────────────────────────────────────

export interface PageContext {
  loading: boolean;
  tabId?: number;
  url?: string;
  title: string;
  domain: string;
  favicon?: string;
  wordCount: number | null;
  headingCount: number | null;
  imageCount: number | null;
}

export function usePageContext(): PageContext {
  const [ctx, setCtx] = useState<PageContext>({
    loading: true,
    title: '',
    domain: '',
    wordCount: null,
    headingCount: null,
    imageCount: null,
  });

  useEffect(() => {
    void (async () => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      let domain: string;
      try {
        domain = new URL(tab?.url ?? '').hostname.replace(/^www\./, '');
      } catch {
        domain = tab?.url ?? '';
      }

      const base: PageContext = {
        loading: false,
        tabId: tab?.id,
        url: tab?.url,
        title: tab?.title ?? '',
        domain,
        favicon: tab?.favIconUrl,
        wordCount: null,
        headingCount: null,
        imageCount: null,
      };
      setCtx(base);

      // Ask the content script for a richer read of the page. Best-effort: the
      // script may not be injected yet (e.g. on chrome:// pages).
      if (tab?.id) {
        try {
          const resp: DOMExtraction | { error: string } | undefined =
            await browser.tabs.sendMessage(tab.id, { type: 'EXTRACT_DOM' });
          if (resp && !('error' in resp)) {
            setCtx((prev) => ({
              ...prev,
              wordCount: resp.wordCount > 0 ? resp.wordCount : prev.wordCount,
              headingCount: resp.headingCount ?? prev.headingCount,
              imageCount: resp.images?.length ?? prev.imageCount,
            }));
          }
        } catch {
          /* content script not ready — the base context is enough */
        }
      }
    })();
  }, []);

  return ctx;
}

// ── AI connection status ─────────────────────────────────────────────────────

export interface Connection {
  providerLabel: string;
  hasKey: boolean;
  privacy: string;
  isOffline: boolean;
}

export function useConnection(): Connection {
  const [conn, setConn] = useState<Connection>({
    providerLabel: 'Anthropic',
    hasKey: false,
    privacy: '',
    isOffline: false,
  });

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      const isOffline = shouldRunOffline(s);
      const chatProviderId = s.runtime.chat.providerId;

      if (chatProviderId) {
        const providers = await getAllProviders();
        const p = providers.find((prov) => prov.id === chatProviderId);
        if (p) {
          setConn({
            providerLabel: p.label,
            hasKey: Boolean(p.apiKey),
            privacy: privacyLabel(s, p.label),
            isOffline,
          });
          return;
        }
      }
      if (s.apiKey) {
        const label =
          s.provider === 'anthropic'
            ? 'Anthropic'
            : s.provider === 'openai-compatible'
              ? 'OpenRouter / Custom'
              : 'Offline';
        setConn({ providerLabel: label, hasKey: true, privacy: privacyLabel(s, label), isOffline });
      } else {
        setConn({
          providerLabel: 'No provider',
          hasKey: false,
          privacy: privacyLabel(s),
          isOffline,
        });
      }
    })();
  }, []);

  return conn;
}

// ── Recent tags (for autocomplete) ───────────────────────────────────────────

export function useRecentTags(): string[] {
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    void (async () => {
      try {
        const [settings, notes] = await Promise.all([getSettings(), getAllNotes()]);
        const counts = new Map<string, number>();
        for (const t of settings.defaults?.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 2);
        for (const note of notes) {
          for (const t of note.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
        }
        const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
        setTags(ranked.slice(0, 12));
      } catch {
        /* no history yet */
      }
    })();
  }, []);
  return tags;
}

// ── Capture flow ─────────────────────────────────────────────────────────────

export type CaptureState = 'idle' | 'loading' | 'success' | 'error';
export type PaywallState = 'none' | 'detected' | 'dismissed';

export interface CaptureController {
  state: CaptureState;
  documentId?: string;
  errorMsg?: string;
  progress: { step: string; pct: number };
  paywall: PaywallState;
  dismissPaywall: () => void;
  start: (opts: {
    mode: GenerationMode;
    tags: string[];
    captureMode: 'page' | 'selection';
  }) => Promise<void>;
  reset: () => void;
}

export function useCapture(tabId?: number, url?: string): CaptureController {
  const [state, setState] = useState<CaptureState>('idle');
  const [documentId, setDocumentId] = useState<string>();
  const [errorMsg, setErrorMsg] = useState<string>();
  const [progress, setProgress] = useState<{ step: string; pct: number }>({ step: '', pct: 0 });
  const [paywall, setPaywall] = useState<PaywallState>('none');
  const listenerRef = useRef<((msg: unknown) => void) | null>(null);

  // Listen for paywall detection broadcast from the background.
  useEffect(() => {
    const listener = (msg: unknown) => {
      if (
        msg &&
        typeof msg === 'object' &&
        (msg as { type?: string }).type === 'PAYWALL_DETECTED'
      ) {
        setPaywall((p) => (p === 'dismissed' ? p : 'detected'));
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setDocumentId(undefined);
    setErrorMsg(undefined);
    setProgress({ step: '', pct: 0 });
    setPaywall('none');
  }, []);

  const start = useCallback<CaptureController['start']>(
    async ({ mode, tags, captureMode }) => {
      if (!tabId) {
        setErrorMsg('Could not read the active tab');
        setState('error');
        return;
      }
      setState('loading');
      setErrorMsg(undefined);
      setPaywall('none');
      setProgress({ step: 'Reading the page', pct: 2 });

      const progressListener = (msg: unknown) => {
        if (
          msg &&
          typeof msg === 'object' &&
          (msg as { type?: string }).type === 'CAPTURE_PROGRESS'
        ) {
          const { payload } = msg as { payload: { step: string; pct?: number } };
          setProgress((prev) => ({ step: payload.step, pct: payload.pct ?? prev.pct }));
        }
      };
      listenerRef.current = progressListener;
      browser.runtime.onMessage.addListener(progressListener);

      try {
        let selectionText: string | undefined;
        if (captureMode === 'selection') {
          try {
            const sel: { selectionText?: string } | undefined = await browser.tabs.sendMessage(
              tabId,
              { type: 'CAPTURE_SELECTION' },
            );
            selectionText = sel?.selectionText?.trim();
          } catch {
            /* content script not ready */
          }
          if (!selectionText) {
            setErrorMsg('Select some text on the page first, then try again');
            setState('error');
            return;
          }
        }

        const messageType = selectionText ? 'CAPTURE_SELECTION' : 'CAPTURE_PAGE';
        const response: { type: string; payload?: { documentId?: string; error?: string } } =
          await browser.runtime.sendMessage({
            type: messageType,
            payload: { mode, tags, tabId, url, ...(selectionText ? { selectionText } : {}) },
          });

        if (response.type === 'CAPTURE_COMPLETE' && response.payload?.documentId) {
          setProgress({ step: 'Completed', pct: 100 });
          setDocumentId(response.payload.documentId);
          setState('success');
        } else if (response.type === 'CAPTURE_ERROR') {
          setErrorMsg(response.payload?.error ?? 'Something went wrong');
          setState('error');
        }
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : String(e));
        setState('error');
      } finally {
        if (listenerRef.current) {
          browser.runtime.onMessage.removeListener(listenerRef.current);
          listenerRef.current = null;
        }
      }
    },
    [tabId, url],
  );

  return {
    state,
    documentId,
    errorMsg,
    progress,
    paywall,
    dismissPaywall: () => setPaywall('dismissed'),
    start,
    reset,
  };
}
