import React, { useState, useEffect, useRef } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '../../lib/storage';
import type { Settings, GenerationMode } from '../../lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar({ settings }: { settings: Settings | null }) {
  const provider = settings?.provider ?? 'offline';
  const hasGeminiKey = Boolean(settings?.apiKeys?.gemini);
  const isReady = provider === 'gemini' ? hasGeminiKey : true;

  const statusLabel = provider === 'offline'
    ? 'NOMINAL'
    : provider === 'ollama'
      ? 'OLLAMA LOCAL'
      : hasGeminiKey
        ? 'BEAST'
        : 'BEAST / NO KEY';

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background">
      <span className="font-mono font-semibold text-xs uppercase tracking-widest text-white">
        NOTCH
      </span>
      <div className="flex items-center gap-1.5">
        <span className={cn('inline-block w-2 h-2', isReady ? 'bg-primary' : 'bg-danger')} />
        <span className={cn('font-mono text-[9px] uppercase tracking-wider', isReady ? 'text-primary' : 'text-danger')}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

// ── Page context zone ─────────────────────────────────────────────────────────
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
        <>
          <Skeleton className="h-3 w-[70%] mb-1.5" />
          <Skeleton className="h-2.5 w-[45%]" />
        </>
      ) : (
        <>
          <p className="font-body text-[13px] text-white truncate">{title}</p>
          <p className="font-mono text-[11px] text-muted uppercase mt-0.5">{domain}</p>
        </>
      )}
    </div>
  );
}

// ── Mode selector ─────────────────────────────────────────────────────────────
const MODES: { mode: GenerationMode; label: string; sub: string }[] = [
  { mode: 'FAST',     label: 'FAST',     sub: 'Flash Lite' },
  { mode: 'BALANCED', label: 'BALANCED', sub: 'Gemma 12B' },
  { mode: 'DEEP',     label: 'DEEP',     sub: 'Gemma 27B' },
  { mode: 'LOCAL',    label: 'LOCAL',    sub: 'Offline NLP' },
];

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
          <span className="font-mono font-normal text-[8px] text-muted mt-0.5 normal-case tracking-normal">
            {m.sub}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Service selector ──────────────────────────────────────────────────────────
type ServiceProvider = 'gemini' | 'offline';

const SERVICE_MODES: { provider: ServiceProvider; label: string; sub: string }[] = [
  { provider: 'gemini', label: 'BEAST', sub: 'Online services + RAG' },
  { provider: 'offline', label: 'NOMINAL', sub: 'Offline NLP + history' },
];

function ServiceSelector({
  provider,
  onProviderChange,
}: {
  provider: ServiceProvider;
  onProviderChange: (provider: ServiceProvider) => void;
}) {
  return (
    <div className="flex gap-1.5 px-3 py-2.5 border-b border-border">
      {SERVICE_MODES.map((m) => (
        <button
          key={m.provider}
          onClick={() => onProviderChange(m.provider)}
          className={cn(
            'flex-1 flex flex-col items-center font-mono font-semibold text-[10px] uppercase tracking-wider py-1.5 px-1 transition-colors',
            m.provider === provider
              ? 'border-2 border-primary text-primary'
              : 'border border-border text-white hover:bg-surface-hover'
          )}
        >
          <span>{m.label}</span>
          <span className="font-mono font-normal text-[8px] text-muted mt-0.5 normal-case tracking-normal">
            {m.sub}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Tag input ─────────────────────────────────────────────────────────────────
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
    <div className="px-3 py-2.5 border-b border-border">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="ADD TAG..."
        className="font-mono text-[11px] bg-surface border-border text-white placeholder:text-muted h-7"
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="font-mono text-[10px] uppercase border-border text-white gap-1 px-1.5 py-0"
            >
              {tag}
              <button
                onClick={() => onTagsChange(tags.filter((t) => t !== tag))}
                className="text-muted hover:text-white leading-none"
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Capture button ────────────────────────────────────────────────────────────
type CaptureState = 'idle' | 'loading' | 'success' | 'error';
type ImportState = 'idle' | 'loading' | 'success' | 'error';

const LABELS: Record<CaptureState, string> = {
  idle:    '[CAPTURE PAGE]',
  loading: '[PROCESSING...]',
  success: '[OPEN IN READER →]',
  error:   '[ERROR — RETRY]',
};

function CaptureButton({
  state,
  documentId,
  onClick,
  progress,
  errorMsg,
}: {
  state: CaptureState;
  documentId?: string;
  onClick: () => void;
  progress?: { current: number; total: number };
  errorMsg?: string;
}) {
  function handleClick() {
    if (state === 'loading') return;
    if (state === 'success' && documentId) {
      browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${documentId}`) });
      return;
    }
    onClick();
  }

  const isMultiSegment = progress && progress.total > 1;

  return (
    <div className="flex flex-col gap-1.5">
      <button
        disabled={state === 'loading'}
        onClick={handleClick}
        className={cn(
          'w-full py-3 font-mono font-semibold text-xs uppercase tracking-wider transition-colors',
          state === 'idle'    && 'border-2 border-primary text-primary hover:bg-primary/10',
          state === 'loading' && 'border-2 border-primary text-primary capture-loading cursor-not-allowed',
          state === 'success' && 'bg-surface text-white border border-border hover:bg-surface-hover',
          state === 'error'   && 'border-2 border-danger text-danger hover:bg-danger/10',
        )}
      >
        {state === 'loading' && isMultiSegment
          ? `[SEGMENT ${progress.current + 1}/${progress.total}...]`
          : LABELS[state]}
      </button>

      {/* Multi-segment progress bar */}
      {isMultiSegment && (
        <div className="w-full bg-surface border border-border h-1">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.round(((progress.current) / progress.total) * 100)}%` }}
          />
        </div>
      )}

      {/* Error detail */}
      {state === 'error' && errorMsg && (
        <p className="font-mono text-[9px] text-danger uppercase leading-tight px-0.5">
          {errorMsg.slice(0, 120)}{errorMsg.length > 120 ? '…' : ''}
        </p>
      )}
    </div>
  );
}

// ── No key warning ────────────────────────────────────────────────────────────
function NoKeyWarning() {
  return (
    <p className="font-mono text-[10px] text-danger uppercase mt-2">
      Beast mode needs a Gemini API key.{' '}
      <button
        onClick={() => browser.runtime.openOptionsPage()}
        className="underline hover:no-underline"
      >
        Open Settings
      </button>
    </p>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function PopupApp() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [mode, setMode] = useState<GenerationMode>('FAST');
  const [provider, setProvider] = useState<ServiceProvider>('offline');
  const [geminiKey, setGeminiKey] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [documentId, setDocumentId] = useState<string | undefined>();
  const [progress, setProgress] = useState<{ current: number; total: number } | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importedDocumentId, setImportedDocumentId] = useState<string | undefined>();
  const [importErrorMsg, setImportErrorMsg] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setMode(s.defaultMode ?? 'FAST');
      setProvider(s.provider === 'gemini' ? 'gemini' : 'offline');
      setGeminiKey(s.apiKeys.gemini ?? '');
    });
  }, []);

  async function handleSaveApiKey() {
    const updated: Settings = {
      ...(settings ?? { provider: 'offline', ollamaEndpoint: 'http://localhost:11434', ollamaModel: 'llama3', apiKeys: {}, defaultMode: mode }),
      apiKeys: { ...(settings?.apiKeys ?? {}), gemini: geminiKey || undefined },
      provider: settings?.provider ?? provider,
      defaultMode: settings?.defaultMode ?? mode,
    };
    setSettings(updated);
    await saveSettings(updated);
  }

  function handleModeChange(newMode: GenerationMode) {
    setMode(newMode);
    const updated: Settings = {
      ...(settings ?? { provider: 'offline', ollamaEndpoint: 'http://localhost:11434', ollamaModel: 'llama3', apiKeys: {}, defaultMode: newMode }),
      defaultMode: newMode,
    };
    setSettings(updated);
    saveSettings(updated);
  }

  function handleProviderChange(newProvider: ServiceProvider) {
    setProvider(newProvider);
    const updated: Settings = {
      ...(settings ?? { provider: 'offline', ollamaEndpoint: 'http://localhost:11434', ollamaModel: 'llama3', apiKeys: {}, defaultMode: mode }),
      provider: newProvider,
      defaultMode: settings?.defaultMode ?? mode,
    };
    setSettings(updated);
    saveSettings(updated);
  }

  const hasNoKey = provider === 'gemini' && !settings?.apiKeys?.gemini;

  async function handleCaptureClick() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) { setCaptureState('error'); setErrorMsg('Could not get active tab'); return; }
      setCaptureState('loading');
      setProgress(undefined);
      setErrorMsg(undefined);
      const response: import('../../lib/types').NotchMessage = await browser.runtime.sendMessage({
        type: 'CAPTURE_PAGE',
        payload: { tabId: tab.id, mode, tags },
      });
      if (response.type === 'CAPTURE_COMPLETE') {
        setDocumentId(response.payload.documentId);
        setCaptureState('success');
        setProgress(undefined);
      } else {
        const errPayload = (response as { type: 'CAPTURE_ERROR'; payload: { error: string } }).payload;
        setErrorMsg(errPayload?.error ?? 'Unknown error');
        setCaptureState('error');
      }
    } catch (e) {
      setErrorMsg((e as Error).message ?? 'Unknown error');
      setCaptureState('error');
    }
  }

  function handleImportClick() {
    if (importState === 'loading') return;
    if (importState === 'success' && importedDocumentId) {
      browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${importedDocumentId}`) });
      return;
    }
    setImportErrorMsg(undefined);
    fileInputRef.current?.click();
  }

  async function handlePdfSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportState('loading');
      setImportErrorMsg(undefined);
      const buffer = await file.arrayBuffer();
      const bytes = Array.from(new Uint8Array(buffer));

      const response: import('../../lib/types').NotchMessage = await browser.runtime.sendMessage({
        type: 'IMPORT_PDF',
        payload: { fileName: file.name, bytes, tags },
      });

      if (response.type === 'CAPTURE_COMPLETE') {
        setImportedDocumentId(response.payload.documentId);
        setImportState('success');
        setImportErrorMsg(undefined);
      } else {
        const errPayload = (response as { type: 'CAPTURE_ERROR'; payload: { error: string } }).payload;
        setImportErrorMsg(errPayload?.error ?? 'Unknown PDF import error');
        setImportState('error');
      }
    } catch (e) {
      setImportErrorMsg((e as Error).message ?? 'Unknown PDF import error');
      setImportState('error');
    } finally {
      e.target.value = '';
    }
  }

  const importLabel: Record<ImportState, string> = {
    idle: '[IMPORT PDF]',
    loading: '[INDEXING PDF...]',
    success: '[OPEN PDF IN READER →]',
    error: '[PDF IMPORT FAILED]',
  };

  return (
    <div className="w-[320px] h-[480px] bg-background text-white flex flex-col overflow-hidden">
      <StatusBar settings={settings} />
      <PageContextZone />
      <div className="px-3 py-2.5 border-b border-border">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-2">API KEY</p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="AIza..."
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-[11px] bg-surface border-border text-white placeholder:text-muted h-8"
          />
          <button
            onClick={handleSaveApiKey}
            className="shrink-0 border border-primary text-primary font-mono text-[10px] uppercase tracking-wider px-3 h-8 hover:bg-primary/10"
          >
            [SAVE]
          </button>
        </div>
      </div>
      <ServiceSelector provider={provider} onProviderChange={handleProviderChange} />
      <ModeSelector mode={mode} onModeChange={handleModeChange} />
      <TagInput tags={tags} onTagsChange={setTags} />
      <div className="px-3 pb-3 pt-2 flex flex-col gap-2">
        <CaptureButton
          state={captureState}
          documentId={documentId}
          onClick={handleCaptureClick}
          progress={progress}
          errorMsg={errorMsg}
        />
        <button
          disabled={importState === 'loading'}
          onClick={handleImportClick}
          className={cn(
            'w-full py-3 font-mono font-semibold text-xs uppercase tracking-wider transition-colors',
            importState === 'idle' && 'border border-border text-white hover:bg-surface-hover',
            importState === 'loading' && 'border border-primary text-primary capture-loading cursor-not-allowed',
            importState === 'success' && 'border-2 border-primary text-primary hover:bg-primary/10',
            importState === 'error' && 'border border-danger text-danger hover:bg-danger/10',
          )}
        >
          {importLabel[importState]}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handlePdfSelected}
          className="hidden"
        />
        {importState === 'error' && importErrorMsg && (
          <p className="font-mono text-[9px] text-danger uppercase leading-tight px-0.5">
            {importErrorMsg.slice(0, 120)}{importErrorMsg.length > 120 ? '…' : ''}
          </p>
        )}
        {hasNoKey && <NoKeyWarning />}
      </div>
      <div className="flex-1" />
    </div>
  );
}
