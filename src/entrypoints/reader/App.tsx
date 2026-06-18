import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { Document, Folder, DocumentHighlight } from '@/lib/types';
import { getDocument, getFolders, getAppearance } from '@/lib/storage';
import { downloadMarkdown, exportPDF } from '@/lib/export';
import { getHighlightsByDocument, saveHighlight } from '@/lib/idb';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChatPanel } from '@/components/ChatPanel';
import { EmptyState } from '@/components/EmptyState';
import { parseMarkdown } from '@/lib/markdown-parser';
import type { DocBlock } from '@/lib/markdown-parser';
import { sanitizeHtml, sanitizeUrl } from '@/lib/sanitize';
import type { AppearanceSettings } from '@/lib/types';

// ── Marked-based document renderer ────────────────────────────────────────────
import { marked } from 'marked';

/** Configure marked for security and proper rendering */
marked.setOptions({
  gfm: true,
  breaks: false,
});

/** Convert markdown → sanitized HTML string */
function mdToHtml(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(rawHtml);
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
  resolvedTheme: 'dark' | 'light';
  documentId: string;
  highlights: DocumentHighlight[];
}

function DocumentRenderer({ content, onAskAI, leftPaneRef, resolvedTheme, documentId, highlights }: DocumentRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; paragraphIndex?: number } | null>(null);

  // Parse markdown into blocks using the safe parser
  const parseResult = useMemo(() => parseMarkdown(content ?? ''), [content]);

  // Build markdown for known blocks (exclude unknown blocks)
  const knownBlocksMarkdown = useMemo(
    () => parseResult.blocks.filter(b => b.type !== 'unknown').map(b => b.raw).join('\n\n'),
    [parseResult.blocks]
  );

  // Convert to HTML using marked
  const htmlContent = useMemo(
    () => knownBlocksMarkdown ? mdToHtml(knownBlocksMarkdown) : '',
    [knownBlocksMarkdown]
  );

  // Collect unknown blocks for fallback rendering
  const unknownBlocks = useMemo(
    () => parseResult.blocks.filter(b => b.type === 'unknown'),
    [parseResult.blocks]
  );

  // Build paragraph ID map for data attributes
  const paragraphIdMap = useMemo(() => {
    const map: Record<number, string> = {};
    const paragraphBlocks = parseResult.blocks.filter(b => b.type === 'paragraph');
    paragraphBlocks.forEach((block, index) => {
      if (block.paragraphId) {
        map[index] = block.paragraphId;
      }
    });
    return map;
  }, [parseResult.blocks]);

  // Apply data attributes and highlight styling to paragraphs after render
  useEffect(() => {
    const root = leftPaneRef?.current ?? containerRef.current;
    if (!root) return;
    const paragraphs = root.querySelectorAll('p');
    // Build a set of highlighted paragraph indices
    const highlightedIndices = new Set(highlights.map(h => h.paragraphIndex));
    paragraphs.forEach((p, index) => {
      p.setAttribute('data-paragraph-index', String(index));
      if (paragraphIdMap[index]) {
        p.setAttribute('data-paragraph-id', paragraphIdMap[index]);
      }
      // Apply highlight background if this paragraph is highlighted
      if (highlightedIndices.has(index)) {
        p.style.background = 'var(--color-highlight)';
        p.style.padding = '0.25rem';
        p.style.borderRadius = '2px';
      }
    });
  }, [htmlContent, leftPaneRef, paragraphIdMap, highlights]);

  // Selection tooltip
  useEffect(() => {
    function onMouseUp() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!text || !containerRef.current) { setTooltip(null); return; }
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      // Find the paragraph index if the selection is inside a paragraph
      const paragraph = range.startContainer.parentElement?.closest('p');
      const paragraphIndex = paragraph ? parseInt(paragraph.getAttribute('data-paragraph-index') ?? '-1', 10) : -1;

      setTooltip({
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top - 8,
        text,
        paragraphIndex: paragraphIndex >= 0 ? paragraphIndex : undefined,
      });
    }
    function onMouseDown(e: MouseEvent) {
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

  // Enhanced prose class with better image, table, and code styling
  const proseClass = resolvedTheme === 'light'
    ? 'prose max-w-none font-mono text-base leading-relaxed text-[#2f241a] prose-img:max-w-[200px] prose-img:my-2 prose-img:mx-auto prose-img:block prose-table:w-full prose-table:my-4 prose-th:border prose-th:border-border prose-th:p-2 prose-th:text-left prose-td:border prose-td:border-border prose-td:p-2 prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface prose-pre:p-3 prose-pre:overflow-x-auto'
    : 'prose prose-invert max-w-none font-mono text-base leading-relaxed text-foreground prose-img:max-w-[200px] prose-img:my-2 prose-img:mx-auto prose-img:block prose-table:w-full prose-table:my-4 prose-th:border prose-th:border-border prose-th:p-2 prose-th:text-left prose-td:border prose-td:border-border prose-td:p-2 prose-code:bg-surface prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-surface prose-pre:p-3 prose-pre:overflow-x-auto';

  return (
    <div ref={containerRef} className="relative">
      {tooltip && (
        <div
          data-selection-tooltip
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          className="absolute z-50 flex gap-0 bg-surface border border-border"
        >
          <button
            onClick={async () => {
              if (tooltip.text && documentId) {
                const highlight: DocumentHighlight = {
                  id: crypto.randomUUID(),
                  documentId,
                  text: tooltip.text,
                  paragraphIndex: tooltip.paragraphIndex ?? -1,
                  createdAt: new Date().toISOString(),
                };
                await saveHighlight(highlight);
                // @ts-expect-error setHighlights is injected from parent
                setHighlights?.((prev: any) => [...prev, highlight]);
              }
              setTooltip(null);
            }}
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
      {/* Render HTML content */}
      <div
        className={proseClass}
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      {/* Render fallback blocks for unknown block types */}
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
  onToggleTheme: () => void;
  themeLabel: string;
  showSidePanel: boolean;
  onToggleSidePanel: () => void;
}

function ReaderTopBar({ title, activeTab, onTabChange, onExportMd, onExportPdf, folderName, folderColor, onToggleTheme, themeLabel, showSidePanel, onToggleSidePanel }: ReaderTopBarProps) {
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
        {/* Side panel toggle */}
        <button
          onClick={onToggleSidePanel}
          title={showSidePanel ? 'Hide side panel' : 'Show side panel'}
          className={cn(
            'font-mono font-semibold text-[11px] uppercase tracking-wider border px-2.5 py-1 transition-colors',
            showSidePanel
              ? 'border-primary text-primary'
              : 'border-border text-muted hover:text-foreground hover:border-foreground'
          )}
        >
          [{showSidePanel ? 'HIDE' : 'SHOW'} PANEL]
        </button>
        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          title="Toggle theme"
          className="font-mono font-semibold text-[11px] uppercase tracking-wider text-muted border border-border px-2.5 py-1 hover:text-foreground hover:border-foreground transition-colors"
        >
          [{themeLabel}]
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
  const entities = (doc as any).keyEntities ?? doc.entities ?? [];
  const isEmpty = doc.summary === '' && keyPoints.length === 0 && entities.length === 0 && doc.timeline.length === 0 && doc.concepts.length === 0;

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
        {entities.length > 0
          ? (
            <div className="flex flex-col gap-1.5">
              {entities.map((e: any, i: number) => (
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

// ── Font class mapping ────────────────────────────────────────────────────────
function getFontClass(family: AppearanceSettings['fontFamily'], size: AppearanceSettings['fontSize']): string {
  const fontFamilyClass = family === 'mono' ? 'font-mono' : family === 'serif' ? 'font-serif' : 'font-sans';
  const fontSizeClass = size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg';
  return `${fontFamilyClass} ${fontSizeClass}`;
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function ReaderApp() {
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'chat'>('notes');
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme: 'dark',
    fontFamily: 'mono',
    fontSize: 'md',
    accentColor: '#e07c3a',
  });
  const [folder, setFolder] = useState<Folder | null>(null);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [highlights, setHighlights] = useState<DocumentHighlight[]>([]);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getAppearance().then(a => {
      setAppearance(a);
      const resolved = a.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : a.theme;
      document.documentElement.dataset.theme = resolved;
      document.body.dataset.theme = resolved;
      document.documentElement.style.setProperty('--color-primary', a.accentColor);
    });
  }, []);

  const resolvedTheme = appearance.theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : appearance.theme;

  const toggleTheme = useCallback(() => {
    setAppearance(a => {
      const next: AppearanceSettings['theme'] =
        a.theme === 'dark' ? 'light' :
          a.theme === 'light' ? 'system' : 'dark';
      const resolved = next === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : next;
      document.documentElement.dataset.theme = resolved;
      document.body.dataset.theme = resolved;
      window.localStorage.setItem('notch:reader-theme', next);
      return { ...a, theme: next };
    });
  }, []);

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
        // Load highlights for this document
        getHighlightsByDocument(id).then(setHighlights).catch(() => setHighlights([]));
      }
      setLoading(false);
    });
  }, []);

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

  const fontClass = getFontClass(appearance.fontFamily, appearance.fontSize);

  return (
    <TooltipProvider>
      <div
        data-theme={resolvedTheme}
        className={cn(
          'h-screen text-foreground flex flex-col overflow-hidden',
          fontClass,
          resolvedTheme === 'light' ? 'bg-[#f8f0df]' : 'bg-background'
        )}
      >
        <ReaderTopBar
          title={doc.title}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExportMd={() => downloadMarkdown(doc)}
          onExportPdf={() => exportPDF(doc, { sourceElement: exportContentRef.current, theme: resolvedTheme })}
          folderName={folder?.name}
          folderColor={folder?.color}
          onToggleTheme={toggleTheme}
          themeLabel={appearance.theme.toUpperCase()}
          showSidePanel={showSidePanel}
          onToggleSidePanel={() => setShowSidePanel(v => !v)}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Left pane — 70%, scrollable, theme-aware */}
          <div
            ref={leftPaneRef}
            className={cn(
              'border-r border-border overflow-y-auto transition-all duration-200',
              showSidePanel ? 'w-[70%]' : 'w-full'
            )}
          >
            <div ref={exportContentRef} className="px-10 py-8">
              <h1 className={cn(
                'font-bold text-4xl mb-4 leading-tight',
                resolvedTheme === 'light' ? 'text-[#2a211a]' : 'text-foreground'
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
               {!(doc as any).embeddingsGenerated && (
                <EmptyState
                  message="No embeddings yet"
                  action={{
                    label: 'Generate Embeddings',
                    onClick: () => {
                      browser.runtime.sendMessage({ type: 'GENERATE_EMBEDDINGS', payload: { documentId: doc.id } })
                        .catch(() => {/* fire and forget */ });
                    },
                  }}
                  className="mb-6"
                />
              )}
              {/* Req 6.3 — parse failed (all blocks unknown) */}
              {(() => {
                const parsed = parseMarkdown((doc as any).content ?? doc.summary ?? '');
                const parseFailed = parsed.blocks.length > 0 && parsed.blocks.every(b => b.type === 'unknown');
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
                  {(doc as any).content ?? ''}
                </pre>
              ) : (
                <DocumentRenderer
                  content={(doc as any).content ?? ''}
                  onAskAI={handleAskAI}
                  leftPaneRef={leftPaneRef}
                  resolvedTheme={resolvedTheme}
                  documentId={doc.id}
                  highlights={highlights}
                />
              )}
            </div>
          </div>

          {/* Right pane — 30%, sticky - hide when panel is closed */}
          {showSidePanel && (
            <div className="w-[30%] min-w-[280px] flex flex-col overflow-hidden border-l border-border bg-background text-foreground">
              <ScrollArea className="flex-1 p-4">
                {activeTab === 'notes'
                  ? <NotesPanel doc={doc} leftPaneRef={leftPaneRef} />
                  : <ChatPanel doc={doc} prefillQuery={chatPrefill} leftPaneRef={leftPaneRef} folderColor={folder?.color} />
                }
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
