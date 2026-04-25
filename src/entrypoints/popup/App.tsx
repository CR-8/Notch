import React, { useState, useEffect } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, saveSettings } from '../../lib/storage';
import type { Settings, GenerationMode } from '../../lib/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

// ── Status bar ────────────────────────────────────────────────────────────────
function StatusBar({ settings }: { settings: Settings | null }) {
  const hasKey = Boolean(settings?.apiKeys?.gemini);
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background">
      <span className="font-mono font-semibold text-xs uppercase tracking-widest text-white">
        NOTCH
      </span>
      <div className="flex items-center gap-1.5">
        <span className={cn('inline-block w-2 h-2', hasKey ? 'bg-[#5E6AD2]' : 'bg-[#FF3366]')} />
        <span className={cn('font-mono text-[9px] uppercase tracking-wider', hasKey ? 'text-primary' : 'text-danger')}>
          {hasKey ? 'GEMINI READY' : 'NO KEY'}
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
  { mode: 'BALANCED', label: 'BALANCED', sub: 'Gemma 3 12B' },
  { mode: 'DEEP',     label: 'DEEP',     sub: 'Gemma 3 27B' },
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
      No Gemini API key configured.{' '}
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
  const [tags, setTags] = useState<string[]>([]);
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [documentId, setDocumentId] = useState<string | undefined>();
  const [progress, setProgress] = useState<{ current: number; total: number } | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();

  useEffect(() => {
    getSettings().then((s) => { setSettings(s); setMode(s.defaultMode ?? 'FAST'); });
  }, []);

  function handleModeChange(newMode: GenerationMode) {
    setMode(newMode);
    const updated: Settings = {
      ...(settings ?? { ollamaEndpoint: 'http://localhost:11434', ollamaModel: 'llama3', apiKeys: {} }),
      defaultMode: newMode,
    };
    setSettings(updated);
    saveSettings(updated);
  }

  const hasNoKey = !settings?.apiKeys?.gemini;

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

  return (
    <div className="w-[320px] h-[480px] bg-background text-white flex flex-col overflow-hidden">
      <StatusBar settings={settings} />
      <PageContextZone />
      <ModeSelector mode={mode} onModeChange={handleModeChange} />
      <TagInput tags={tags} onTagsChange={setTags} />
      <div className="px-3 pb-3 pt-2">
        <CaptureButton
          state={captureState}
          documentId={documentId}
          onClick={handleCaptureClick}
          progress={progress}
          errorMsg={errorMsg}
        />
        {hasNoKey && <NoKeyWarning />}
      </div>
      <div className="flex-1" />
    </div>
  );
}
