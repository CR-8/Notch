import { useState, useEffect, useRef } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings, getAppearance, getAllProviders } from '../../lib/storage';
import { PRESETS } from '../../lib/providers/registry';
import type { GenerationMode, RuntimeMessage, ProviderConfig } from '../../lib/types';
import { cn } from '@/lib/utils';

type CaptureState = 'idle' | 'loading' | 'success' | 'error';

const MODES: { mode: GenerationMode; label: string; sub: string }[] = [
  { mode: 'FAST',     label: 'FAST',     sub: 'Quick capture' },
  { mode: 'BALANCED', label: 'BALANCED', sub: 'Quality + speed' },
  { mode: 'DEEP',     label: 'DEEP',     sub: 'Best quality' },
];

function StatusBar({ providerLabel, hasKey }: { providerLabel: string; hasKey: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background">
      <span className="font-mono font-semibold text-xs uppercase tracking-widest text-white">NOTCH</span>
      <div className="flex items-center gap-1.5">
        <span className={cn('inline-block w-2 h-2', hasKey ? 'bg-primary' : 'bg-danger')} />
        <span className={cn('font-mono text-[9px] uppercase tracking-wider', hasKey ? 'text-primary' : 'text-danger')}>
          {hasKey ? providerLabel : 'NO KEY'}
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
    <div className="px-3 py-2.5 border-b border-border">
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-3 w-[70%] bg-surface animate-pulse rounded" />
          <div className="h-2.5 w-[45%] bg-surface animate-pulse rounded" />
        </div>
      ) : (
        <>
          <p className="font-mono text-[13px] text-white truncate">{title}</p>
          <p className="font-mono text-[11px] text-muted uppercase mt-0.5">{domain}</p>
        </>
      )}
    </div>
  );
}

function ModeSelector({ mode, onModeChange }: { mode: GenerationMode; onModeChange: (m: GenerationMode) => void }) {
  return (
    <div className="flex gap-1.5 px-3 py-2.5 border-b border-border">
      {MODES.map((m) => (
        <button
          key={m.mode}
          onClick={() => onModeChange(m.mode)}
          className={cn(
            'flex-1 flex flex-col items-center font-mono font-semibold text-[10px] uppercase tracking-wider py-1.5 px-1 transition-colors',
            m.mode === mode
              ? 'border-2 border-primary text-primary'
              : 'border border-border text-white hover:bg-surface-hover'
          )}
        >
          <span>{m.label}</span>
          <span className="font-mono font-normal text-[8px] text-muted mt-0.5 normal-case tracking-normal">{m.sub}</span>
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
    <div className="px-3 py-2 border-b border-border">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="ADD TAG..."
        className="w-full font-mono text-[11px] bg-surface border border-border text-white placeholder:text-muted h-7 px-2 outline-none"
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tags.map((tag) => (
            <span key={tag} className="font-mono text-[10px] uppercase border border-border text-white px-1.5 py-0 flex items-center gap-1">
              {tag}
              <button onClick={() => onTagsChange(tags.filter((t) => t !== tag))} className="text-muted hover:text-white leading-none">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PopupApp() {
  const [mode] = useState<GenerationMode>('FAST');
  const [tags, setTags] = useState<string[]>([]);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [documentId, setDocumentId] = useState<string | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [captureProgress, setCaptureProgress] = useState<string>('');
  const [providerLabel, setProviderLabel] = useState('ANTHROPIC');
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    getSettings().then((s) => {
      const chatProviderId = s.runtime.chat.providerId;
      if (chatProviderId) {
        getAllProviders().then((providers) => {
          const p = providers.find(p => p.id === chatProviderId);
          if (p) {
            setProviderLabel(p.label.toUpperCase());
            setHasKey(Boolean(p.apiKey));
          }
        });
      }
    });
    getAppearance().then((a) => {
      const resolved = a.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : a.theme;
      document.documentElement.dataset.theme = resolved;
      document.body.dataset.theme = resolved;
      document.documentElement.style.setProperty('--color-primary', a.accentColor);
    });
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
        payload: { mode, tags },
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
    <div className="w-[320px] bg-background text-white flex flex-col overflow-hidden">
      <StatusBar providerLabel={providerLabel} hasKey={hasKey} />
      <PageContextZone />
      <ModeSelector mode={mode} onModeChange={() => {}} />
      <TagInput tags={tags} onTagsChange={setTags} />

      <div className="px-3 pb-3 pt-2 flex flex-col gap-2">
        {captureState === 'success' ? (
          <button
            onClick={handleOpenReader}
            className="w-full py-3 font-mono font-semibold text-xs uppercase tracking-wider border-2 border-primary text-primary hover:bg-primary/10 transition-colors"
          >
            [OPEN IN READER →]
          </button>
        ) : (
          <button
            disabled={captureState === 'loading'}
            onClick={handleCaptureClick}
            className={cn(
              'w-full py-3 font-mono font-semibold text-xs uppercase tracking-wider transition-colors',
              captureState === 'idle'    && 'border-2 border-primary text-primary hover:bg-primary/10',
              captureState === 'loading' && 'border-2 border-primary text-primary cursor-not-allowed',
              captureState === 'error'   && 'border-2 border-danger text-danger hover:bg-danger/10',
            )}
          >
            {captureState === 'loading' ? '[PROCESSING...]' : captureState === 'error' ? '[RETRY]' : '[CAPTURE PAGE]'}
          </button>
        )}

        {captureState === 'loading' && captureProgress && (
          <p className="font-mono text-[9px] text-primary uppercase leading-tight px-0.5 animate-pulse">{captureProgress}</p>
        )}

        {captureState === 'error' && errorMsg && (
          <p className="font-mono text-[9px] text-danger uppercase leading-tight px-0.5">{errorMsg.slice(0, 120)}</p>
        )}

        <button
          onClick={handleOpenSettings}
          className="w-full py-3 font-mono font-semibold text-xs uppercase tracking-wider border border-border text-white hover:bg-surface-hover transition-colors"
        >
          [SETTINGS]
        </button>
      </div>
    </div>
  );
}
