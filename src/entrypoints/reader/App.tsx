import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Document, Folder } from '@/lib/types';
import { getDocument, getFolders } from '@/lib/storage';
import { downloadMarkdown, exportPDF } from '@/lib/export';
import { ReaderThemeContext, useReaderTheme, type ReaderTheme } from '@/lib/reader-theme';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChatPanel } from '@/components/ChatPanel';
import { EmptyState } from '@/components/EmptyState';
import { parseMarkdown } from '@/lib/markdown-parser';
import type { DocBlock } from '@/lib/markdown-parser';

// ── Tiptap document renderer ──────────────────────────────────────────────────
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { CodeBlockExtension } from '@/components/CodeBlockExtension';
import { marked } from 'marked';

/** Convert markdown → HTML string for Tiptap's parseHTML path */
function mdToHtml(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

const READER_THEME_STORAGE_KEY = 'notch:reader-theme';

function getInitialReaderTheme(): ReaderTheme {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(READER_THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

// ── Fallback renderer for unknown blocks ──────────────────────────────────────

interface FallbackRendererProps {
  block: DocBlock;
}

/** Renders unknown/unrecognised blocks as pre-formatted plain text (Req 1.3, 1.4) */
function FallbackRenderer({ block }: FallbackRendererProps) {
  return <pre className="font-mono text-sm text-muted whitespace-pre-wrap break-words border border-border p-3 my-2">{block.raw}</pre>;
}

interface DocumentRendererProps {
  content: string;
  onAskAI: (text: string) => void;
  leftPaneRef?: React.RefObject<HTMLDivElement | null>;
}

function DocumentRenderer({ content, onAskAI, leftPaneRef }: DocumentRendererProps) {
  const { theme } = useReaderTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  // Parse markdown into blocks using the safe parser (Req 1.3, 1.4, 1.5, 1.6, 1.7)
  const parseResult = useMemo(() => parseMarkdown(content ?? ''), [content]);

  // Build the markdown for known blocks to feed into TipTap (exclude unknown blocks)
  const knownBlocksMarkdown = useMemo(
    () => parseResult.blocks.filter(b => b.type !== 'unknown').map(b => b.raw).join('\n\n'),
    [parseResult.blocks]
  );

  // Collect unknown blocks for fallback rendering
  const unknownBlocks = useMemo(
    () => parseResult.blocks.filter(b => b.type === 'unknown'),
    [parseResult.blocks]
  );

  const proseClass = theme === 'light'
    ? 'prose max-w-none font-mono text-base leading-relaxed text-foreground focus:outline-none'
    : 'prose prose-invert max-w-none font-mono text-base leading-relaxed text-foreground focus:outline-none';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false, link: false }),
      Highlight.configure({ multicolor: false }),
      CodeBlockExtension,
      Image.configure({ inline: false }),
      Link.configure({ openOnClick: true }),
    ],
    content: knownBlocksMarkdown ? mdToHtml(knownBlocksMarkdown) : '',
    editorProps: {
      attributes: { class: proseClass },
    },
    editable: false,
  });

  // Re-apply prose class when theme changes
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({ editorProps: { attributes: { class: proseClass } } });
  }, [editor, theme, proseClass]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setContent(knownBlocksMarkdown ? mdToHtml(knownBlocksMarkdown) : '');
  }, [editor, knownBlocksMarkdown]);

  // Assign data-paragraph-index (legacy) and data-paragraph-id (stable hash) to each <p> (Req 1.7, 11.x)
  useEffect(() => {
    const root = leftPaneRef?.current ?? containerRef.current;
    if (!root) return;
    const paragraphs = root.querySelectorAll('p');

    // Build a map from paragraph index to paragraphId from parsed blocks
    const paragraphBlocks = parseResult.blocks.filter(b => b.type === 'paragraph');

    paragraphs.forEach((p, index) => {
      p.setAttribute('data-paragraph-index', String(index));
      const block = paragraphBlocks[index];
      if (block?.paragraphId) {
        p.setAttribute('data-paragraph-id', block.paragraphId);
      }
    });
  }, [editor, content, leftPaneRef, parseResult.blocks]);

  // Selection tooltip
  useEffect(() => {
    function onMouseUp() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!text || !containerRef.current) { setTooltip(null); return; }
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setTooltip({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
        text,
      });
    }
    function onMouseDown(e: MouseEvent) {
      // hide tooltip if clicking outside it
      const target = e.target as HTMLElement;
      if (!target.closest('[data-selection-tooltip]')) setTooltip(null);
    }
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      {tooltip && (
        <div
          data-selection-tooltip
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          className="absolute z-50 flex gap-0 bg-surface border border-border"
        >
          <button
            onClick={() => { editor?.chain().focus().toggleHighlight().run(); setTooltip(null); }}
            className="font-mono font-semibold text-[10px] uppercase tracking-wider px-2 py-1 text-muted hover:text-foreground transition-colors"
          >
            [HIGHLIGHT]
          </button>
          <Separator orientation="vertical" className="bg-border" />
          <button
            onClick={() => { onAskAI(tooltip.text); setTooltip(null); }}
            className="font-mono font-semibold text-[10px] uppercase tracking-wider px-2 py-1 text-primary hover:text-foreground transition-colors"
          >
            [ASK AI]
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
      {/* Render fallback blocks for any unknown block types (Req 1.3, 1.4) */}
      {unknownBlocks.map((block, i) => (
        <FallbackRenderer key={i} block={block} />
      ))}
    </div>
  );
}

// ── Export menu ───────────────────────────────────────────────────────────────
function ExportMenu({ onExportMd, onExportPdf }: { onExportMd?: () => void; onExportPdf?: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onExportMd}
        className="font-mono font-semibold text-[11px] uppercase tracking-wider text-muted border border-border px-2.5 py-1 hover:text-foreground hover:border-foreground transition-colors"
      >
        [EXPORT .MD]
      </button>
      <button
        onClick={onExportPdf}
        className="font-mono font-semibold text-[11px] uppercase tracking-wider text-muted border border-border px-2.5 py-1 hover:text-foreground hover:border-foreground transition-colors"
      >
        [EXPORT PDF]
      </button>
    </div>
  );
}

// ── Reader top bar ────────────────────────────────────────────────────────────
interface ReaderTopBarProps {
  title: string;
  activeTab: 'notes' | 'chat';
  onTabChange: (t: 'notes' | 'chat') => void;
  onExportMd?: () => void;
  onExportPdf?: () => void;
  folderName?: string;
  folderColor?: string;
}

function ReaderTopBar({ title, activeTab, onTabChange, onExportMd, onExportPdf, folderName, folderColor }: ReaderTopBarProps) {
  const { theme, toggleTheme } = useReaderTheme();

  return (
    <div className="h-12 bg-background border-b border-border flex items-center justify-between px-6 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') })}
          className="font-mono text-xs uppercase tracking-wider text-muted hover:text-foreground transition-colors shrink-0"
        >
          LIBRARY
        </button>
        {folderName && (
          <>
            <span className="font-mono text-xs text-muted shrink-0">/</span>
            <span
              className="font-mono text-xs uppercase tracking-wider shrink-0 flex items-center gap-1.5"
              style={folderColor ? { color: folderColor } : undefined}
            >
              {folderColor && (
                <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: folderColor }} />
              )}
              {folderName}
            </span>
          </>
        )}
        <span className="font-mono text-xs text-muted shrink-0">/</span>
        <span className="font-mono text-xs uppercase tracking-wider text-foreground truncate min-w-0">
          {title}
        </span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 shrink-0 mx-6">
        {(['notes', 'chat'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              'font-mono font-semibold text-[11px] uppercase tracking-wider px-3 py-1 transition-colors',
              activeTab === tab
                ? 'border-2 border-primary text-primary'
                : 'border-2 border-transparent text-muted hover:text-foreground'
            )}
          >
            [{tab}]
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="font-mono font-semibold text-[11px] uppercase tracking-wider text-muted border border-border px-2.5 py-1 hover:text-foreground hover:border-foreground transition-colors"
        >
          {theme === 'dark' ? '[☀ LIGHT]' : '[☾ DARK]'}
        </button>
        <ExportMenu onExportMd={onExportMd} onExportPdf={onExportPdf} />
      </div>
    </div>
  );
}

// ── Notes panel ───────────────────────────────────────────────────────────────
interface NotesPanelProps {
  doc: Document;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
}

function scrollToAndHighlight(leftPaneRef: React.RefObject<HTMLDivElement | null>, paragraphIndex: number) {
  const root = leftPaneRef.current;
  if (!root) return;
  const el = root.querySelector<HTMLElement>(`[data-paragraph-index="${paragraphIndex}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.background = 'var(--color-highlight)';
  setTimeout(() => { el.style.background = ''; }, 2000);
}

function NotesPanel({ doc, leftPaneRef }: NotesPanelProps) {
  const keyPoints = doc.keyPoints ?? [];
  const isEmpty = doc.summary === '' && keyPoints.length === 0 && doc.keyEntities.length === 0 && doc.timeline.length === 0 && doc.concepts.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="border border-border p-3">
        <p className="font-mono font-semibold text-[10px] uppercase tracking-widest text-muted mb-2">SUMMARY</p>
        {doc.summary
          ? <p className="font-mono text-sm text-foreground leading-relaxed">{doc.summary}</p>
          : <p className="font-mono text-[11px] text-muted">[NO SUMMARY AVAILABLE]</p>
        }
      </div>

      {/* Key points */}
      <div className="border border-border p-3">
        <p className="font-mono font-semibold text-[10px] uppercase tracking-widest text-muted mb-2">KEY POINTS</p>
        {keyPoints.length > 0
          ? (
            <div className="flex flex-col gap-1.5">
              {keyPoints.map((point, i) => (
                <p key={i} className="font-mono text-[11px] text-foreground leading-relaxed">
                  - {point}
                </p>
              ))}
            </div>
          )
          : <p className="font-mono text-[11px] text-muted">[NO KEY POINTS FOUND]</p>
        }
      </div>

      {/* Key entities */}
      <div className="border border-border p-3">
        <p className="font-mono font-semibold text-[10px] uppercase tracking-widest text-muted mb-2">KEY ENTITIES</p>
        {doc.keyEntities.length > 0
          ? (
            <div className="flex flex-col gap-1.5">
              {doc.keyEntities.map((e, i) => (
                <button
                  key={i}
                  onClick={() => scrollToAndHighlight(leftPaneRef, e.paragraphIndex)}
                  className="flex items-start gap-2 text-left hover:opacity-70 transition-opacity cursor-pointer"
                >
                  <Badge variant="outline" className="font-mono text-[9px] uppercase border-border text-muted shrink-0">
                    {e.type}
                  </Badge>
                  <span className="font-mono text-[11px] text-foreground">{e.name}</span>
                </button>
              ))}
            </div>
          )
          : <p className="font-mono text-[11px] text-muted">[NO ENTITIES FOUND]</p>
        }
      </div>

      {/* Timeline */}
      <div className="border border-border p-3">
        <p className="font-mono font-semibold text-[10px] uppercase tracking-widest text-muted mb-2">TIMELINE</p>
        {doc.timeline.length > 0
          ? (
            <div className="flex flex-col gap-2">
              {doc.timeline.map((t, i) => (
                <button
                  key={i}
                  onClick={() => scrollToAndHighlight(leftPaneRef, t.paragraphIndex)}
                  className="text-left hover:opacity-70 transition-opacity cursor-pointer"
                >
                  <p className="font-mono text-[10px] text-primary uppercase">{t.date}</p>
                  <p className="font-mono text-[11px] text-foreground">{t.description}</p>
                </button>
              ))}
            </div>
          )
          : <p className="font-mono text-[11px] text-muted">[NO TIMELINE EVENTS]</p>
        }
      </div>

      {/* Concepts */}
      <div className="border border-border p-3">
        <p className="font-mono font-semibold text-[10px] uppercase tracking-widest text-muted mb-2">CONCEPTS</p>
        {doc.concepts.length > 0
          ? (
            <div className="flex flex-col gap-2">
              {doc.concepts.map((c, i) => (
                <button
                  key={i}
                  onClick={() => scrollToAndHighlight(leftPaneRef, c.paragraphIndex)}
                  className="text-left hover:opacity-70 transition-opacity cursor-pointer"
                >
                  <p className="font-mono text-[11px] font-semibold text-foreground uppercase">{c.term}</p>
                  <p className="font-mono text-[10px] text-muted leading-relaxed">{c.definition}</p>
                </button>
              ))}
            </div>
          )
          : <p className="font-mono text-[11px] text-muted">[NO CONCEPTS FOUND]</p>
        }
      </div>

      {isEmpty && (
        <p className="font-mono text-[11px] text-muted text-center">[NOTES WILL POPULATE AFTER CAPTURE]</p>
      )}
    </div>
  );
}

// ChatPanel is implemented in src/components/ChatPanel.tsx

// ── Root ──────────────────────────────────────────────────────────────────────
export default function ReaderApp() {
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'chat'>('notes');
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();
  const [theme, setTheme] = useState<ReaderTheme>(getInitialReaderTheme);
  const [folder, setFolder] = useState<Folder | null>(null);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);

  const toggleTheme = useCallback(() => {
    setTheme((current) => current === 'dark' ? 'light' : 'dark');
  }, []);

  const themeContextValue = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, toggleTheme]
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('documentId');
    if (!id) { setError('No document ID provided.'); setLoading(false); return; }
    Promise.all([getDocument(id), getFolders()]).then(([result, folders]) => {
      if (!result) setError(`Document not found: ${id}`);
      else {
        setDoc(result);
        if (result.folder) {
          const f = folders.find(f => f.id === result.folder) ?? null;
          setFolder(f);
        }
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
    window.localStorage.setItem(READER_THEME_STORAGE_KEY, theme);
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setActiveTab('chat');
      }
      if (e.key === 'Escape' && activeTab === 'chat') {
        setActiveTab('notes');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTab]);

  function handleAskAI(text: string) {
    setChatPrefill(text);
    setActiveTab('chat');
  }

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <span className="font-mono font-semibold text-xs uppercase tracking-wider text-primary capture-loading">
          LOADING...
        </span>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="h-screen bg-background flex flex-col items-center justify-center gap-4">
        <span className="font-mono font-semibold text-xs uppercase tracking-wider text-danger">
          DOCUMENT NOT FOUND
        </span>
        {error && <span className="font-mono text-[11px] text-muted">{error}</span>}
        <button
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') })}
          className="btn btn-primary mt-2"
        >
          ← BACK TO LIBRARY
        </button>
      </div>
    );
  }

  return (
    <ReaderThemeContext.Provider value={themeContextValue}>
      <TooltipProvider>
        <div data-theme={theme} className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
        <ReaderTopBar
          title={doc.title}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExportMd={() => downloadMarkdown(doc)}
          onExportPdf={() => exportPDF(doc, { sourceElement: exportContentRef.current, theme })}
          folderName={folder?.name}
          folderColor={folder?.color}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Left pane — 70%, scrollable, theme-aware */}
          <div
            ref={leftPaneRef}
            className={cn(
              'flex-7 border-r border-border overflow-y-auto transition-colors duration-200',
              theme === 'light' ? 'bg-[#f8f0df] text-foreground' : 'bg-background text-foreground'
            )}
          >
            <div ref={exportContentRef} className="px-10 py-8">
              <h1 className={cn(
                'font-mono font-bold text-4xl mb-4 leading-tight',
                theme === 'light' ? 'text-[#2a211a]' : 'text-foreground'
              )}>
                {doc.title}
              </h1>
              <div className="flex gap-4 items-center mb-8">
                <span className="font-mono text-[11px] text-muted uppercase">{doc.domain}</span>
                <span className="font-mono text-[11px] text-muted">{doc.wordCount} words</span>
                <span className="font-mono text-[11px] text-muted">{doc.capturedAt.slice(0, 10)}</span>
                {doc.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="font-mono text-[9px] uppercase border-border text-muted">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Separator className="bg-border mb-8" />
              {/* Req 6.2 — no embeddings yet */}
              {!doc.embeddingsGenerated && (
                <EmptyState
                  message="No embeddings yet"
                  action={{
                    label: 'Generate Embeddings',
                    onClick: () => {
                      browser.runtime.sendMessage({ type: 'GENERATE_EMBEDDINGS', payload: { documentId: doc.id } })
                        .catch(() => {/* fire and forget */});
                    },
                  }}
                  className="mb-6"
                />
              )}
              {/* Req 6.3 — parse failed (all blocks unknown) */}
              {(() => {
                const parseResult = doc.content ? (() => { try { return parseMarkdown(doc.content); } catch { return null; } })() : null;
                const parseFailed = parseResult !== null && parseResult.blocks.length > 0 && parseResult.blocks.every(b => b.type === 'unknown');
                if (!parseFailed) return null;
                return (
                  <EmptyState
                    message="Reader parse failed"
                    action={{
                      label: 'View Raw Markdown',
                      onClick: () => setShowRawMarkdown(v => !v),
                    }}
                    className="mb-6"
                  />
                );
              })()}
              {showRawMarkdown ? (
                <pre className="font-mono text-xs text-muted whitespace-pre-wrap break-words border border-border p-4">
                  {doc.content}
                </pre>
              ) : (
                <DocumentRenderer
                  content={doc.content}
                  onAskAI={handleAskAI}
                  leftPaneRef={leftPaneRef}
                />
              )}
            </div>
          </div>

          {/* Right pane — 30%, sticky */}
          <div className="flex-3 flex flex-col overflow-hidden sticky top-0 self-start h-[calc(100vh-3rem)] bg-background text-foreground">
            <ScrollArea className="flex-1 p-6">
              {activeTab === 'notes'
                ? <NotesPanel doc={doc} leftPaneRef={leftPaneRef} />
                : <ChatPanel doc={doc} prefillQuery={chatPrefill} leftPaneRef={leftPaneRef} folderColor={folder?.color} />
              }
            </ScrollArea>
          </div>
        </div>
        </div>
      </TooltipProvider>
    </ReaderThemeContext.Provider>
  );
}
