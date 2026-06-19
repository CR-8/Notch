import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { browser } from 'wxt/browser';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import { getChatMessagesByDocument } from '@/lib/idb';
import type { Document, Citation, ReadingLevel } from '@/lib/types';
import { languageName, FOLLOW_UPS } from '@/lib/chat-actions';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeUserInput, sanitizeHtml, ReassemblyBuffer } from '@/lib/sanitize';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  isError?: boolean;
  translated?: string;
  isTranslating?: boolean;
}

// ── Citation scroll-linking helpers ──────────────────────────────────────────

function scrollToAndHighlightCitation(
  leftPaneRef: React.RefObject<HTMLDivElement | null>,
  paragraphIndex: number,
  scroll: boolean
) {
  const root = leftPaneRef.current;
  if (!root) return;
  const el = root.querySelector<HTMLElement>(`[data-paragraph-index="${paragraphIndex}"]`);
  if (!el) return;
  if (scroll) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  el.style.background = 'rgba(0, 117, 222, 0.1)';
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
    // Remove any hover highlight first
    clearCitationHighlight(highlightedElRef.current);
    highlightedElRef.current = null;
    // Scroll + highlight for 2s
    const root = leftPaneRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-paragraph-index="${citation.paragraphIndex}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.background = 'rgba(0, 117, 222, 0.1)';
    setTimeout(() => { el.style.background = ''; }, 2000);
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
  leftPaneRef: React.RefObject<HTMLDivElement | null>
): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const n = parseInt(match[1], 10);
      const citation = citations[n - 1];
      if (citation) {
        return (
          <CitationChip key={i} n={n} citation={citation} leftPaneRef={leftPaneRef} />
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Markdown Renderer ─────────────────────────────────────────────────────────

function renderMarkdownToHtml(markdown: string): string {
  const rawHtml = marked.parse(markdown, { async: false }) as string;
  return sanitizeHtml(rawHtml);
}

interface MarkdownContentProps {
  content: string;
  citations?: Citation[];
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
}

function MarkdownContent({ content, citations, leftPaneRef }: MarkdownContentProps) {
  const html = useMemo(() => renderMarkdownToHtml(content), [content]);

  // If there are citations, parse them separately and wrap the content
  if (citations && citations.length > 0) {
    const partsWithCitations = parseAnswerWithCitations(content, citations, leftPaneRef);
    // Convert parsed React nodes back to text for markdown rendering
    const textOnly = partsWithCitations.map(p =>
      typeof p === 'string' ? p : ''
    ).join('');

    // Check if content has markdown formatting
    const hasMarkdown = /^[#*`>\-]/.test(content.trim()) ||
      content.includes('\n') && (content.includes('**') || content.includes('`') || content.includes('- '));

    if (hasMarkdown) {
      const markedHtml = marked.parse(textOnly, { async: false }) as string;
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

  // Check if content has markdown formatting
  const hasMarkdown = /^[#*`>\-]/.test(content.trim()) ||
    content.includes('\n') && (content.includes('**') || content.includes('`') || content.includes('- '));

  if (hasMarkdown) {
    return (
      <div
        className="notion-prose text-[14px] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Plain text fallback
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
        <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: folderColor }} />
      )}
      <span className="text-[11px] font-medium text-[var(--color-ink-muted)] shrink-0">Chatting with</span>
      <span className="text-[12px] font-medium text-[var(--color-ink)] truncate">{title}</span>
    </div>
  );
}

// ── ActionBar (CHAT-3 one-click actions) ──────────────────────────────────────

const QUICK_ACTIONS: Array<{ label: string; prompt: string }> = [
  { label: 'Summarize', prompt: 'Summarize this document in a few clear sentences.' },
  { label: 'Explain simply', prompt: 'Explain this document in simple, plain language a non-expert can follow.' },
  { label: 'Key terms', prompt: 'List and briefly define the key terms in this document.' },
  { label: "What's the evidence", prompt: 'What evidence or sources does this document give for its main claims?' },
];

function ActionBar({ onAction, disabled }: { onAction: (prompt: string) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5 shrink-0">
      {QUICK_ACTIONS.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.prompt)}
          disabled={disabled}
          className="text-[12px] font-medium px-3 py-1 rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-ink-muted)] transition-all hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ── ReadingLevelToggle (CHAT-5) ───────────────────────────────────────────────

function ReadingLevelToggle({ level, onChange }: { level: ReadingLevel; onChange: (l: ReadingLevel) => void }) {
  const opts: Array<{ value: ReadingLevel; label: string }> = [
    { value: 'simple', label: 'Simple' },
    { value: 'technical', label: 'Technical' },
  ];
  return (
    <div className="flex shrink-0 rounded-md border border-[var(--color-hairline)] overflow-hidden" title="Reading level">
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'text-[11px] font-medium px-2 py-1 transition-colors',
            level === o.value
              ? 'bg-[var(--color-primary)] text-white'
              : 'bg-[var(--color-surface)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
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
        <p className="text-[14px] text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

// ── NotchBubble ───────────────────────────────────────────────────────────────

interface NotchBubbleProps {
  text: string;
  citations?: Citation[];
  isError?: boolean;
  translated?: string;
  isTranslating?: boolean;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
  onTranslate?: () => void;
}

// CHAT-7 read-aloud via the browser speech-synthesis engine (fully local).
function useReadAloud() {
  const [speaking, setSpeaking] = useState(false);
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utter = new SpeechSynthesisUtterance(text);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utter);
  }, []);
  return { speaking, speak };
}

function NotchBubble({ text, citations, isError, translated, isTranslating, leftPaneRef, onTranslate }: NotchBubbleProps) {
  const { speaking, speak } = useReadAloud();
  const canSpeak = typeof window !== 'undefined' && !!window.speechSynthesis;

  if (isError) {
    return (
      <div className="flex justify-start">
        <div className="max-w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-[0.125px] text-[var(--color-primary)] mb-1.5">Notch</p>
          <span className="text-[13px] text-[var(--color-destructive)]">Connection failed. Please try again.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-2.5">
        <p className="text-[11px] font-semibold tracking-[0.125px] text-[var(--color-primary)] mb-1.5">Notch</p>
        <MarkdownContent content={text} citations={citations} leftPaneRef={leftPaneRef} />

        {translated && (
          <div className="mt-2 pt-2 border-t border-[var(--color-hairline)]">
            <p className="text-[10px] font-medium text-[var(--color-ink-faint)] mb-1">Translation</p>
            <MarkdownContent content={translated} leftPaneRef={leftPaneRef} />
          </div>
        )}

        <div className="flex gap-3 mt-2">
          {canSpeak && (
            <button
              onClick={() => speak(text)}
              className="text-[11px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors"
            >
              {speaking ? 'Stop' : 'Read aloud'}
            </button>
          )}
          {onTranslate && !translated && (
            <button
              onClick={onTranslate}
              disabled={isTranslating}
              className="text-[11px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors disabled:opacity-50"
            >
              {isTranslating ? 'Translating…' : 'Translate'}
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
}

function MessageList({ messages, isThinking, leftPaneRef, starters, onAsk, onTranslate }: MessageListProps) {
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
        msg.role === 'user'
          ? <UserBubble key={i} text={msg.text} />
          : <NotchBubble
              key={i}
              text={msg.text}
              citations={msg.citations}
              isError={msg.isError}
              translated={msg.translated}
              isTranslating={msg.isTranslating}
              leftPaneRef={leftPaneRef}
              onTranslate={() => onTranslate(i)}
            />
      )}
      {isThinking && <ThinkingIndicator />}
      {!isThinking && messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !messages[messages.length - 1].isError && (
        <div className="flex flex-wrap gap-1.5">
          {FOLLOW_UPS.map((q) => (
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

// ── ChatInput ─────────────────────────────────────────────────────────────────

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  initialValue?: string;
}

function ChatInput({ onSubmit, disabled, initialValue }: ChatInputProps) {
  const [value, setValue] = useState(initialValue ?? '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pre-fill on mount if initialValue provided
  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Sanitize user input before submission
      const trimmed = sanitizeUserInput(value).trim();
      if (trimmed && !disabled) {
        onSubmit(trimmed);
        setValue('');
      }
    }
  }

  return (
    <div className="shrink-0 border-t border-[var(--color-hairline)] pt-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask about this document..."
        rows={1}
        className={cn(
          'w-full resize-none overflow-hidden text-[14px]',
          'min-h-0',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      <p className="text-[11px] text-[var(--color-ink-faint)] mt-1.5">
        Enter to send · Shift+Enter for newline
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
}

// Page-specific starter questions (CHAT-2) — derived from the document's own
// structure so they need no extra model call and work fully offline.
function buildStarters(doc: Document): string[] {
  const starters: string[] = ['Summarize the key points'];

  const concept = doc.concepts?.[0]?.term;
  starters.push(concept ? `Explain "${concept}" in simple terms` : 'Explain this page in simple terms');

  const entity = (doc.entities?.[0] ?? doc.keyEntities?.[0])?.name;
  starters.push(entity ? `What is ${entity} and why does it matter?` : "What's the main takeaway?");

  return starters.slice(0, 3);
}

export function ChatPanel({ doc, prefillQuery, leftPaneRef, folderColor }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [readingLevel, setReadingLevel] = useState<ReadingLevel>('simple');
  const starters = useMemo(() => buildStarters(doc), [doc]);

  useEffect(() => {
    let cancelled = false;
    getChatMessagesByDocument(doc.id)
      .then((stored) => {
        if (cancelled) return;
        setMessages(stored.map((m) => ({
          role: m.role,
          text: m.text,
          citations: m.citations,
          isError: m.isError,
        })));
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [doc.id]);

  const handleSubmit = useCallback(async (query: string) => {
    setMessages((prev) => [...prev, { role: 'user', text: query }]);
    setIsThinking(true);

    try {
      const response = await browser.runtime.sendMessage({
        type: 'RAG_QUERY',
        payload: { documentId: doc.id, query, readingLevel },
      }) as { type: 'RAG_RESPONSE'; payload: { answer: string; citations: Citation[] } }
        | { type: 'RAG_ERROR'; payload: { error: string } };

      setIsThinking(false);

      if (response.type === 'RAG_ERROR') {
        setMessages((prev) => [...prev, { role: 'assistant', text: '', isError: true }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: response.payload.answer, citations: response.payload.citations },
        ]);
      }
    } catch {
      setIsThinking(false);
      setMessages((prev) => [...prev, { role: 'assistant', text: '', isError: true }]);
    }
  }, [doc.id, readingLevel]);

  // CHAT-6: translate a single assistant message into the user's browser language.
  const handleTranslate = useCallback(async (index: number) => {
    const target = messages[index];
    if (!target || target.role !== 'assistant' || !target.text) return;
    const targetLanguage = languageName(navigator.language || 'en');

    setMessages((prev) => prev.map((m, i) => i === index ? { ...m, isTranslating: true } : m));
    try {
      const response = await browser.runtime.sendMessage({
        type: 'TRANSLATE',
        payload: { text: target.text, targetLanguage },
      }) as { type: 'TRANSLATE_RESULT'; payload: { translated: string } }
        | { type: 'TRANSLATE_ERROR'; payload: { error: string } };

      setMessages((prev) => prev.map((m, i) => {
        if (i !== index) return m;
        if (response.type === 'TRANSLATE_RESULT') return { ...m, isTranslating: false, translated: response.payload.translated };
        return { ...m, isTranslating: false, translated: `(Translation failed: ${response.payload.error})` };
      }));
    } catch (e) {
      setMessages((prev) => prev.map((m, i) => i === index ? { ...m, isTranslating: false, translated: `(Translation failed: ${(e as Error).message})` } : m));
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full gap-3">
      <ContextPill title={doc.title} folderColor={folderColor} />
      <div className="flex items-center justify-between gap-2 shrink-0">
        <ActionBar onAction={handleSubmit} disabled={isThinking} />
        <ReadingLevelToggle level={readingLevel} onChange={setReadingLevel} />
      </div>
      <MessageList
        messages={messages}
        isThinking={isThinking}
        leftPaneRef={leftPaneRef}
        starters={starters}
        onAsk={handleSubmit}
        onTranslate={handleTranslate}
      />
      <ChatInput onSubmit={handleSubmit} disabled={isThinking} initialValue={prefillQuery} />
    </div>
  );
}
