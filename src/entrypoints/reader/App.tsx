import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import type { Document, Folder, DocumentHighlight } from '@/lib/types';
import { getDocument, getFolders, getAppearance, saveAppearance } from '@/lib/storage';
import { applyAppearance, watchAppearance, resolveTheme } from '@/lib/theme';
import { downloadMarkdown, exportPDF, exportViaPrint } from '@/lib/export';
import { buildEnhancedPDF } from '@/lib/content-engine/export/pdf-exporter';
import { ExportPipeline, StitchingEngine, type DepthMode, type StitchedDocument } from '@/lib/content-engine/index';
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
import { marked } from 'marked';
import { ContentRenderer } from '@/lib/content-engine/components/ContentRenderer';
import { parseToEnrichedAST, stripNotchMarkers } from '@/lib/content-engine/index';

marked.setOptions({
  gfm: true,
  breaks: false,
});

function mdToHtml(md: string): string {
  const rawHtml = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(rawHtml);
}

function scrollToAndHighlight(leftPaneRef: React.RefObject<HTMLDivElement | null>, paragraphIndex: number) {
  const root = leftPaneRef.current;
  if (!root) return;
  const el = root.querySelector<HTMLElement>(`[data-paragraph-index="${paragraphIndex}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.background = 'rgba(0, 117, 222, 0.1)';
  el.style.borderRadius = '4px';
  setTimeout(() => { el.style.background = ''; }, 2000);
}

function FallbackRenderer({ block }: { block: DocBlock }) {
  return <pre className="text-[13px] text-[var(--color-ink-muted)] whitespace-pre-wrap break-words border border-[var(--color-hairline)] rounded-lg p-4 my-3 bg-[var(--color-canvas-soft)]">{block.raw}</pre>;
}

function DocumentRenderer({ content, onAskAI, leftPaneRef, resolvedTheme, documentId, highlights }: {
  content: string;
  onAskAI: (text: string) => void;
  leftPaneRef?: React.RefObject<HTMLDivElement | null>;
  resolvedTheme: 'dark' | 'light';
  documentId: string;
  highlights: DocumentHighlight[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string; paragraphIndex?: number } | null>(null);
  const [useRichRenderer, setUseRichRenderer] = useState(true);

  const cleanContent = useMemo(() => stripNotchMarkers(content ?? ''), [content]);

  const parseResult = useMemo(() => parseMarkdown(cleanContent), [cleanContent]);
  const knownBlocksMarkdown = useMemo(
    () => parseResult.blocks.filter(b => b.type !== 'unknown').map(b => b.raw).join('\n\n'),
    [parseResult.blocks]
  );
  const htmlContent = useMemo(
    () => knownBlocksMarkdown && !useRichRenderer ? mdToHtml(knownBlocksMarkdown) : '',
    [knownBlocksMarkdown, useRichRenderer]
  );
  const unknownBlocks = useMemo(
    () => parseResult.blocks.filter(b => b.type === 'unknown'),
    [parseResult.blocks]
  );
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

  const hasDiagrams = useMemo(() => {
    return /```(mermaid|plantuml|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|mindmap|timeline|gantt|pie|journey|gitGraph|architecture)\b/.test(cleanContent);
  }, [cleanContent]);

  const hasCallouts = useMemo(() => {
    return /\[!(NOTE|WARNING|TIP|DANGER|INFO)\]/.test(cleanContent);
  }, [cleanContent]);

  useEffect(() => {
    const root = leftPaneRef?.current ?? containerRef.current;
    if (!root) return;
    const paragraphs = root.querySelectorAll('p');
    const highlightedIndices = new Set(highlights.map(h => h.paragraphIndex));
    paragraphs.forEach((p, index) => {
      p.setAttribute('data-paragraph-index', String(index));
      if (paragraphIdMap[index]) {
        p.setAttribute('data-paragraph-id', paragraphIdMap[index]);
      }
      if (highlightedIndices.has(index)) {
        p.style.background = 'rgba(0, 117, 222, 0.08)';
        p.style.padding = '0.25rem';
        p.style.borderRadius = '4px';
      }
    });
  }, [htmlContent, leftPaneRef, paragraphIdMap, highlights, useRichRenderer]);

  useEffect(() => {
    function onMouseUp() {
      if (useRichRenderer) return;
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? '';
      if (!text || !containerRef.current) { setTooltip(null); return; }
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
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
  }, [useRichRenderer]);

  // Use rich renderer when diagrams or callouts are detected
  if (useRichRenderer && (hasDiagrams || hasCallouts)) {
    return (
      <div ref={containerRef} className="relative">
        <ContentRenderer
          content={cleanContent}
          theme={resolvedTheme}
          showToc={false}
        />
        <div className="mt-4 text-center">
          <button
            onClick={() => setUseRichRenderer(false)}
            className="text-[11px] text-[var(--color-ink-faint)] hover:text-[var(--color-ink-muted)] underline"
          >
            Switch to plain text view
          </button>
        </div>
      </div>
    );
  }

  // Legacy plain markdown renderer fallback
  return (
    <div ref={containerRef} className="relative">
      {hasDiagrams && (
        <div className="mb-4">
          <button
            onClick={() => setUseRichRenderer(true)}
            className="text-[11px] font-medium text-[var(--color-primary)] hover:underline"
          >
            Enable rich rendering (diagrams, callouts, tables)
          </button>
        </div>
      )}
      {tooltip && (
        <div
          data-selection-tooltip
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          className="absolute z-50 flex gap-0 bg-white border border-[var(--color-hairline)] rounded-lg shadow-level-1"
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
                (window as any).__setHighlights?.((prev: DocumentHighlight[]) => [...prev, highlight]);
              }
              setTooltip(null);
            }}
            className="text-[11px] font-medium px-2.5 py-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors rounded-l-lg"
          >
            Highlight
          </button>
          <Separator orientation="vertical" className="bg-[var(--color-hairline)]" />
          <button
            onClick={() => { onAskAI(tooltip.text); setTooltip(null); }}
            className="text-[11px] font-medium px-2.5 py-1.5 text-[var(--color-primary)] hover:text-[var(--color-primary-active)] transition-colors rounded-r-lg"
          >
            Ask AI
          </button>
        </div>
      )}
      <div
        className="notion-prose"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
      {unknownBlocks.map((block, i) => (
        <FallbackRenderer key={i} block={block} />
      ))}
    </div>
  );
}

function ExportMenu({ onExportMd, onExportPdf }: { onExportMd?: () => void; onExportPdf?: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={onExportMd}
        className="notion-btn-utility text-[12px]"
      >
        .md
      </button>
      <button
        onClick={onExportPdf}
        className="notion-btn-utility text-[12px]"
      >
        PDF
      </button>
    </div>
  );
}

const DEPTH_OPTIONS: DepthMode[] = ['fast', 'standard', 'deep'];

function DepthSelector({ value, onChange }: { value: DepthMode; onChange: (v: DepthMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="notion-btn-utility text-[11px] font-medium capitalize"
        title="Content depth mode"
      >
        {value}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--color-hairline)] rounded-lg shadow-level-2 z-50 min-w-[120px]">
          {DEPTH_OPTIONS.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={cn(
                'w-full text-left text-[12px] px-3 py-2 hover:bg-[var(--color-surface-hover)] transition-colors capitalize',
                opt === value && 'text-[var(--color-primary)] font-medium'
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReaderTopBar({ title, activeTab, onTabChange, onExportMd, onExportPdf, folderName, folderColor, onToggleTheme, themeLabel, showSidePanel, onToggleSidePanel, depthMode, onDepthModeChange }: {
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
  depthMode: DepthMode;
  onDepthModeChange: (v: DepthMode) => void;
}) {
  return (
    <div className="h-12 bg-white border-b border-[var(--color-hairline)] flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') })}
          className="text-[12px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors shrink-0"
        >
          Library
        </button>
        {folderName && (
          <>
            <span className="text-[12px] text-[var(--color-ink-faint)] shrink-0">/</span>
            <span
              className="text-[12px] font-medium shrink-0 flex items-center gap-1.5"
              style={folderColor ? { color: folderColor } : undefined}
            >
              {folderColor && (
                <span className="inline-block w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: folderColor }} />
              )}
              {folderName}
            </span>
          </>
        )}
        <span className="text-[12px] text-[var(--color-ink-faint)] shrink-0">/</span>
        <span className="text-[12px] font-medium text-[var(--color-ink)] truncate min-w-0">
          {title}
        </span>
      </div>

      <div className="flex gap-1 shrink-0 mx-6">
        {(['notes', 'chat'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={cn(
              'text-[12px] font-medium px-3 py-1.5 rounded-full transition-all',
              activeTab === tab
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <DepthSelector value={depthMode} onChange={onDepthModeChange} />
        <button
          onClick={onToggleSidePanel}
          className={cn(
            'notion-btn-utility text-[12px]',
            showSidePanel && 'border-[var(--color-primary)] text-[var(--color-primary)]'
          )}
        >
          {showSidePanel ? 'Hide panel' : 'Show panel'}
        </button>
        <button
          onClick={onToggleTheme}
          title="Toggle theme"
          className="notion-btn-utility text-[12px]"
        >
          {themeLabel}
        </button>
        <ExportMenu onExportMd={onExportMd} onExportPdf={onExportPdf} />
      </div>
    </div>
  );
}

function NotesPanel({ doc, leftPaneRef }: { doc: Document; leftPaneRef: React.RefObject<HTMLDivElement | null> }) {
  const keyPoints = doc.keyPoints ?? [];
  const entities = (doc as any).keyEntities ?? doc.entities ?? [];
  const isEmpty = doc.summary === '' && keyPoints.length === 0 && entities.length === 0 && doc.timeline.length === 0 && doc.concepts.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">Summary</p>
        {doc.summary
          ? <p className="text-[14px] text-[var(--color-ink)] leading-relaxed">{doc.summary}</p>
          : <p className="text-[12px] text-[var(--color-ink-faint)]">No summary available</p>
        }
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">Key points</p>
        {keyPoints.length > 0
          ? (
            <div className="flex flex-col gap-1.5">
              {keyPoints.map((point, i) => (
                <p key={i} className="text-[13px] text-[var(--color-ink)] leading-relaxed">
                  &mdash; {point}
                </p>
              ))}
            </div>
          )
          : <p className="text-[12px] text-[var(--color-ink-faint)]">No key points found</p>
        }
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">Key entities</p>
        {entities.length > 0
          ? (
            <div className="flex flex-col gap-1.5">
              {entities.map((e: any, i: number) => (
                <button
                  key={i}
                  onClick={() => scrollToAndHighlight(leftPaneRef, e.paragraphIndex)}
                  className="flex items-start gap-2 text-left hover:opacity-70 transition-opacity cursor-pointer"
                >
                  <Badge variant="outline" className="text-[9px] font-medium rounded-full border-[var(--color-hairline)] text-[var(--color-ink-muted)] shrink-0">
                    {e.type}
                  </Badge>
                  <span className="text-[13px] text-[var(--color-ink)]">{e.name}</span>
                </button>
              ))}
            </div>
          )
          : <p className="text-[12px] text-[var(--color-ink-faint)]">No entities found</p>
        }
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">Timeline</p>
        {doc.timeline.length > 0
          ? (
            <div className="flex flex-col gap-2">
              {doc.timeline.map((t, i) => (
                <button
                  key={i}
                  onClick={() => scrollToAndHighlight(leftPaneRef, t.paragraphIndex)}
                  className="text-left hover:opacity-70 transition-opacity cursor-pointer"
                >
                  <p className="text-[11px] font-medium text-[var(--color-primary)]">{t.date}</p>
                  <p className="text-[13px] text-[var(--color-ink)]">{t.description}</p>
                </button>
              ))}
            </div>
          )
          : <p className="text-[12px] text-[var(--color-ink-faint)]">No timeline events</p>
        }
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">Concepts</p>
        {doc.concepts.length > 0
          ? (
            <div className="flex flex-col gap-2">
              {doc.concepts.map((c, i) => (
                <button
                  key={i}
                  onClick={() => scrollToAndHighlight(leftPaneRef, c.paragraphIndex)}
                  className="text-left hover:opacity-70 transition-opacity cursor-pointer"
                >
                  <p className="text-[13px] font-semibold text-[var(--color-ink)]">{c.term}</p>
                  <p className="text-[12px] text-[var(--color-ink-muted)] leading-relaxed">{c.definition}</p>
                </button>
              ))}
            </div>
          )
          : <p className="text-[12px] text-[var(--color-ink-faint)]">No concepts found</p>
        }
      </div>

      {isEmpty && (
        <p className="text-[12px] text-[var(--color-ink-faint)] text-center">Notes will populate after capture</p>
      )}
    </div>
  );
}

function getFontClass(family: AppearanceSettings['fontFamily'], size: AppearanceSettings['fontSize']): string {
  const fontFamilyClass = family === 'mono' ? 'font-mono' : family === 'serif' ? 'font-serif' : '';
  const fontSizeClass = size === 'sm' ? 'text-sm' : size === 'md' ? 'text-base' : 'text-lg';
  return `${fontFamilyClass} ${fontSizeClass}`;
}

export default function ReaderApp() {
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'chat'>('notes');
  const [chatPrefill, setChatPrefill] = useState<string | undefined>();
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    theme: 'dark',
    fontFamily: 'sans',
    fontSize: 'md',
    accentColor: '#0075de',
  });
  const [folder, setFolder] = useState<Folder | null>(null);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [highlights, setHighlights] = useState<DocumentHighlight[]>([]);
  const [depthMode, setDepthMode] = useState<DepthMode>('standard');
  const [exportMode, setExportMode] = useState<'standard' | 'enhanced'>('enhanced');
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);

  (window as any).__setHighlights = setHighlights;

  useEffect(() => {
    getAppearance().then(a => { setAppearance(a); applyAppearance(a); });
    // Live-sync when the theme is toggled on any other page.
    return watchAppearance(a => { setAppearance(a); applyAppearance(a); });
  }, []);

  const resolvedTheme = resolveTheme(appearance.theme);

  const toggleTheme = useCallback(() => {
    const order: Record<AppearanceSettings['theme'], AppearanceSettings['theme']> = {
      dark: 'light', light: 'system', system: 'dark',
    };
    const next = { ...appearance, theme: order[appearance.theme] };
    setAppearance(next);
    applyAppearance(next);
    saveAppearance(next); // persists + broadcasts to other pages
  }, [appearance]);

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
        getHighlightsByDocument(id).then(setHighlights).catch(() => setHighlights([]));
      }
      setLoading(false);
    });
  }, []);

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
      <div className="h-screen bg-[var(--color-canvas-soft)] flex items-center justify-center">
        <span className="text-[13px] font-medium text-[var(--color-primary)] capture-loading">
          Loading...
        </span>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="h-screen bg-[var(--color-canvas-soft)] flex flex-col items-center justify-center gap-4">
        <span className="text-[14px] font-semibold text-[var(--color-destructive)]">
          Document not found
        </span>
        {error && <span className="text-[13px] text-[var(--color-ink-muted)]">{error}</span>}
        <button
          onClick={() => browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') })}
          className="notion-btn-primary text-[14px]"
        >
          Back to Library
        </button>
      </div>
    );
  }

  const fontClass = getFontClass(appearance.fontFamily, appearance.fontSize);

  return (
    <TooltipProvider>
      <div className={cn('h-screen flex flex-col overflow-hidden bg-[var(--color-canvas-soft)] text-[var(--color-ink)]', fontClass)}>
        <ReaderTopBar
          title={doc.title}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExportMd={() => downloadMarkdown(doc)}
            onExportPdf={async () => {
            // BUG-005/006/007/008: print the rendered DOM (real diagrams, tables,
            // proper pagination) via the browser print engine. Falls through to the
            // legacy generators only if it can't run.
            if (await exportViaPrint(doc, exportContentRef.current)) return;
            if (exportMode === 'enhanced' && doc.content) {
              try {
                if (depthMode !== 'standard') {
                  const stitchingEngine = new StitchingEngine();
                  const exportPipeline = new ExportPipeline();
                  const content = doc.content ?? '';
                  const frames: import('@/lib/content-engine/index').ContentFrame[] = content.split(/(?=^## )/m).map((sec, i) => ({
                    id: `frame-${i}`,
                    index: i,
                    title: sec.match(/^##\s+(.+)/m)?.[1] ?? `Section ${i + 1}`,
                    topic: 'General',
                    context: sec.slice(0, 100),
                    sourceText: sec,
                    relationships: [],
                    metadata: { wordCount: sec.split(/\s+/).length, sectionIndex: i, hasCode: false, hasDiagrams: false, hasTables: false, hasLists: false, entities: [], keyTerms: [], importance: 0.5 },
                    status: 'complete' as const,
                    regenerateCount: 0,
                    subFrames: [],
                  }));
                  const stitched = stitchingEngine.stitch(frames);
                  const result = await exportPipeline.export(stitched, content, {
                    depthMode,
                    includeToc: true,
                    includePageNumbers: true,
                    includeFootnotes: true,
                    dpi: 300,
                    pageSize: 'a4',
                    theme: resolvedTheme === 'dark' ? 'dark' : 'light',
                    validateBeforeExport: true,
                  });
                  if (result.success && result.data) {
                    const blob = new Blob([result.data as BlobPart], { type: 'application/pdf' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    const filename = doc.title.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'document';
                    a.href = url;
                    a.download = `${filename}.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    return;
                  }
                }
                const pdfBytes = await buildEnhancedPDF(
                  null as any,
                  doc.content,
                  {
                    title: doc.title,
                    author: doc.domain,
                    date: doc.capturedAt.slice(0, 10),
                    includeToc: true,
                    includePageNumbers: true,
                    includeHeaders: true,
                    includeFooters: true,
                  },
                );
                const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const filename = doc.title.replace(/[^a-z0-9\-_. ]/gi, '_').trim() || 'document';
                a.href = url;
                a.download = `${filename}.pdf`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              } catch {
                await exportPDF(doc, { sourceElement: exportContentRef.current, theme: resolvedTheme });
              }
            } else {
              await exportPDF(doc, { sourceElement: exportContentRef.current, theme: resolvedTheme });
            }
          }}
          folderName={folder?.name}
          folderColor={folder?.color}
          onToggleTheme={toggleTheme}
          themeLabel={appearance.theme.toUpperCase()}
          showSidePanel={showSidePanel}
          onToggleSidePanel={() => setShowSidePanel(v => !v)}
          depthMode={depthMode}
          onDepthModeChange={setDepthMode}
        />

        <div className="flex flex-1 overflow-hidden">
          <div
            ref={leftPaneRef}
            className={cn(
              'border-r border-[var(--color-hairline)] overflow-y-auto transition-all duration-200 bg-white',
              showSidePanel ? 'w-[70%]' : 'w-full'
            )}
          >
            <div ref={exportContentRef} className="px-10 py-8 max-w-[800px] mx-auto">
              <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[var(--color-ink)] mb-3">
                {doc.title}
              </h1>
              <div className="flex gap-4 items-center mb-6 text-[13px] text-[var(--color-ink-muted)]">
                <span>{doc.domain}</span>
                <span>{doc.wordCount} words</span>
                <span>{doc.capturedAt.slice(0, 10)}</span>
                {doc.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px] font-medium rounded-full border-[var(--color-hairline)] text-[var(--color-ink-muted)]">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Separator className="bg-[var(--color-hairline)] mb-8" />
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
                <pre className="text-[13px] text-[var(--color-ink-muted)] whitespace-pre-wrap break-words border border-[var(--color-hairline)] rounded-lg p-5 bg-[var(--color-canvas-soft)]">
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

          {showSidePanel && (
            <div className="w-[30%] min-w-[280px] flex flex-col overflow-hidden bg-[var(--color-canvas-soft)] text-[var(--color-ink)]">
              <ScrollArea className="flex-1 p-5">
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
