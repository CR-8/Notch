import { useState, useEffect, useCallback, useMemo } from 'react';
import { browser } from 'wxt/browser';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import { getChatMessagesByDocument } from '@/lib/idb';
import type { Document, Citation } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { sanitizeUserInput, sanitizeHtml, ReassemblyBuffer } from '@/lib/sanitize';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  text: string;
  citations?: Citation[];
  isError?: boolean;
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
  el.style.background = 'var(--color-highlight)';
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
    el.style.background = 'var(--color-highlight)';
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
      className="inline font-mono text-[10px] font-semibold text-primary hover:opacity-70 transition-opacity cursor-pointer px-0.5"
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
          className="prose prose-invert prose-sm max-w-none font-mono [&>p]:mb-2 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:my-1 [&>ul]:pl-4 [&>ul]:list-disc [&>li]:mb-0.5 [&>ol]:my-1 [&>ol]:pl-4 [&>ol]:list-decimal [&>code]:bg-surface [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>pre]:bg-surface [&>pre]:p-2 [&>pre]:overflow-x-auto [&>pre]:text-xs [&>blockquote]:border-l-2 [&>blockquote]:border-primary [&>blockquote]:pl-3 [&>blockquote]:italic"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(markedHtml) }}
        />
      );
    }

    return (
      <div className="text-sm leading-relaxed space-y-1">
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
        className="prose prose-invert prose-sm max-w-none font-mono [&>p]:mb-2 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:mt-4 [&>h1]:mb-2 [&>h2]:text-base [&>h2]:font-semibold [&>h2]:mt-3 [&>h2]:mb-1 [&>ul]:my-1 [&>ul]:pl-4 [&>ul]:list-disc [&>li]:mb-0.5 [&>ol]:my-1 [&>ol]:pl-4 [&>ol]:list-decimal [&>code]:bg-surface [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded [&>pre]:bg-surface [&>pre]:p-2 [&>pre]:overflow-x-auto [&>pre]:text-xs [&>blockquote]:border-l-2 [&>blockquote]:border-primary [&>blockquote]:pl-3 [&>blockquote]:italic"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  // Plain text fallback
  return (
    <p className="font-mono text-sm text-foreground leading-relaxed whitespace-pre-wrap">
      {content}
    </p>
  );
}

// ── ContextPill ───────────────────────────────────────────────────────────────

function ContextPill({ title, folderColor }: { title: string; folderColor?: string }) {
  return (
    <div className="border border-border px-7 py-2 shrink-0 flex items-center gap-2">
      {folderColor && (
        <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: folderColor }} />
      )}
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">CHATTING WITH: </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-foreground truncate">{title}</span>
    </div>
  );
}

// ── UserBubble ────────────────────────────────────────────────────────────────

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] bg-surface border border-border px-3 py-2">
        <p className="font-mono text-sm text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

// ── NotchBubble ───────────────────────────────────────────────────────────────

interface NotchBubbleProps {
  text: string;
  citations?: Citation[];
  isError?: boolean;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
}

function NotchBubble({ text, citations, isError, leftPaneRef }: NotchBubbleProps) {
  const content = isError
    ? <span className="font-mono text-[11px] text-danger">[CONNECTION FAILED]</span>
    : (
      <MarkdownContent content={text} citations={citations} leftPaneRef={leftPaneRef} />
    );

  return (
    <div className="flex justify-start">
      <div className="max-w-full border border-border px-3 py-2">
        <p className="font-mono text-[9px] uppercase tracking-widest text-primary mb-1.5">NOTCH</p>
        {content}
      </div>
    </div>
  );
}

// ── ThinkingIndicator ─────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="border border-border px-3 py-2">
        <span className="font-mono text-[11px] text-primary uppercase tracking-wider blink-cursor">
          [NOTCH IS THINKING
        </span>
        <span className="font-mono text-[11px] text-primary uppercase tracking-wider ml-1">]</span>
      </div>
    </div>
  );
}

// ── MessageList ───────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: Message[];
  isThinking: boolean;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
}

function MessageList({ messages, isThinking, leftPaneRef }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  return (
    <div className="flex flex-col gap-3 flex-1 overflow-y-auto py-2">
      {messages.length === 0 && !isThinking && (
        <p className="font-mono text-[11px] text-muted text-center mt-4">
          [ASK ANYTHING ABOUT THIS DOCUMENT]
        </p>
      )}
      {messages.map((msg, i) =>
        msg.role === 'user'
          ? <UserBubble key={i} text={msg.text} />
          : <NotchBubble key={i} text={msg.text} citations={msg.citations} isError={msg.isError} leftPaneRef={leftPaneRef} />
      )}
      {isThinking && <ThinkingIndicator />}
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
    <div className="shrink-0 border-t border-border pt-3">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="ASK ABOUT THIS DOCUMENT..."
        rows={1}
        className={cn(
          'w-full resize-none overflow-hidden font-mono text-[11px] uppercase tracking-wider',
          'bg-surface border-border text-foreground placeholder:text-muted',
          'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-primary',
          'min-h-0 py-2 px-3',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      />
      <p className="font-mono text-[9px] text-muted mt-1">
        ENTER TO SEND · SHIFT+ENTER FOR NEWLINE
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

export function ChatPanel({ doc, prefillQuery, leftPaneRef, folderColor }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);

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
        payload: { documentId: doc.id, query: query },
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
  }, [doc.id]);

  return (
    <div className="flex flex-col h-full gap-3">
      <ContextPill title={doc.title} folderColor={folderColor} />
      <MessageList messages={messages} isThinking={isThinking} leftPaneRef={leftPaneRef} />
      <ChatInput onSubmit={handleSubmit} disabled={isThinking} initialValue={prefillQuery} />
    </div>
  );
}
