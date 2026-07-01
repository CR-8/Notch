import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { browser } from 'wxt/browser';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import { getChatMessagesByDocument } from '@/lib/idb';
import { log } from '@/lib/logger';
import type { Document, Citation, ReadingLevel } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeUserInput, sanitizeHtml } from '@/lib/sanitize';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  isError?: boolean;
  translated?: string;
  isTranslating?: boolean;
  pinned?: boolean;
}

// ── Citation scroll-linking helpers ──────────────────────────────────────────

function scrollToAndHighlightCitation(
  leftPaneRef: React.RefObject<HTMLDivElement | null>,
  paragraphIndex: number,
  scroll: boolean,
) {
  const root = leftPaneRef.current;
  if (!root) return;
  const el = root.querySelector<HTMLElement>(`[data-paragraph-index="${paragraphIndex}"]`);
  if (!el) return;
  if (scroll) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  el.style.background = 'color-mix(in srgb, var(--color-info) 14%, transparent)';
  return el;
}

function clearCitationHighlight(el: HTMLElement | null) {
  if (el) el.style.background = '';
}

// ── CitationChip ──────────────────────────────────────────────────────────────

interface CitationChipProps {
  n: number;
  citation: Citation;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
}

function CitationChip({ n, citation, leftPaneRef }: CitationChipProps) {
  const highlightedElRef = useRef<HTMLElement | null>(null);

  function handleClick() {
    clearCitationHighlight(highlightedElRef.current);
    highlightedElRef.current = null;
    const root = leftPaneRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(
      `[data-paragraph-index="${citation.paragraphIndex}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.background = 'color-mix(in srgb, var(--color-info) 14%, transparent)';
    setTimeout(() => {
      el.style.background = '';
    }, 2000);
  }

  function handleMouseEnter() {
    const el = scrollToAndHighlightCitation(leftPaneRef, citation.paragraphIndex, false);
    highlightedElRef.current = el ?? null;
  }

  function handleMouseLeave() {
    clearCitationHighlight(highlightedElRef.current);
    highlightedElRef.current = null;
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline text-[11px] font-semibold text-[var(--color-primary)] hover:opacity-70 transition-opacity cursor-pointer px-0.5"
      title={`Go to source paragraph ${citation.paragraphIndex}`}
    >
      [{n}]
    </button>
  );
}

// ── Parse answer text with [N] markers into React nodes ──────────────────────

function parseAnswerWithCitations(
  text: string,
  citations: Citation[],
  leftPaneRef: React.RefObject<HTMLDivElement | null>,
): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const n = parseInt(match[1], 10);
      const citation = citations[n - 1];
      if (citation) {
        return <CitationChip key={i} n={n} citation={citation} leftPaneRef={leftPaneRef} />;
      }
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────

function renderMarkdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false });
  return sanitizeHtml(rawHtml);
}

interface MarkdownContentProps {
  content: string;
  citations?: Citation[];
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
}

function MarkdownContent({ content, citations, leftPaneRef }: MarkdownContentProps) {
  const html = useMemo(() => renderMarkdownToHtml(content), [content]);

  if (citations && citations.length > 0) {
    const partsWithCitations = parseAnswerWithCitations(content, citations, leftPaneRef);
    const textOnly = partsWithCitations.map((p) => (typeof p === 'string' ? p : '')).join('');

    const hasMarkdown =
      /^[#*`>-]/.test(content.trim()) ||
      (content.includes('\n') &&
        (content.includes('**') || content.includes('`') || content.includes('- ')));

    if (hasMarkdown) {
      const markedHtml = marked.parse(textOnly, { async: false });
      return (
        <div
          className="notion-prose text-[14px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markedHtml) }}
        />
      );
    }

    return (
      <div className="text-[14px] leading-relaxed text-[var(--color-ink)] space-y-1">
        {partsWithCitations}
      </div>
    );
  }

  const hasMarkdown =
    /^[#*`>-]/.test(content.trim()) ||
    (content.includes('\n') &&
      (content.includes('**') || content.includes('`') || content.includes('- ')));

  if (hasMarkdown) {
    return (
      <div
        className="notion-prose text-[14px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <p className="text-[14px] text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap">
      {content}
    </p>
  );
}

// ── ContextPill ───────────────────────────────────────────────────────────────

function ContextPill({ title, folderColor }: { title: string; folderColor?: string }) {
  return (
    <div className="rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 shrink-0 flex items-center gap-2">
      {folderColor && (
        <span
          className="inline-block w-2 h-2 rounded-sm shrink-0"
          style={{ backgroundColor: folderColor }}
        />
      )}
      <span className="text-[11px] font-medium text-[var(--color-ink-muted)] shrink-0">
        Chatting with
      </span>
      <span className="text-[12px] font-medium text-[var(--color-ink)] truncate">{title}</span>
    </div>
  );
}

// ── Enhanced ActionBar (Task 9) ──────────────────────────────────────────────

const QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  { label: 'Main arguments', prompt: 'What are the main arguments in this document?' },
  { label: 'Author assumptions', prompt: 'What assumptions does the author make?' },
  { label: 'Key takeaways', prompt: 'What should I remember from this document?' },
  {
    label: 'Challenge claims',
    prompt: "Challenge the author's claims. What are the weaknesses or counterarguments?",
  },
  {
    label: 'Study notes',
    prompt: 'Generate study notes from this document with key points and summaries.',
  },
  {
    label: 'Interview questions',
    prompt: 'Create interview questions based on the content of this document.',
  },
  {
    label: 'Weak evidence',
    prompt: 'Identify weak evidence or unsupported claims in this document.',
  },
  {
    label: 'Actionable insights',
    prompt: 'Extract actionable insights from this document that I can apply.',
  },
  { label: 'Executive summary', prompt: 'Generate an executive summary of this document.' },
  {
    label: 'Compare practices',
    prompt: 'Compare the content of this document with industry best practices.',
  },
];

function ActionBar({
  onAction,
  disabled,
}: {
  onAction: (prompt: string) => void;
  disabled?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? QUICK_ACTIONS : QUICK_ACTIONS.slice(0, 4);

  return (
    <div className="flex flex-col gap-1.5 shrink-0">
      <div className="flex flex-wrap gap-1.5">
        {visible.map((a) => (
          <button
            key={a.label}
            onClick={() => onAction(a.prompt)}
            disabled={disabled}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {a.label}
          </button>
        ))}
        {QUICK_ACTIONS.length > 4 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
          >
            {expanded ? 'Show less' : `+${QUICK_ACTIONS.length - 4} more`}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Entity Shortcuts (Task 10) ────────────────────────────────────────────────

function EntityShortcuts({ entities, onAsk }: { entities: string[]; onAsk: (q: string) => void }) {
  if (entities.length === 0) return null;
  return (
    <div className="shrink-0">
      <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-1.5">
        Entities Found
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entities.map((entity) => (
          <button
            key={entity}
            onClick={() => onAsk(`Explain "${entity}" in the context of this document.`)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-all"
          >
            {entity}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Concept Shortcuts (Task 11) ───────────────────────────────────────────────

function ConceptShortcuts({ concepts, onAsk }: { concepts: string[]; onAsk: (q: string) => void }) {
  if (concepts.length === 0) return null;
  return (
    <div className="shrink-0">
      <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-1.5">
        Concepts Found
      </p>
      <div className="flex flex-wrap gap-1.5">
        {concepts.map((concept) => (
          <button
            key={concept}
            onClick={() => onAsk(`Explain "${concept}" in simple terms based on this document.`)}
            className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--color-accent-purple)]/20 bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] hover:bg-[var(--color-accent-purple)]/20 transition-all"
          >
            {concept}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Timeline Shortcuts (Task 12) ──────────────────────────────────────────────

interface TimelineShortcutProps {
  events: Array<{ date: string; description: string }>;
  onAsk: (q: string) => void;
}

function TimelineShortcuts({ events, onAsk }: TimelineShortcutProps) {
  if (events.length === 0) return null;
  const displayed = events.slice(0, 5);
  return (
    <div className="shrink-0">
      <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-1.5">
        Timeline Events
      </p>
      <div className="flex flex-col gap-1">
        {displayed.map((ev, i) => (
          <button
            key={i}
            onClick={() =>
              onAsk(
                `What happened during "${ev.description}" (${ev.date})? Explain the significance of this event.`,
              )
            }
            className="text-left text-[12px] font-medium px-2.5 py-1.5 rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all"
          >
            <span className="font-semibold text-[var(--color-ink)]">{ev.date}</span>
            <span className="ml-1">{ev.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── ReadingLevelToggle (CHAT-5) ───────────────────────────────────────────────

function ReadingLevelToggle({
  level,
  onChange,
}: {
  level: ReadingLevel;
  onChange: (l: ReadingLevel) => void;
}) {
  const opts: Array<{ value: ReadingLevel; label: string }> = [
    { value: 'simple', label: 'Simple' },
    { value: 'technical', label: 'Technical' },
  ];
  return (
    <div
      className="flex shrink-0 rounded-md border border-[var(--color-hairline)] overflow-hidden"
      title="Reading level"
    >
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'text-[11px] font-medium px-2 py-1 transition-colors',
            level === o.value
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── UserBubble ────────────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-lg bg-[var(--color-surface-hover)] px-3 py-2">
        <p className="text-[14px] text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap">
          {text}
        </p>
      </div>
    </div>
  );
}

interface TtsChunkMessage {
  type: 'chunk';
  audio: ArrayBuffer;
  sampleRate: number;
}
interface TtsDoneMessage {
  type: 'done';
}
interface TtsErrorMessage {
  type: 'error';
  error: string;
}
type TtsMessage = TtsChunkMessage | TtsDoneMessage | TtsErrorMessage;

// ── TTS Speak hook (streaming via port) ────────────────────────────────────────

function useTtsSpeak() {
  const [speaking, setSpeaking] = useState(false);
  const nextTimeRef = useRef(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const portRef = useRef<{
    disconnect: () => void;
    postMessage: (msg: { type: string; text: string }) => void;
    onMessage: { addListener: (cb: (msg: TtsMessage) => void) => void };
  } | null>(null);
  const queueLenRef = useRef(0);

  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new AudioContext();
    return ctxRef.current;
  };

  const speak = useCallback(
    (text: string) => {
      if (speaking) {
        portRef.current?.disconnect();
        portRef.current = null;
        ctxRef.current?.close().catch(() => {});
        ctxRef.current = null;
        setSpeaking(false);
        return;
      }

      setSpeaking(true);
      const ctx = getCtx();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      nextTimeRef.current = ctx.currentTime + 0.05;
      queueLenRef.current = 0;

      const port = browser.runtime.connect({ name: 'tts-stream' });
      portRef.current = port;
      port.postMessage({ type: 'SPEAK', text });

      port.onMessage.addListener((msg: TtsMessage) => {
        if (msg.type === 'chunk') {
          const src = ctx.createBufferSource();
          const abuf = ctx.createBuffer(1, msg.audio.byteLength / 4, msg.sampleRate);
          abuf.copyToChannel(new Float32Array(msg.audio), 0);
          src.buffer = abuf;
          src.connect(ctx.destination);
          const start = Math.max(nextTimeRef.current, ctx.currentTime);
          src.start(start);
          nextTimeRef.current = start + abuf.duration;
          queueLenRef.current++;
          src.onended = () => {
            queueLenRef.current--;
            if (queueLenRef.current <= 0 && portRef.current === null) {
              setSpeaking(false);
            }
          };
        } else if (msg.type === 'done') {
          port.disconnect();
          portRef.current = null;
          if (queueLenRef.current <= 0) setSpeaking(false);
        } else if (msg.type === 'error') {
          log.error('TTS', msg.error);
          port.disconnect();
          portRef.current = null;
          setSpeaking(false);
        }
      });
    },
    [speaking],
  );

  return { speaking, speak };
}

// ── NotchBubble ───────────────────────────────────────────────────────────────

interface NotchBubbleProps {
  text: string;
  citations?: Citation[];
  isError?: boolean;
  translated?: string;
  isTranslating?: boolean;
  showLanguageInput?: boolean;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
  onTranslate?: () => void;
  onTranslateSubmit?: (language: string) => void;
  onPin?: () => void;
  isPinned?: boolean;
}

function NotchBubble({
  text,
  citations,
  isError,
  translated,
  isTranslating,
  showLanguageInput,
  leftPaneRef,
  onTranslate,
  onTranslateSubmit,
  onPin,
  isPinned,
}: NotchBubbleProps) {
  const { speaking, speak } = useTtsSpeak();
  const [langValue, setLangValue] = useState('');
  const langInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showLanguageInput && langInputRef.current) {
      langInputRef.current.focus();
      setLangValue('');
    }
  }, [showLanguageInput]);

  function handleLangKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      const lang = langValue.trim();
      if (lang) {
        onTranslateSubmit?.(lang);
        setLangValue('');
      }
    }
    if (e.key === 'Escape') {
      onTranslate?.();
      setLangValue('');
    }
  }

  if (isError) {
    return (
      <div className="flex justify-start">
        <div className="max-w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-[0.125px] text-[var(--color-primary)] mb-1.5">
            Notch
          </p>
          <span className="text-[13px] text-[var(--color-destructive)]">
            Connection failed. Please try again.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start group/bubble">
      <div className="max-w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2.5 relative">
        <p className="text-[11px] font-semibold tracking-[0.125px] text-[var(--color-primary)] mb-1.5">
          Notch
        </p>
        <MarkdownContent content={text} citations={citations} leftPaneRef={leftPaneRef} />

        {translated && (
          <div className="mt-2 pt-2 border-t border-[var(--color-hairline)]">
            <p className="text-[10px] font-medium text-[var(--color-ink-faint)] mb-1">
              Translation
            </p>
            <MarkdownContent content={translated} leftPaneRef={leftPaneRef} />
          </div>
        )}

        <div className="flex gap-3 mt-2 items-center flex-wrap">
          <button
            onClick={() => speak(text)}
            className="text-[11px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors"
          >
            {speaking ? 'Stop' : 'Read aloud'}
          </button>
          {showLanguageInput ? (
            <input
              ref={langInputRef}
              type="text"
              value={langValue}
              onChange={(e) => setLangValue(e.target.value)}
              onKeyDown={handleLangKeyDown}
              placeholder="Language (e.g. French)..."
              className="text-[11px] w-36 px-2 py-1 rounded border border-[var(--color-primary)] bg-[var(--color-surface)] text-[var(--color-ink)] outline-none"
            />
          ) : (
            onTranslate &&
            !translated && (
              <button
                onClick={onTranslate}
                disabled={isTranslating}
                className="text-[11px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
              >
                {isTranslating ? 'Translating\u2026' : 'Translate'}
              </button>
            )
          )}
          {onPin && (
            <button
              onClick={onPin}
              title={isPinned ? 'Unpin' : 'Pin answer'}
              className={cn(
                'ml-auto text-[11px] font-medium transition-colors opacity-0 group-hover/bubble:opacity-100',
                isPinned
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-ink-muted)] hover:text-[var(--color-primary)]',
              )}
            >
              {isPinned ? '📌 Pinned' : '📌 Pin'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ThinkingIndicator ─────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2.5">
        <span className="text-[13px] text-[var(--color-primary)] blink-cursor">
          Notch is thinking
        </span>
      </div>
    </div>
  );
}

// ── MessageList ───────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: Message[];
  isThinking: boolean;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
  starters: string[];
  onAsk: (question: string) => void;
  onTranslate: (index: number) => void;
  onTranslateSubmit: (index: number, language: string) => void;
  languageInputIndex: number | null;
}

function MessageList({
  messages,
  isThinking,
  leftPaneRef,
  starters,
  onAsk,
  onTranslate,
  onTranslateSubmit,
  languageInputIndex,
  onPin,
}: MessageListProps & { onPin: (id: string) => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col gap-3 flex-1 overflow-y-auto py-2">
      {messages.length === 0 && !isThinking && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[13px] text-[var(--color-ink-muted)] text-center">
            Ask anything about this document
          </p>
          {starters.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              {starters.map((q) => (
                <button
                  key={q}
                  onClick={() => onAsk(q)}
                  className="text-left text-[13px] text-[var(--color-ink)] rounded-md border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2 transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {messages.map((msg, i) =>
        msg.role === 'user' ? (
          <UserBubble key={msg.id} text={msg.text} />
        ) : (
          <NotchBubble
            key={msg.id}
            text={msg.text}
            citations={msg.citations}
            isError={msg.isError}
            translated={msg.translated}
            isTranslating={msg.isTranslating}
            leftPaneRef={leftPaneRef}
            showLanguageInput={languageInputIndex === i}
            onTranslate={() => onTranslate(i)}
            onTranslateSubmit={(language) => onTranslateSubmit(i, language)}
            onPin={() => onPin(msg.id)}
            isPinned={msg.pinned}
          />
        ),
      )}
      {isThinking && <ThinkingIndicator />}
      {!isThinking &&
        messages.length > 0 &&
        messages[messages.length - 1].role === 'assistant' &&
        !messages[messages.length - 1].isError && (
          <div className="flex flex-wrap gap-1.5">
            {[
              'Go deeper on that',
              'Give a concrete example',
              'Why does this matter?',
              'Summarize that in one line',
            ].map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      <div ref={bottomRef} />
    </div>
  );
}

interface SpeechRecognitionHandle {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function useVoiceInput(onTranscript: (t: string) => void) {
  const [listening, setListening] = useState(false);
  const recogRef = useRef<SpeechRecognitionHandle | null>(null);

  const available =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const start = useCallback(() => {
    if (!available || recogRef.current) return;
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionHandle;
      webkitSpeechRecognition?: new () => SpeechRecognitionHandle;
    };
    const Ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || 'en-US';
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results[0][0].transcript;
      onTranscript(text);
    };
    r.onend = () => {
      recogRef.current = null;
      setListening(false);
    };
    r.onerror = () => {
      recogRef.current = null;
      setListening(false);
    };
    recogRef.current = r;
    r.start();
    setListening(true);
  }, [available, onTranscript]);

  const stop = useCallback(() => {
    if (recogRef.current) {
      recogRef.current.stop();
      recogRef.current = null;
    }
    setListening(false);
  }, []);

  return available ? { listening, start, stop } : null;
}

// ── ChatInput ─────────────────────────────────────────────────────────────────

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  initialValue?: string;
}

function ChatInput({ onSubmit, disabled, initialValue }: ChatInputProps) {
  const [value, setValue] = useState(initialValue ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceInput((transcript) => {
    setValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
  });

  useEffect(() => {
    const id = setTimeout(() => {
      if (initialValue) setValue(initialValue);
    }, 0);
    return () => clearTimeout(id);
  }, [initialValue]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const trimmed = sanitizeUserInput(value).trim();
      if (trimmed && !disabled) {
        onSubmit(trimmed);
        setValue('');
      }
    }
  }

  return (
    <div className="shrink-0 border-t border-[var(--color-hairline)] pt-3">
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask about this document..."
          rows={1}
          className={cn(
            'w-full resize-none overflow-hidden text-[14px] pr-9',
            'min-h-0',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
        {/* CHAT-8: Voice input mic button */}
        {voice && (
          <button
            type="button"
            onClick={() => (voice.listening ? voice.stop() : voice.start())}
            disabled={disabled}
            title={voice.listening ? 'Stop recording' : 'Voice input'}
            className={cn(
              'absolute right-2 bottom-2 w-6 h-6 rounded-full flex items-center justify-center transition-all',
              voice.listening
                ? 'bg-red-500 text-white animate-pulse'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]',
              disabled && 'opacity-30 cursor-not-allowed',
            )}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm7 10a1 1 0 0 1 1 1 8 8 0 0 1-7 7.94V22h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.06A8 8 0 0 1 4 12a1 1 0 1 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1Z" />
            </svg>
          </button>
        )}
      </div>
      <p className="text-[11px] text-[var(--color-ink-faint)] mt-1.5">
        Enter to send · Shift+Enter for newline{voice ? ' · 🎤 voice' : ''}
      </p>
    </div>
  );
}

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export interface ChatPanelProps {
  doc: Document;
  prefillQuery?: string;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
  folderColor?: string;
  /** CHAT-1: all note IDs for library-scope chat */
  allDocIds?: string[];
}

function buildStarters(doc: Document): string[] {
  const starters: string[] = ['Summarize the key points'];

  const concept = doc.concepts?.[0]?.term;
  starters.push(
    concept ? `Explain "${concept}" in simple terms` : 'Explain this page in simple terms',
  );

  const entity = (doc.entities?.[0] ?? doc.keyEntities?.[0])?.name;
  starters.push(entity ? `What is ${entity} and why does it matter?` : "What's the main takeaway?");

  if (doc.timeline?.length) {
    const ev = doc.timeline[0];
    starters.push(`What happened during "${ev.description}" (${ev.date})?`);
  }

  return starters.slice(0, 4);
}

// CHAT-9: Glossary popup — extracts word from double-click and asks for definition
function useGlossaryClick(onAsk: (q: string) => void) {
  return useCallback(
    (_e: React.MouseEvent<HTMLDivElement>) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const word = selection.toString().trim();
      if (!word || word.length > 60 || word.includes('\n')) return;
      // Only trigger on very short selections (1-3 words) to avoid full-sentence selections
      const wordCount = word.split(/\s+/).length;
      if (wordCount > 3) return;
      selection.removeAllRanges();
      onAsk(`Define "${word}" in the context of this document. Be concise — 2-3 sentences.`);
    },
    [onAsk],
  );
}

export function ChatPanel({
  doc,
  prefillQuery,
  leftPaneRef,
  folderColor,
  allDocIds,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>('simple');
  // CHAT-1: library vs page scope
  const [scope, setScope] = useState<'page' | 'library'>('page');
  // CHAT-13: pinned section collapse
  const [pinnedExpanded, setPinnedExpanded] = useState(true);
  const [languageInputIndex, setLanguageInputIndex] = useState<number | null>(null);
  const starters = useMemo(() => buildStarters(doc), [doc]);

  const entityNames = useMemo(() => {
    const names = new Set<string>();
    for (const e of doc.entities ?? []) names.add(e.name);
    for (const e of doc.keyEntities ?? []) names.add(e.name);
    return Array.from(names).slice(0, 8);
  }, [doc]);

  const conceptTerms = useMemo(() => {
    return (doc.concepts ?? []).slice(0, 8).map((c) => c.term);
  }, [doc]);

  const timelineEvents = useMemo(() => {
    return (doc.timeline ?? []).slice(0, 5).map((ev) => ({
      date: ev.date,
      description: ev.description,
    }));
  }, [doc]);

  useEffect(() => {
    let cancelled = false;
    getChatMessagesByDocument(doc.id)
      .then((stored) => {
        if (cancelled) return;
        setMessages(
          stored.map((m, i) => ({
            id: `stored-${i}`,
            role: m.role,
            text: m.text,
            citations: m.citations,
            isError: m.isError,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [doc.id]);

  const handleSubmit = useCallback(
    (query: string) => {
      const userMsgId = `user-${Date.now()}`;
      setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: query }]);
      setIsThinking(true);

      // CHAT-1: for library scope, run against all docs (send first doc for now, repeat per doc)
      const targetDocId =
        scope === 'library' && allDocIds && allDocIds.length > 0
          ? allDocIds[0] // TODO: multi-doc RAG — for now query the first note
          : doc.id;

      browser.runtime
        .sendMessage({
          type: 'RAG_QUERY',
          payload: { documentId: targetDocId, query, readingLevel },
        })
        .then(
          (response: {
            type: string;
            payload?: { answer?: string; citations?: Citation[]; error?: string };
          }) => {
            setIsThinking(false);
            const assistantId = `asst-${Date.now()}`;
            if (response.type === 'RAG_ERROR') {
              setMessages((prev) => [
                ...prev,
                { id: assistantId, role: 'assistant', text: '', isError: true },
              ]);
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  id: assistantId,
                  role: 'assistant',
                  text: response.payload?.answer ?? '',
                  citations: response.payload?.citations,
                },
              ]);
            }
          },
        )
        .catch(() => {
          setIsThinking(false);
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: 'assistant', text: '', isError: true },
          ]);
        });
    },
    [doc.id, readingLevel, scope, allDocIds],
  );

  const handleTranslate = useCallback(
    (index: number, targetLanguage?: string) => {
      const target = messages[index];
      if (!target || target.role !== 'assistant' || !target.text) {
        setLanguageInputIndex(null);
        return;
      }

      if (!targetLanguage) {
        setLanguageInputIndex(index);
        return;
      }

      setMessages((prev) => prev.map((m, i) => (i === index ? { ...m, isTranslating: true } : m)));
      browser.runtime
        .sendMessage({
          type: 'TRANSLATE',
          payload: { text: target.text, targetLanguage },
        })
        .then((response: { type: string; payload?: { translated?: string; error?: string } }) => {
          setMessages((prev) =>
            prev.map((m, i) => {
              if (i !== index) return m;
              if (response.type === 'TRANSLATE_RESULT')
                return {
                  ...m,
                  isTranslating: false,
                  translated: response.payload?.translated ?? '',
                };
              return {
                ...m,
                isTranslating: false,
                translated: `(Translation failed: ${response.payload?.error ?? 'unknown'})`,
              };
            }),
          );
          setLanguageInputIndex(null);
        })
        .catch(() => {
          setMessages((prev) =>
            prev.map((m, i) =>
              i === index ? { ...m, isTranslating: false, translated: '(Translation failed)' } : m,
            ),
          );
          setLanguageInputIndex(null);
        });
    },
    [messages],
  );

  // CHAT-13: toggle pin on a message by id
  const handlePin = useCallback((id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, pinned: !m.pinned } : m)));
  }, []);

  // CHAT-9: double-click to define a term
  const handleGlossaryClick = useGlossaryClick(handleSubmit);

  const pinnedMessages = messages.filter((m) => m.pinned && m.role === 'assistant');

  return (
    <div className="flex flex-col min-h-[85vh] max-w-[80%] gap-3 p-2">
      {/* CHAT-13: Pinned answers panel */}
      {pinnedMessages.length > 0 && (
        <div className="shrink-0 rounded-lg border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-3 py-1.5 text-left"
            onClick={() => setPinnedExpanded((v) => !v)}
          >
            <span className="text-[11px] font-semibold text-[var(--color-primary)]">
              📌 {pinnedMessages.length} pinned answer{pinnedMessages.length > 1 ? 's' : ''}
            </span>
            <span className="text-[10px] text-[var(--color-ink-faint)]">
              {pinnedExpanded ? 'Hide' : 'Show'}
            </span>
          </button>
          {pinnedExpanded && (
            <div className="px-3 pb-2 flex flex-col gap-2">
              {pinnedMessages.map((m) => (
                <div
                  key={m.id}
                  className="text-[12px] text-[var(--color-ink)] border-t border-[var(--color-hairline)] pt-2 first:border-0 first:pt-0"
                >
                  <MarkdownContent
                    content={m.text.slice(0, 200) + (m.text.length > 200 ? '…' : '')}
                    leftPaneRef={leftPaneRef}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ContextPill title={doc.title} folderColor={folderColor} />

      {/* CHAT-1: scope + actions bar */}
      <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex items-center gap-2">
          <ActionBar onAction={handleSubmit} disabled={isThinking} />
          {/* Scope toggle */}
          {allDocIds && allDocIds.length > 1 && (
            <div
              className="flex shrink-0 rounded-md border border-[var(--color-hairline)] overflow-hidden"
              title="Chat scope"
            >
              {(['page', 'library'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={cn(
                    'text-[10px] font-medium px-2 py-1 transition-colors',
                    scope === s
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]',
                  )}
                >
                  {s === 'page' ? 'This note' : `All ${allDocIds.length} notes`}
                </button>
              ))}
            </div>
          )}
        </div>
        <ReadingLevelToggle level={readingLevel} onChange={setReadingLevel} />
      </div>

      {messages.length === 0 &&
        (entityNames.length > 0 || conceptTerms.length > 0 || timelineEvents.length > 0) && (
          <div className="flex flex-col gap-3 overflow-y-auto shrink-0 max-h-[40%]">
            <EntityShortcuts entities={entityNames} onAsk={handleSubmit} />
            <ConceptShortcuts concepts={conceptTerms} onAsk={handleSubmit} />
            <TimelineShortcuts events={timelineEvents} onAsk={handleSubmit} />
          </div>
        )}

      {/* CHAT-9: double-click a word to get a glossary definition */}
      <div onMouseUp={handleGlossaryClick} className="contents">
        <MessageList
          messages={messages}
          isThinking={isThinking}
          leftPaneRef={leftPaneRef}
          starters={starters}
          onAsk={handleSubmit}
          onTranslate={handleTranslate}
          onTranslateSubmit={(index, language) => handleTranslate(index, language)}
          languageInputIndex={languageInputIndex}
          onPin={handlePin}
        />
      </div>
      <ChatInput onSubmit={handleSubmit} disabled={isThinking} initialValue={prefillQuery} />
    </div>
  );
}
