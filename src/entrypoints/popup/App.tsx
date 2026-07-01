import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, getAllProviders, getAppearance, deleteDocument } from '../../lib/storage';
import type { GenerationMode } from '../../lib/types';
import { privacyLabel, shouldRunOffline } from '../../lib/privacy';
import { applyAppearance, watchAppearance } from '../../lib/theme';
import { openSettings } from '@/lib/navigation';
import { cn } from '@/lib/utils';

type CaptureState = 'idle' | 'loading' | 'success' | 'error';
type PaywallState = 'none' | 'detected' | 'dismissed';

const MODES: { mode: GenerationMode; label: string; description: string }[] = [
  { mode: 'FAST', label: 'Fast', description: 'Quick capture' },
  { mode: 'BALANCED', label: 'Balanced', description: 'Quality + speed' },
  { mode: 'DEEP', label: 'Deep', description: 'Best quality' },
];

function StatusBar({ providerLabel, hasKey }: { providerLabel: string; hasKey: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">
        Notch
      </span>
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'inline-block w-2 h-2 rounded-full',
            hasKey ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-destructive)]',
          )}
        />
        <span
          className={cn(
            'text-[11px] font-medium',
            hasKey ? 'text-[var(--color-primary)]' : 'text-[var(--color-destructive)]',
          )}
        >
          {hasKey ? providerLabel : 'No key'}
        </span>
      </div>
    </div>
  );
}

function PageContextZone() {
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState('');
  // PRIV-4: estimated token count
  const [wordCount, setWordCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (tab) {
        setTitle(tab.title ?? '');
        try {
          setDomain(new URL(tab.url ?? '').hostname);
        } catch {
          setDomain(tab.url ?? '');
        }
        // PRIV-4: try to get word count from content script
        if (tab.id) {
          try {
            const resp: { wordCount: number } | undefined = await browser.tabs.sendMessage(tab.id, {
              type: 'EXTRACT_DOM',
            });
            if (resp?.wordCount && resp.wordCount > 0) setWordCount(resp.wordCount);
          } catch {
            /* content script not injected yet — skip estimate */
          }
        }
      }
      setLoading(false);
    })();
  }, []);

  const tokenEstimate = wordCount ? Math.round(wordCount * 1.33) : null;
  const costEstimate = tokenEstimate ? (tokenEstimate / 1_000_000) * 0.25 : null;

  return (
    <div className="px-4 py-3 border-b border-[var(--color-hairline)]">
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-3 w-[70%] bg-[var(--color-hairline)] rounded-sm animate-pulse" />
          <div className="h-2.5 w-[45%] bg-[var(--color-hairline)] rounded-sm animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-[14px] font-medium text-[var(--color-ink)] leading-snug truncate">
            {title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[12px] text-[var(--color-ink-muted)] truncate">{domain}</p>
            {tokenEstimate && (
              <span className="text-[10px] font-medium text-[var(--color-ink-faint)] shrink-0 ml-auto">
                ~{tokenEstimate.toLocaleString()} tokens
                {costEstimate !== null && costEstimate > 0.001 && ` · ~$${costEstimate.toFixed(4)}`}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ModeSelector({
  mode,
  onModeChange,
}: {
  mode: GenerationMode;
  onModeChange: (m: GenerationMode) => void;
}) {
  return (
    <div className="flex gap-1.5 px-4 py-3 border-b border-[var(--color-hairline)]">
      {MODES.map((m) => (
        <button
          key={m.mode}
          onClick={() => onModeChange(m.mode)}
          className={cn(
            'flex-1 flex flex-col items-center rounded-md py-1.5 px-2 text-[11px] transition-all',
            m.mode === mode
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] border border-[var(--color-hairline)] hover:border-[var(--color-primary)]',
          )}
        >
          <span className="font-semibold">{m.label}</span>
          <span className="text-[9px] opacity-70 mt-0.5">{m.description}</span>
        </button>
      ))}
    </div>
  );
}

function TagInput({ tags, onTagsChange }: { tags: string[]; onTagsChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const trimmed = input.trim();
    if (!trimmed || tags.includes(trimmed)) {
      setInput('');
      return;
    }
    onTagsChange([...tags, trimmed]);
    setInput('');
  }

  return (
    <div className="px-4 py-2.5 border-b border-[var(--color-hairline)]">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a tag..."
        className="notion-input text-[13px]"
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 rounded-full px-2 py-0.5"
            >
              {tag}
              <button
                onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
                className="text-[var(--color-primary)] hover:text-[var(--color-primary-active)] leading-none"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PopupApp() {
  const [mode, setMode] = useState<GenerationMode>('FAST');
  const [tags, setTags] = useState<string[]>([]);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [documentId, setDocumentId] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [captureProgress, setCaptureProgress] = useState<string>('');
  const [providerLabel, setProviderLabel] = useState('Anthropic');
  const [hasKey, setHasKey] = useState(false);
  const [privacy, setPrivacy] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [paywallState, setPaywallState] = useState<PaywallState>('none');
  // PRIV-2: preview panel state
  const [showPrivacyPreview, setShowPrivacyPreview] = useState(false);
  const [pageTitle, setPageTitle] = useState('');
  const [pageUrl, setPageUrl] = useState('');

  useEffect(() => {
    void (async () => {
      const s = await getSettings();
      const offline = shouldRunOffline(s);
      setIsOffline(offline);
      const chatProviderId = s.runtime.chat.providerId;
      if (chatProviderId) {
        const providers = await getAllProviders();
        const p = providers.find((prov) => prov.id === chatProviderId);
        if (p) {
          setProviderLabel(p.label);
          setHasKey(Boolean(p.apiKey));
          setPrivacy(privacyLabel(s, p.label));
        }
      } else if (s.apiKey) {
        const label =
          s.provider === 'anthropic'
            ? 'Anthropic'
            : s.provider === 'openai-compatible'
              ? 'OpenRouter / Custom'
              : 'Offline';
        setProviderLabel(label);
        setHasKey(true);
        setPrivacy(privacyLabel(s, label));
      } else {
        setPrivacy(privacyLabel(s));
      }
    })();
    // PRIV-2: get page info for the preview
    void browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab) {
        setPageTitle(tab.title ?? '');
        setPageUrl(tab.url ?? '');
      }
    });
    void getAppearance().then(applyAppearance);
    return watchAppearance(applyAppearance);
  }, []);

  // Listen for paywall detection from background
  useEffect(() => {
    const listener = (msg: unknown) => {
      if (
        msg &&
        typeof msg === 'object' &&
        (msg as { type?: string }).type === 'PAYWALL_DETECTED'
      ) {
        setPaywallState('detected');
      }
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);

  async function handleCaptureClick(captureMode: 'page' | 'selection' = 'page') {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) {
        setCaptureState('error');
        setErrorMsg('Could not get active tab');
        return;
      }
      setCaptureState('loading');
      setCaptureProgress('Starting capture...');
      setErrorMsg(undefined);
      setPaywallState('none');

      const progressListener = (msg: unknown) => {
        if (
          msg &&
          typeof msg === 'object' &&
          (msg as { type?: string }).type === 'CAPTURE_PROGRESS'
        ) {
          const m = msg as { payload: { step: string } };
          setCaptureProgress(m.payload.step);
        }
      };
      browser.runtime.onMessage.addListener(progressListener);

      // CAP-3: for selection mode, first ask the content script for the current selection.
      let selectionText: string | undefined;
      if (captureMode === 'selection') {
        try {
          const sel: { selectionText?: string } | undefined = await browser.tabs.sendMessage(
            tab.id,
            { type: 'CAPTURE_SELECTION' },
          );
          selectionText = sel?.selectionText?.trim();
        } catch {
          /* content script not ready — fallback to full page */
        }
      }

      const messageType = selectionText ? 'CAPTURE_SELECTION' : 'CAPTURE_PAGE';
      const response: { type: string; payload?: { documentId?: string; error?: string } } =
        await browser.runtime.sendMessage({
          type: messageType,
          payload: {
            mode,
            tags,
            tabId: tab.id,
            url: tab.url,
            ...(selectionText ? { selectionText } : {}),
          },
        });

      browser.runtime.onMessage.removeListener(progressListener);

      if (response.type === 'CAPTURE_COMPLETE' && response.payload?.documentId) {
        setDocumentId(response.payload.documentId);
        setCaptureState('success');
        setCaptureProgress('');
      } else if (response.type === 'CAPTURE_ERROR') {
        setErrorMsg(response.payload?.error ?? 'Unknown error');
        setCaptureState('error');
        setCaptureProgress('');
      }
    } catch (e) {
      setErrorMsg((e as Error).message ?? 'Unknown error');
      setCaptureState('error');
      setCaptureProgress('');
    }
  }

  function handleOpenReader() {
    if (documentId) {
      void browser.tabs.create({
        url: browser.runtime.getURL(`/reader.html?documentId=${documentId}`),
      });
    }
  }

  function handleOpenSettings() {
    void openSettings();
  }

  return (
    <div className="w-[320px] bg-[var(--color-canvas-soft)] text-[var(--color-ink)] flex flex-col overflow-hidden">
      <StatusBar providerLabel={providerLabel} hasKey={hasKey} />
      {privacy && (
        <div className="flex items-center gap-1.5 px-4 pb-2">
          <span
            className={cn(
              'inline-block w-1.5 h-1.5 rounded-full',
              isOffline ? 'bg-[var(--color-accent-green)]' : 'bg-[var(--color-ink-faint)]',
            )}
          />
          <span className="text-[11px] text-[var(--color-ink-muted)]">{privacy}</span>
        </div>
      )}

      {/* CAP-7: Paywall warning banner */}
      {paywallState === 'detected' && (
        <div className="mx-3 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
          <span className="text-[14px] leading-none shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-amber-700">Paywall detected</p>
            <p className="text-[10px] text-amber-600 leading-snug mt-0.5">
              This page may have restricted content. The capture may be incomplete.
            </p>
          </div>
          <button
            onClick={() => setPaywallState('dismissed')}
            className="text-[14px] text-amber-400 hover:text-amber-600 shrink-0 leading-none transition-colors"
          >
            &times;
          </button>
        </div>
      )}

      <PageContextZone />
      <ModeSelector mode={mode} onModeChange={setMode} />
      <TagInput tags={tags} onTagsChange={setTags} />

      <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
        {/* PRIV-2: What will be sent — collapsible preview */}
        {captureState === 'idle' && (
          <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] overflow-hidden mb-1">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-left"
              onClick={() => setShowPrivacyPreview((v) => !v)}
            >
              <span className="text-[11px] font-semibold text-[var(--color-ink-muted)]">
                🔒 What will be sent
              </span>
              <span className="text-[10px] text-[var(--color-ink-faint)]">
                {showPrivacyPreview ? 'Hide' : 'Show'}
              </span>
            </button>
            {showPrivacyPreview && (
              <div className="px-3 pb-3 border-t border-[var(--color-hairline)] space-y-2">
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-[var(--color-ink-muted)]">Provider</span>
                  <span className="text-[11px] font-semibold text-[var(--color-ink)]">
                    {providerLabel || (isOffline ? 'On-device' : 'None')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--color-ink-muted)]">Privacy</span>
                  <span
                    className={cn(
                      'text-[11px] font-semibold',
                      isOffline
                        ? 'text-[var(--color-accent-green)]'
                        : 'text-[var(--color-ink-muted)]',
                    )}
                  >
                    {isOffline
                      ? '✓ Local only — nothing sent to cloud'
                      : '↑ Text content sent to ' + providerLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[var(--color-ink-muted)]">Images</span>
                  <span className="text-[11px] font-medium text-[var(--color-ink-muted)]">
                    Not sent (text only)
                  </span>
                </div>
                {pageTitle && (
                  <div className="pt-1 border-t border-[var(--color-hairline)]">
                    <p className="text-[10px] text-[var(--color-ink-faint)] mb-0.5">Page</p>
                    <p className="text-[11px] text-[var(--color-ink)] font-medium truncate">
                      {pageTitle}
                    </p>
                    <p className="text-[10px] text-[var(--color-ink-faint)] truncate">{pageUrl}</p>
                  </div>
                )}
                <p className="text-[10px] text-[var(--color-ink-faint)] pt-1">
                  The page's readable text content will be extracted and processed{' '}
                  {isOffline ? 'locally on your device' : `by ${providerLabel}'s API`}. Your API key
                  is stored locally and never shared.
                </p>
              </div>
            )}
          </div>
        )}
        {/* PRIV-5: Free-tier training disclosure */}
        {captureState === 'idle' &&
          !isOffline &&
          providerLabel.toLowerCase().includes('openrouter') && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-1">
              <p className="text-[10px] font-medium text-amber-700 leading-snug">
                {
                  '⚠️ Free-tier notice: Some OpenRouter free models may use requests to train future models. '
                }
                <a
                  href="https://openrouter.ai/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-amber-900"
                >
                  Privacy policy
                </a>
              </p>
            </div>
          )}
        {captureState === 'success' ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={handleOpenReader}
              className="notion-btn-primary w-full text-[14px] py-2.5"
            >
              Open in Reader
            </button>
            {/* CAP-6: Undo toast — lets the user cancel a capture they triggered by mistake */}
            <button
              onClick={() => {
                if (documentId) {
                  void deleteDocument(documentId);
                }
                setCaptureState('idle');
                setDocumentId(undefined);
                setCaptureProgress('');
              }}
              className="w-full text-[12px] font-medium py-1.5 rounded-full border border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-destructive)] hover:text-[var(--color-destructive)] transition-all"
            >
              Undo capture
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              disabled={captureState === 'loading'}
              onClick={() => {
                handleCaptureClick('page').catch(() => {});
              }}
              className={cn(
                'w-full text-[14px] font-medium py-2.5 rounded-full transition-all',
                captureState === 'idle' && 'notion-btn-primary',
                captureState === 'loading' &&
                  'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] opacity-70 cursor-not-allowed',
                captureState === 'error' &&
                  'border-2 border-[var(--color-destructive)] text-[var(--color-destructive)] bg-white hover:bg-[var(--color-destructive)]/5',
              )}
            >
              {captureState === 'loading'
                ? 'Processing...'
                : captureState === 'error'
                  ? 'Retry'
                  : 'Capture this page'}
            </button>
            {/* CAP-3: Capture selection button — only shown in idle state */}
            {captureState === 'idle' && (
              <button
                onClick={() => {
                  handleCaptureClick('selection').catch(() => {});
                }}
                className="w-full text-[12px] font-medium py-1.5 rounded-full border border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
                title="Capture only the selected text on this page"
              >
                Capture selection
              </button>
            )}
          </div>
        )}

        {captureState === 'loading' && captureProgress && (
          <p className="text-[11px] text-[var(--color-primary)] animate-pulse">{captureProgress}</p>
        )}

        {captureState === 'error' && errorMsg && (
          <p className="text-[11px] text-[var(--color-destructive)]">{errorMsg.slice(0, 120)}</p>
        )}

        <button
          onClick={handleOpenSettings}
          className="w-full text-[13px] font-medium py-2 rounded-full border border-[var(--color-hairline)] bg-white text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
        >
          Settings
        </button>
      </div>
    </div>
  );
}
