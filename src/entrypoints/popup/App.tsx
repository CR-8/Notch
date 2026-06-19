import { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, getAllProviders, getAppearance } from '../../lib/storage';
import type { GenerationMode, RuntimeMessage } from '../../lib/types';
import { privacyLabel, shouldRunOffline } from '../../lib/privacy';
import { applyAppearance, watchAppearance } from '../../lib/theme';
import { cn } from '@/lib/utils';

type CaptureState = 'idle' | 'loading' | 'success' | 'error';

const MODES: { mode: GenerationMode; label: string; description: string }[] = [
  { mode: 'FAST',     label: 'Fast',     description: 'Quick capture' },
  { mode: 'BALANCED', label: 'Balanced', description: 'Quality + speed' },
  { mode: 'DEEP',     label: 'Deep',     description: 'Best quality' },
];

function StatusBar({ providerLabel, hasKey }: { providerLabel: string; hasKey: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">Notch</span>
      <div className="flex items-center gap-1.5">
        <span
          className={cn('inline-block w-2 h-2 rounded-full', hasKey ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-destructive)]')}
        />
        <span className={cn('text-[11px] font-medium', hasKey ? 'text-[var(--color-primary)]' : 'text-[var(--color-destructive)]')}>
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

  useEffect(() => {
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const tab = tabs[0];
      if (tab) {
        setTitle(tab.title ?? '');
        try { setDomain(new URL(tab.url ?? '').hostname); }
        catch { setDomain(tab.url ?? ''); }
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="px-4 py-3 border-b border-[var(--color-hairline)]">
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-3 w-[70%] bg-[var(--color-hairline)] rounded-sm animate-pulse" />
          <div className="h-2.5 w-[45%] bg-[var(--color-hairline)] rounded-sm animate-pulse" />
        </div>
      ) : (
        <>
          <p className="text-[14px] font-medium text-[var(--color-ink)] leading-snug truncate">{title}</p>
          <p className="text-[12px] text-[var(--color-ink-muted)] mt-0.5 truncate">{domain}</p>
        </>
      )}
    </div>
  );
}

function ModeSelector({ mode, onModeChange }: { mode: GenerationMode; onModeChange: (m: GenerationMode) => void }) {
  return (
    <div className="flex gap-1.5 px-4 py-3 border-b border-[var(--color-hairline)]">
      {MODES.map((m) => (
        <button
          key={m.mode}
          onClick={() => onModeChange(m.mode)}
          className={cn(
            'flex-1 flex flex-col items-center rounded-md py-1.5 px-2 text-[11px] transition-all',
            m.mode === mode
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] border border-[var(--color-hairline)] hover:border-[var(--color-primary)]'
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
    if (!trimmed || tags.includes(trimmed)) { setInput(''); return; }
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
            <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary)] bg-[var(--color-primary)]/5 rounded-full px-2 py-0.5">
              {tag}
              <button onClick={() => onTagsChange(tags.filter((t) => t !== tag))} className="text-[var(--color-primary)] hover:text-[var(--color-primary-active)] leading-none">&times;</button>
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

  useEffect(() => {
    getSettings().then((s) => {
      const offline = shouldRunOffline(s);
      setIsOffline(offline);
      const chatProviderId = s.runtime.chat.providerId;
      if (chatProviderId) {
        getAllProviders().then((providers) => {
          const p = providers.find(p => p.id === chatProviderId);
          if (p) {
            setProviderLabel(p.label);
            setHasKey(Boolean(p.apiKey));
            setPrivacy(privacyLabel(s, p.label));
          }
        });
      } else if (s.apiKey) {
        const label = s.provider === 'anthropic' ? 'Anthropic' : s.provider === 'openai-compatible' ? 'OpenRouter / Custom' : 'Offline';
        setProviderLabel(label);
        setHasKey(true);
        setPrivacy(privacyLabel(s, label));
      } else {
        setPrivacy(privacyLabel(s));
      }
    });
    getAppearance().then(applyAppearance);
    return watchAppearance(applyAppearance);
  }, []);

  async function handleCaptureClick() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) { setCaptureState('error'); setErrorMsg('Could not get active tab'); return; }
      setCaptureState('loading');
      setCaptureProgress('Starting capture...');
      setErrorMsg(undefined);

      const progressListener = (msg: unknown) => {
        if (msg && typeof msg === 'object' && (msg as { type?: string }).type === 'CAPTURE_PROGRESS') {
          const m = msg as { payload: { step: string } };
          setCaptureProgress(m.payload.step);
        }
      };
      browser.runtime.onMessage.addListener(progressListener);

      const response = await browser.runtime.sendMessage({
        type: 'CAPTURE_PAGE',
        payload: { mode, tags, tabId: tab.id, url: tab.url },
      }) as RuntimeMessage;

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
      browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${documentId}`) });
    }
  }

  function handleOpenSettings() {
    browser.runtime.openOptionsPage();
  }

  return (
    <div className="w-[320px] bg-[var(--color-canvas-soft)] text-[var(--color-ink)] flex flex-col overflow-hidden">
      <StatusBar providerLabel={providerLabel} hasKey={hasKey} />
      {privacy && (
        <div className="flex items-center gap-1.5 px-4 pb-2">
          <span className={cn('inline-block w-1.5 h-1.5 rounded-full', isOffline ? 'bg-[var(--color-accent-green)]' : 'bg-[var(--color-ink-faint)]')} />
          <span className="text-[11px] text-[var(--color-ink-muted)]">{privacy}</span>
        </div>
      )}
      <PageContextZone />
      <ModeSelector mode={mode} onModeChange={setMode} />
      <TagInput tags={tags} onTagsChange={setTags} />

      <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
        {captureState === 'success' ? (
          <button
            onClick={handleOpenReader}
            className="notion-btn-primary w-full text-[14px] py-2.5"
          >
            Open in Reader
          </button>
        ) : (
          <button
            disabled={captureState === 'loading'}
            onClick={handleCaptureClick}
            className={cn(
              'w-full text-[14px] font-medium py-2.5 rounded-full transition-all',
              captureState === 'idle' && 'notion-btn-primary',
              captureState === 'loading' && 'bg-[var(--color-primary)] text-white opacity-70 cursor-not-allowed',
              captureState === 'error' && 'border-2 border-[var(--color-destructive)] text-[var(--color-destructive)] bg-white hover:bg-[var(--color-destructive)]/5',
            )}
          >
            {captureState === 'loading' ? 'Processing...' : captureState === 'error' ? 'Retry' : 'Capture this page'}
          </button>
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
