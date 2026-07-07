import { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  Lightbulb,
  AlignLeft,
  Feather,
  Expand,
  PenLine,
  Languages,
  MessageSquare,
  Copy,
  Highlighter,
  RotateCw,
  X,
  Loader2,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useReaderAI, type AiAction } from '../hooks/useReaderAI';
import type { SelectionState } from '../hooks/useTextSelection';

interface SelectionToolbarProps {
  selection: SelectionState;
  documentId: string;
  onHighlight: (text: string) => Promise<void> | void;
  onDismiss: () => void;
}

type Mode = 'toolbar' | 'result' | 'translate' | 'ask';

interface AiButton {
  action: AiAction;
  label: string;
  icon: React.ReactNode;
}

const AI_BUTTONS: AiButton[] = [
  { action: 'explain', label: 'Explain', icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { action: 'summarize', label: 'Summarize', icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { action: 'simplify', label: 'Simplify', icon: <Feather className="h-3.5 w-3.5" /> },
  { action: 'expand', label: 'Expand', icon: <Expand className="h-3.5 w-3.5" /> },
  { action: 'rewrite', label: 'Rewrite', icon: <PenLine className="h-3.5 w-3.5" /> },
];

const LANGUAGES = ['Spanish', 'French', 'German', 'Japanese', 'Hindi', 'Mandarin', 'Arabic'];

const TOOLBAR_WIDTH = 380;
const TOOLBAR_EST_HEIGHT = 46;

function Pill({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function SelectionToolbar({
  selection,
  documentId,
  onHighlight,
  onDismiss,
}: SelectionToolbarProps) {
  const { addToast } = useToast();
  const { runAction, ask, translate } = useReaderAI(documentId);
  const [mode, setMode] = useState<Mode>('toolbar');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultTitle, setResultTitle] = useState('');
  const [copied, setCopied] = useState(false);
  const lastRun = useRef<{
    title: string;
    run: (onChunk: (t: string) => void) => Promise<{ answer: string }>;
  } | null>(null);
  const askInput = useRef<HTMLInputElement>(null);

  const text = selection.text;

  // Anchor the floating UI to the selection, clamped to the viewport.
  const pos = useMemo(() => {
    const rect = selection.rect;
    if (!rect) return { left: 0, top: 0, placeAbove: true };
    const centerX = rect.left + rect.width / 2;
    const left = Math.max(
      12,
      Math.min(window.innerWidth - TOOLBAR_WIDTH - 12, centerX - TOOLBAR_WIDTH / 2),
    );
    const placeAbove = rect.top > TOOLBAR_EST_HEIGHT + 88;
    const top = placeAbove ? rect.top - TOOLBAR_EST_HEIGHT - 10 : rect.bottom + 10;
    return { left, top, placeAbove };
  }, [selection.rect]);

  const stream = useCallback(
    (title: string, run: (onChunk: (t: string) => void) => Promise<{ answer: string }>) => {
      setMode('result');
      setResultTitle(title);
      setResult('');
      setError(null);
      setLoading(true);
      lastRun.current = { title, run };
      run((partial) => setResult(partial))
        .then((res) => {
          setResult(res.answer);
          setLoading(false);
        })
        .catch((err: unknown) => {
          setLoading(false);
          setError(err instanceof Error ? err.message : 'Request failed.');
        });
    },
    [],
  );

  const handleAi = useCallback(
    (btn: AiButton) => stream(btn.label, (onChunk) => runAction(btn.action, text, onChunk)),
    [stream, runAction, text],
  );

  const handleTranslate = useCallback(
    (lang: string) =>
      stream(`Translate → ${lang}`, async (onChunk) => {
        const translated = await translate(text, lang);
        onChunk(translated);
        return { answer: translated };
      }),
    [stream, translate, text],
  );

  const handleAsk = useCallback(() => {
    const q = askInput.current?.value.trim();
    if (!q) return;
    stream('Ask AI', (onChunk) => ask(text, q, onChunk));
  }, [stream, ask, text]);

  const handleCopySelection = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => addToast('Copied to clipboard', 'success'))
      .catch(() => addToast('Copy failed', 'error'));
    onDismiss();
  }, [text, addToast, onDismiss]);

  const handleHighlight = useCallback(() => {
    void Promise.resolve(onHighlight(text)).then(() => {
      addToast('Saved to bookmarks', 'success');
      onDismiss();
    });
  }, [text, onHighlight, addToast, onDismiss]);

  const copyResult = useCallback(() => {
    void navigator.clipboard.writeText(result).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }, [result]);

  if (!selection.rect) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="selection-toolbar"
        // Keep the selection alive when interacting with the toolbar.
        onMouseDown={(e) => e.preventDefault()}
        initial={{ opacity: 0, scale: 0.94, y: pos.placeAbove ? 6 : -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 420, damping: 30 }}
        className="reader-glass-strong fixed z-40 rounded-xl p-1"
        style={{ left: pos.left, top: pos.top, width: TOOLBAR_WIDTH }}
        role="toolbar"
        aria-label="Selection actions"
      >
        {mode === 'toolbar' && (
          <div className="flex items-center gap-0.5 overflow-x-auto">
            {AI_BUTTONS.map((b) => (
              <Pill key={b.action} label={b.label} icon={b.icon} onClick={() => handleAi(b)} />
            ))}
            <div className="mx-0.5 h-5 w-px shrink-0 bg-hairline" aria-hidden />
            <Pill
              label="Translate"
              icon={<Languages className="h-3.5 w-3.5" />}
              onClick={() => setMode('translate')}
            />
            <Pill
              label="Ask"
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              onClick={() => setMode('ask')}
            />
            <div className="mx-0.5 h-5 w-px shrink-0 bg-hairline" aria-hidden />
            <button
              type="button"
              onClick={handleHighlight}
              aria-label="Highlight"
              title="Highlight"
              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-accent-orange"
            >
              <Highlighter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCopySelection}
              aria-label="Copy"
              title="Copy"
              className="rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {mode === 'translate' && (
          <div className="p-1">
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <button
                onClick={() => setMode('toolbar')}
                className="rounded p-1 text-ink-faint hover:text-ink"
                aria-label="Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[12px] font-medium text-ink">Translate to</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  onClick={() => handleTranslate(l)}
                  className="rounded-md bg-soft-cloud px-2 py-1 text-[12px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === 'ask' && (
          <div className="p-1">
            <div className="mb-1 flex items-center gap-1.5 px-1">
              <button
                onClick={() => setMode('toolbar')}
                className="rounded p-1 text-ink-faint hover:text-ink"
                aria-label="Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[12px] font-medium text-ink">Ask about this selection</span>
            </div>
            <div className="flex items-center gap-1 px-1 pb-1">
              <input
                ref={askInput}
                autoFocus
                placeholder="What would you like to know?"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAsk();
                }}
                className="flex-1 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none placeholder:text-ink-faint focus:border-primary/50"
              />
              <button
                onClick={handleAsk}
                className="rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary-active"
              >
                Ask
              </button>
            </div>
          </div>
        )}

        {mode === 'result' && (
          <div className="w-full">
            <div className="flex items-center gap-2 border-b border-hairline px-2 py-1.5">
              <button
                onClick={() => setMode('toolbar')}
                className="rounded p-1 text-ink-faint hover:text-ink"
                aria-label="Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {resultTitle}
              </span>
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  onClick={() =>
                    lastRun.current && stream(lastRun.current.title, lastRun.current.run)
                  }
                  disabled={loading}
                  className="rounded p-1 text-ink-faint hover:text-ink disabled:opacity-40"
                  aria-label="Regenerate"
                  title="Regenerate"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={copyResult}
                  disabled={!result}
                  className="rounded p-1 text-ink-faint hover:text-ink disabled:opacity-40"
                  aria-label="Copy result"
                  title="Copy result"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={onDismiss}
                  className="rounded p-1 text-ink-faint hover:text-ink"
                  aria-label="Close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="max-h-[40vh] overflow-y-auto px-3 py-2.5">
              {error ? (
                <p className="text-[13px] leading-relaxed text-sale">{error}</p>
              ) : result ? (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-secondary">
                  {result}
                  {loading && <span className="ml-0.5 animate-blink">▍</span>}
                </p>
              ) : (
                <div className="flex items-center gap-2 py-2 text-[13px] text-ink-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Thinking…
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
