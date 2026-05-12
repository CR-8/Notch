import React, { useState, useEffect, useRef } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings, getFolders, getAppearance } from '../../lib/storage';
import type { Settings, GenerationMode, Folder, LLMProvider, AppearanceSettings } from '../../lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/ui/toast';

type CaptureState = 'idle' | 'loading' | 'success' | 'error';
type ImportState = 'idle' | 'loading' | 'success' | 'error';

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar({ hasKey, provider }: { hasKey: boolean; provider: LLMProvider }) {
  const isReady = provider === 'offline' || hasKey;
  const statusLabel = provider === 'offline'
    ? 'NOMINAL'
    : provider === 'anthropic'
      ? hasKey ? 'BEAST' : 'NO KEY'
      : hasKey ? 'OPENROUTER' : 'NO KEY';

  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background">
      <span className="font-mono font-semibold text-xs uppercase tracking-widest text-white">NOTCH</span>
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
          <p className="font-mono text-[13px] text-white truncate">{title}</p>
          <p className="font-mono text-[11px] text-muted uppercase mt-0.5">{domain}</p>
        </>
      )}
    </div>
  );
}

// ── Mode selector ──────────────────────────────────────────────────────────────
const MODES: { mode: GenerationMode; label: string; sub: string }[] = [
  { mode: 'FAST',     label: 'FAST',     sub: 'Quick capture' },
  { mode: 'BALANCED', label: 'BALANCED', sub: 'Quality + speed' },
  { mode: 'DEEP',     label: 'DEEP',     sub: 'Best quality' },
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
          <span className="font-mono font-normal text-[8px] text-muted mt-0.5 normal-case tracking-normal">{m.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ── Service selector ──────────────────────────────────────────────────────────
const PROVIDERS: { provider: LLMProvider; label: string; sub: string }[] = [
  { provider: 'anthropic',         label: 'ANTHROPIC', sub: 'Claude / OpenRouter' },
  { provider: 'openai-compatible', label: 'OPENROUTER', sub: 'OpenAI-compatible' },
  { provider: 'offline',          label: 'NOMINAL',   sub: 'Offline NLP only' },
];

function ProviderSelector({
  provider,
  onProviderChange,
}: {
  provider: LLMProvider;
  onProviderChange: (p: LLMProvider) => void;
}) {
  return (
    <div className="flex gap-1.5 px-3 py-2.5 border-b border-border">
      {PROVIDERS.map((p) => (
        <button
          key={p.provider}
          onClick={() => onProviderChange(p.provider)}
          className={cn(
            'flex-1 flex flex-col items-center font-mono font-semibold text-[10px] uppercase tracking-wider py-1.5 px-1 transition-colors',
            p.provider === provider
              ? 'border-2 border-primary text-primary'
              : 'border border-border text-white hover:bg-surface-hover'
          )}
        >
          <span>{p.label}</span>
          <span className="font-mono font-normal text-[8px] text-muted mt-0.5 normal-case tracking-normal">{p.sub}</span>
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
    <div className="px-3 py-2 border-b border-border">
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

// ── Folder selector ───────────────────────────────────────────────────────────
function FolderSelector({ folders, selectedId, onSelect }: { folders: Folder[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const selected = folders.find(f => f.id === selectedId);

  return (
    <div className="px-3 py-2 border-b border-border relative">
      <p className="font-mono text-[9px] uppercase tracking-widest text-muted mb-1.5">SAVE TO FOLDER</p>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
      >
        {selected ? (
          <>
            <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: selected.color }} />
            <span className="font-mono text-[10px] uppercase tracking-wider text-white truncate flex-1">{selected.name}</span>
          </>
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted flex-1">— None —</span>
        )}
        <span className="font-mono text-[10px] text-muted ml-auto">▾</span>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full z-50 bg-surface border border-border shadow-lg mt-0.5 max-h-36 overflow-y-auto">
          <button onClick={() => { onSelect(null); setOpen(false); }} className="w-full text-left font-mono text-[10px] uppercase tracking-wider px-3 py-2 text-muted hover:text-white hover:bg-surface-hover transition-colors">
            — None —
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => { onSelect(f.id); setOpen(false); }}
              className={cn('w-full text-left font-mono text-[10px] uppercase tracking-wider px-3 py-2 flex items-center gap-2 transition-colors hover:bg-surface-hover', selectedId === f.id ? 'text-white' : 'text-muted hover:text-white')}
            >
              <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: f.color }} />
              <span className="truncate">{f.name}</span>
              {selectedId === f.id && <span className="ml-auto text-primary">✓</span>}
            </button>
          ))}
          {folders.length === 0 && (
            <p className="font-mono text-[9px] text-muted px-3 py-2 uppercase">No folders — create one in the library</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Capture button ───────────────────────────────────────────────────────────
const LABELS: Record<CaptureState, string> = {
  idle:    '[CAPTURE PAGE]',
  loading: '[PROCESSING...]',
  success: '[OPEN IN READER →]',
  error:   '[ERROR — RETRY]',
};

function CaptureButton({ state, documentId, onClick, errorMsg, progress }: { state: CaptureState; documentId?: string; onClick: () => void; errorMsg?: string; progress?: string }) {
  function handleClick() {
    if (state === 'loading') return;
    if (state === 'success' && documentId) {
      browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${documentId}`) });
      return;
    }
    onClick();
  }

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
        {LABELS[state]}
      </button>
      {state === 'loading' && progress && (
        <p className="font-mono text-[9px] text-primary uppercase leading-tight px-0.5 animate-pulse">
          {progress}
        </p>
      )}
      {state === 'error' && errorMsg && (
        <p className="font-mono text-[9px] text-danger uppercase leading-tight px-0.5">
          {errorMsg.slice(0, 120)}{errorMsg.length > 120 ? '…' : ''}
        </p>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function PopupApp() {
  const { addToast } = useToast();
  const [settings, setSettings]     = useState<Settings | null>(null);
  const [mode, setMode]            = useState<GenerationMode>('FAST');
  const [provider, setProvider]    = useState<LLMProvider>('anthropic');
  const [apiKey, setApiKey]        = useState('');
  const [tags, setTags]            = useState<string[]>([]);
  const [folders, setFolders]      = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [documentId, setDocumentId] = useState<string | undefined>();
  const [errorMsg, setErrorMsg]     = useState<string | undefined>();
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importedDocumentId, setImportedDocumentId] = useState<string | undefined>();
  const [importErrorMsg, setImportErrorMsg] = useState<string | undefined>();
  const [captureProgress, setCaptureProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      setMode(s.defaultMode ?? 'FAST');
      setProvider(s.provider ?? 'anthropic');
      setApiKey(s.apiKey ?? '');
    });
    getFolders().then(setFolders);
  }, []);

  // Apply global appearance
  useEffect(() => {
    getAppearance().then((a) => {
      const resolved = a.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : a.theme;
      document.documentElement.dataset.theme = resolved;
      document.body.dataset.theme = resolved;
      document.documentElement.style.setProperty('--color-primary', a.accentColor);
    });
  }, []);

  async function handleSaveApiKey() {
    const updated: Settings = {
      apiKey: apiKey || '',
      provider,
      baseUrl: settings?.baseUrl ?? 'https://openrouter.ai/api/v1',
      modelId: settings?.modelId ?? '',
      defaultMode: mode,
    };
    setSettings(updated);
    await saveSettings(updated);
  }

  async function handleModeChange(newMode: GenerationMode) {
    setMode(newMode);
    const updated: Settings = {
      apiKey: apiKey || '',
      provider,
      baseUrl: settings?.baseUrl ?? 'https://openrouter.ai/api/v1',
      modelId: settings?.modelId ?? '',
      defaultMode: newMode,
    };
    setSettings(updated);
    await saveSettings(updated);
  }

  async function handleProviderChange(newProvider: LLMProvider) {
    setProvider(newProvider);
    const updated: Settings = {
      apiKey: apiKey || '',
      provider: newProvider,
      baseUrl: settings?.baseUrl ?? 'https://openrouter.ai/api/v1',
      modelId: settings?.modelId ?? '',
      defaultMode: mode,
    };
    setSettings(updated);
    await saveSettings(updated);
  }

  async function handleCaptureClick() {
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab?.id) { setCaptureState('error'); setErrorMsg('Could not get active tab'); return; }
      setCaptureState('loading');
      setCaptureProgress('Starting capture...');
      setErrorMsg(undefined);

      // Listen for progress updates
      const progressListener = (msg: unknown) => {
        if (msg && typeof msg === 'object' && (msg as { type?: string }).type === 'CAPTURE_PROGRESS') {
          const m = msg as { payload: { step: string } };
          setCaptureProgress(m.payload.step);
        }
      };
      browser.runtime.onMessage.addListener(progressListener);

      const response = await browser.runtime.sendMessage({
        type: 'CAPTURE_PAGE',
        payload: { tabId: tab.id, mode, tags },
      }) as { type: string; payload?: { documentId?: string; error?: string } };

      browser.runtime.onMessage.removeListener(progressListener);

      if (response.type === 'CAPTURE_COMPLETE' && response.payload?.documentId) {
        setDocumentId(response.payload.documentId);
        setCaptureState('success');
        setCaptureProgress('');
        addToast('Page captured successfully!', 'success');
      } else {
        setErrorMsg(response.payload?.error ?? 'Unknown error');
        setCaptureState('error');
        setCaptureProgress('');
        addToast(response.payload?.error ?? 'Capture failed', 'error');
      }
    } catch (e) {
      setErrorMsg((e as Error).message ?? 'Unknown error');
      setCaptureState('error');
      setCaptureProgress('');
      addToast((e as Error).message ?? 'Capture failed', 'error');
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
      const response = await browser.runtime.sendMessage({
        type: 'IMPORT_PDF',
        payload: { fileName: file.name, bytes, tags },
      }) as { type: string; payload?: { documentId?: string; error?: string } };
      if (response.type === 'CAPTURE_COMPLETE' && response.payload?.documentId) {
        setImportedDocumentId(response.payload.documentId);
        setImportState('success');
      } else {
        setImportErrorMsg(response.payload?.error ?? 'PDF import error');
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
    idle:    '[IMPORT PDF]',
    loading: '[INDEXING PDF...]',
    success: '[OPEN PDF IN READER →]',
    error:   '[PDF IMPORT FAILED]',
  };

  const hasNoKey = provider !== 'offline' && !apiKey;

  return (
    <div className="w-[320px] bg-background text-white flex flex-col overflow-hidden">
      <StatusBar hasKey={Boolean(apiKey)} provider={provider} />
      <PageContextZone />

      {/* API Key */}
      <div className="px-3 py-2 border-b border-border">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-1.5">API KEY</p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'anthropic' ? 'sk-ant-...' : 'sk-...'}
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

      <ProviderSelector provider={provider} onProviderChange={handleProviderChange} />
      <ModeSelector mode={mode} onModeChange={handleModeChange} />
      <TagInput tags={tags} onTagsChange={setTags} />
      <FolderSelector folders={folders} selectedId={selectedFolderId} onSelect={setSelectedFolderId} />

      <div className="px-3 pb-3 pt-2 flex flex-col gap-2">
        {captureState === 'error' && errorMsg ? (
          <EmptyState message={`Capture failed: ${errorMsg.slice(0, 80)}`} action={{ label: '[Retry]', onClick: handleCaptureClick }} />
        ) : (
          <CaptureButton state={captureState} documentId={documentId} onClick={handleCaptureClick} errorMsg={errorMsg} progress={captureProgress} />
        )}
        <button
          disabled={importState === 'loading'}
          onClick={handleImportClick}
          className={cn(
            'w-full py-3 font-mono font-semibold text-xs uppercase tracking-wider transition-colors',
            importState === 'idle'    && 'border border-border text-white hover:bg-surface-hover',
            importState === 'loading' && 'border border-primary text-primary capture-loading cursor-not-allowed',
            importState === 'success' && 'border-2 border-primary text-primary hover:bg-primary/10',
            importState === 'error'   && 'border border-danger text-danger hover:bg-danger/10',
          )}
        >
          {importLabel[importState]}
        </button>
        <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handlePdfSelected} className="hidden" />
        {importState === 'error' && importErrorMsg && (
          <p className="font-mono text-[9px] text-danger uppercase leading-tight px-0.5">{importErrorMsg.slice(0, 120)}</p>
        )}
        {hasNoKey && (
          <p className="font-mono text-[10px] text-danger uppercase">
            Add API key in{' '}
            <button onClick={() => browser.runtime.openOptionsPage()} className="underline hover:no-underline">
              Settings
            </button>
          </p>
        )}
      </div>
    </div>
  );
}