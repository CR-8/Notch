import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import type { Document, Folder, DocumentHighlight } from '@/lib/types';
import {
  getDocument,
  getFolders,
  getAppearance,
  saveAppearance,
  findRelatedNotes,
  markDocumentRead,
  getDocIndex,
  type RelatedNote,
} from '@/lib/storage';
import { applyAppearance, watchAppearance, resolveTheme } from '@/lib/theme';
import { goToLibrary } from '@/lib/navigation';
import { downloadMarkdown, exportViaPrint } from '@/lib/export';
import type { PlanDepth as DepthMode } from '@/lib/content-engine/planner/document-planner';
import { log } from '@/lib/logger';
import { getHighlightsByDocument, saveHighlight } from '@/lib/idb';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChatPanel } from '@/components/ChatPanel';
import { EmptyState } from '@/components/EmptyState';
import { parseMarkdown } from '@/lib/markdown-parser';
import type { DocBlock } from '@/lib/markdown-parser';
import { sanitizeHtml } from '@/lib/sanitize';
import { renderMath } from '@/lib/markdown/math';
import 'katex/dist/katex.min.css';
import type { AppearanceSettings } from '@/lib/types';
import { marked } from 'marked';
import { ContentRenderer } from '@/lib/content-engine/components/ContentRenderer';
import { stripNotchMarkers } from '@/lib/content-engine/ast';

const CALLOUT_META: Record<string, { icon: string; cssVar: string }> = {
  NOTE: { icon: '📌', cssVar: 'var(--color-info)' },
  TIP: { icon: '💡', cssVar: 'var(--color-success)' },
  WARNING: { icon: '⚠️', cssVar: 'var(--color-accent-orange)' },
  DANGER: { icon: '🔴', cssVar: 'var(--color-sale)' },
  INFO: { icon: 'ℹ️', cssVar: 'var(--color-info)' },
};

// Custom marked renderer: turns [!NOTE]/[!TIP]/[!WARNING]/[!DANGER]/[!INFO]
// blockquotes into styled callout divs, and makes sure list output is clean.
const renderer = new marked.Renderer();

renderer.blockquote = ({ text }: { text: string }) => {
  const match = text.match(/^\[!(NOTE|TIP|WARNING|DANGER|INFO)\]\s*/i);
  if (match) {
    const kind = match[1].toUpperCase();
    const meta = CALLOUT_META[kind];
    const body = text.replace(/^\[!(NOTE|TIP|WARNING|DANGER|INFO)\]\s*/i, '').trim();
    return [
      `<div class="callout" style="--callout-accent:${meta.cssVar}" data-callout-kind="${kind.toLowerCase()}">`,
      `  <span class="callout-icon" aria-hidden="true">${meta.icon}</span>`,
      `  <div class="callout-content">${body}</div>`,
      `</div>`,
    ].join('\n');
  }
  return `<blockquote>${text}</blockquote>`;
};

marked.setOptions({
  gfm: true,
  breaks: true, // single \n → <br> so content doesn't blob into one paragraph
});
marked.use({ renderer });

function mdToHtml(md: string): string {
  const rawHtml = marked.parse(renderMath(md), { async: false });
  return sanitizeHtml(rawHtml);
}

function scrollToAndHighlight(
  leftPaneRef: React.RefObject<HTMLDivElement | null>,
  paragraphIndex: number,
) {
  const root = leftPaneRef.current;
  if (!root) return;
  const el = root.querySelector<HTMLElement>(`[data-paragraph-index="${paragraphIndex}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.style.background = 'color-mix(in srgb, var(--color-info) 14%, transparent)';
  el.style.borderRadius = '4px';
  setTimeout(() => {
    el.style.background = '';
  }, 2000);
}

function FallbackRenderer({ block }: { block: DocBlock }) {
  return (
    <pre className="text-[13px] text-[var(--color-ink-muted)] whitespace-pre-wrap break-words border border-[var(--color-hairline)] rounded-lg p-4 my-3 bg-[var(--color-canvas-soft)]">
      {block.raw}
    </pre>
  );
}

function DocumentRenderer({
  content,
  onAskAI,
  leftPaneRef,
  resolvedTheme,
  documentId,
  highlights,
}: {
  content: string;
  onAskAI: (text: string) => void;
  leftPaneRef?: React.RefObject<HTMLDivElement | null>;
  resolvedTheme: 'dark' | 'light';
  documentId: string;
  highlights: DocumentHighlight[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
    paragraphIndex?: number;
  } | null>(null);
  const [useRichRenderer, setUseRichRenderer] = useState(true);

  const cleanContent = useMemo(() => stripNotchMarkers(content ?? ''), [content]);

  const parseResult = useMemo(() => parseMarkdown(cleanContent), [cleanContent]);
  const knownBlocksMarkdown = useMemo(
    () =>
      parseResult.blocks
        .filter((b) => b.type !== 'unknown')
        .map((b) => b.raw)
        .join('\n\n'),
    [parseResult.blocks],
  );
  const htmlContent = useMemo(
    () => (knownBlocksMarkdown && !useRichRenderer ? mdToHtml(knownBlocksMarkdown) : ''),
    [knownBlocksMarkdown, useRichRenderer],
  );
  const unknownBlocks = useMemo(
    () => parseResult.blocks.filter((b) => b.type === 'unknown'),
    [parseResult.blocks],
  );
  const paragraphIdMap = useMemo(() => {
    const map: Record<number, string> = {};
    const paragraphBlocks = parseResult.blocks.filter((b) => b.type === 'paragraph');
    paragraphBlocks.forEach((block, index) => {
      if (block.paragraphId) {
        map[index] = block.paragraphId;
      }
    });
    return map;
  }, [parseResult.blocks]);

  useEffect(() => {
    const root = leftPaneRef?.current ?? containerRef.current;
    if (!root) return;
    const paragraphs = root.querySelectorAll('p');
    const highlightedIndices = new Set(highlights.map((h) => h.paragraphIndex));
    paragraphs.forEach((p, index) => {
      p.setAttribute('data-paragraph-index', String(index));
      if (paragraphIdMap[index]) {
        p.setAttribute('data-paragraph-id', paragraphIdMap[index]);
      }
      if (highlightedIndices.has(index)) {
        p.style.background = 'color-mix(in srgb, var(--color-info) 12%, transparent)';
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
      if (!text || !containerRef.current) {
        setTooltip(null);
        return;
      }
      const range = sel!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const paragraph = range.startContainer.parentElement?.closest('p');
      const paragraphIndex = paragraph
        ? parseInt(paragraph.getAttribute('data-paragraph-index') ?? '-1', 10)
        : -1;
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

  // Use rich renderer by default
  if (useRichRenderer) {
    return (
      <div ref={containerRef} className="relative">
        <ContentRenderer content={cleanContent} theme={resolvedTheme} showToc={false} />
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
      <div className="mb-4">
        <button
          onClick={() => setUseRichRenderer(true)}
          className="text-[11px] font-medium text-[var(--color-primary)] hover:underline"
        >
          Enable rich rendering (diagrams, callouts, tables)
        </button>
      </div>
      {tooltip && (
        <div
          data-selection-tooltip
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}
          className="absolute z-50 flex gap-0 bg-white border border-[var(--color-hairline)] rounded-lg shadow-level-1"
        >
          <button
            onClick={() => {
              if (tooltip.text && documentId) {
                const highlight: DocumentHighlight = {
                  id: crypto.randomUUID(),
                  documentId,
                  text: tooltip.text,
                  paragraphIndex: tooltip.paragraphIndex ?? -1,
                  createdAt: new Date().toISOString(),
                };
                void saveHighlight(highlight);
                (
                  window as unknown as {
                    __setHighlights?: React.Dispatch<React.SetStateAction<DocumentHighlight[]>>;
                  }
                ).__setHighlights?.((prev: DocumentHighlight[]) => [...prev, highlight]);
              }
              setTooltip(null);
            }}
            className="text-[11px] font-medium px-2.5 py-1.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors rounded-l-lg"
          >
            Highlight
          </button>
          <Separator orientation="vertical" className="bg-[var(--color-hairline)]" />
          <button
            onClick={() => {
              onAskAI(tooltip.text);
              setTooltip(null);
            }}
            className="text-[11px] font-medium px-2.5 py-1.5 text-[var(--color-primary)] hover:text-[var(--color-primary-active)] transition-colors rounded-r-lg"
          >
            Ask AI
          </button>
        </div>
      )}
      <div className="notion-prose" dangerouslySetInnerHTML={{ __html: htmlContent }} />
      {unknownBlocks.map((block, i) => (
        <FallbackRenderer key={i} block={block} />
      ))}
    </div>
  );
}

function ExportMenu({
  onExportMd,
  onExportPdf,
  onCopyMd,
  pdfExportStatus,
}: {
  onExportMd?: () => void;
  onExportPdf?: () => void;
  onCopyMd?: () => void;
  pdfExportStatus?: 'idle' | 'preparing' | 'done' | 'error';
}) {
  const [copied, setCopied] = useState(false);

  function handleCopyMd() {
    if (!onCopyMd) return;
    onCopyMd();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const pdfLabel =
    pdfExportStatus === 'preparing'
      ? 'Preparing…'
      : pdfExportStatus === 'done'
        ? '✓ PDF'
        : pdfExportStatus === 'error'
          ? 'Error'
          : 'PDF';

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCopyMd}
        title="Copy note as markdown"
        className="notion-btn-utility text-[12px]"
      >
        {copied ? '✓ Copied' : 'Copy MD'}
      </button>
      <button onClick={onExportMd} className="notion-btn-utility text-[12px]">
        .md
      </button>
      <button
        onClick={onExportPdf}
        disabled={pdfExportStatus === 'preparing'}
        title={pdfExportStatus === 'preparing' ? 'Preparing PDF…' : 'Export as PDF'}
        className={cn(
          'notion-btn-utility text-[12px]',
          pdfExportStatus === 'preparing' && 'opacity-50 cursor-wait',
          pdfExportStatus === 'done' && 'text-[var(--color-primary)]',
          pdfExportStatus === 'error' && 'text-[var(--color-destructive)]',
        )}
      >
        {pdfLabel}
      </button>
    </div>
  );
}

const DEPTH_OPTIONS: DepthMode[] = ['fast', 'standard', 'deep'];

function DepthSelector({
  value,
  onChange,
}: {
  value: DepthMode;
  onChange: (v: DepthMode) => void;
}) {
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
        onClick={() => setOpen((v) => !v)}
        className="notion-btn-utility text-[11px] font-medium capitalize"
        title="Content depth mode"
      >
        {value}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[var(--color-hairline)] rounded-lg shadow-level-2 z-50 min-w-[120px]">
          {DEPTH_OPTIONS.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={cn(
                'w-full text-left text-[12px] px-3 py-2 hover:bg-[var(--color-surface-hover)] transition-colors capitalize',
                opt === value && 'text-[var(--color-primary)] font-medium',
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

function ReaderTopBar({
  title,
  activeTab,
  onTabChange,
  onExportMd,
  onExportPdf,
  onCopyMd,
  folderName,
  folderColor,
  onToggleTheme,
  themeLabel,
  showSidePanel,
  onToggleSidePanel,
  depthMode,
  onDepthModeChange,
  pdfExportStatus,
  ttsStatus,
  onTtsReadAloud,
}: {
  title: string;
  activeTab: 'notes' | 'chat';
  onTabChange: (t: 'notes' | 'chat') => void;
  onExportMd?: () => void;
  onExportPdf?: () => void;
  onCopyMd?: () => void;
  folderName?: string;
  folderColor?: string;
  onToggleTheme: () => void;
  themeLabel: string;
  showSidePanel: boolean;
  onToggleSidePanel: () => void;
  depthMode: DepthMode;
  onDepthModeChange: (v: DepthMode) => void;
  pdfExportStatus?: 'idle' | 'preparing' | 'done' | 'error';
  ttsStatus?: 'idle' | 'synthesizing' | 'playing';
  onTtsReadAloud?: () => void;
}) {
  return (
    <div className="h-12 bg-white border-b border-[var(--color-hairline)] flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={goToLibrary}
          title="Back to Library"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] transition-colors shrink-0"
        >
          <span aria-hidden="true" className="text-[15px] leading-none">
            &larr;
          </span>
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
                <span
                  className="inline-block w-1.5 h-1.5 rounded-sm shrink-0"
                  style={{ backgroundColor: folderColor }}
                />
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
                ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]',
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
            showSidePanel && 'border-[var(--color-primary)] text-[var(--color-primary)]',
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
        <button
          onClick={onTtsReadAloud}
          className={cn(
            'notion-btn-utility text-[12px]',
            ttsStatus === 'playing' && 'border-green-400 text-green-600',
            ttsStatus === 'synthesizing' && 'opacity-50',
          )}
          title={
            ttsStatus === 'idle'
              ? 'Read Aloud'
              : ttsStatus === 'synthesizing'
                ? 'Synthesizing...'
                : 'Stop'
          }
        >
          {ttsStatus === 'idle' && '🔊 Read'}
          {ttsStatus === 'synthesizing' && '⏳ TTS...'}
          {ttsStatus === 'playing' && '⏹ Stop'}
        </button>
        <ExportMenu
          onExportMd={onExportMd}
          onExportPdf={onExportPdf}
          onCopyMd={onCopyMd}
          pdfExportStatus={pdfExportStatus}
        />
      </div>
    </div>
  );
}

function complexityLabel(score?: number): string {
  if (score == null) return '—';
  if (score < 35) return 'Low';
  if (score < 65) return 'Medium';
  return 'High';
}

function StatCell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[var(--color-ink-faint)] uppercase tracking-wide">
        {label}
      </p>
      <p className="text-[14px] font-semibold text-[var(--color-ink)] mt-0.5">{value}</p>
    </div>
  );
}

function NotesPanel({
  doc,
  leftPaneRef,
}: {
  doc: Document;
  leftPaneRef: React.RefObject<HTMLDivElement | null>;
}) {
  const keyPoints = doc.keyPoints ?? [];
  const entities =
    (
      doc as Document & {
        keyEntities?: Array<{
          name: string;
          type: string;
          mentions?: number;
          description?: string;
          paragraphIndex?: number;
        }>;
      }
    ).keyEntities ??
    doc.entities ??
    [];
  const relationships = doc.relationships ?? [];
  const topics = doc.topics ?? [];
  const diagramCount = doc.diagramCount ?? 0;
  const isEmpty =
    doc.summary === '' &&
    keyPoints.length === 0 &&
    entities.length === 0 &&
    doc.timeline.length === 0 &&
    doc.concepts.length === 0;

  // LIB-6: load related notes
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([]);
  useEffect(() => {
    findRelatedNotes(doc.id, 5)
      .then(setRelatedNotes)
      .catch(() => setRelatedNotes([]));
  }, [doc.id]);

  return (
    <div className="flex flex-col gap-4">
      {/* PROBLEM 11: document-intelligence dashboard */}
      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">
          Document intelligence
        </p>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          <StatCell
            label="Reading time"
            value={`${doc.readingTimeMinutes ?? Math.max(1, Math.round((doc.wordCount ?? 0) / 220))} min`}
          />
          <StatCell
            label="Complexity"
            value={
              doc.complexity != null
                ? `${complexityLabel(doc.complexity)} (${doc.complexity})`
                : '—'
            }
          />
          <StatCell label="Type" value={doc.documentType ?? 'general'} />
          <StatCell label="Words" value={(doc.wordCount ?? 0).toLocaleString()} />
          <StatCell label="Entities" value={entities.length} />
          <StatCell label="Diagrams" value={diagramCount} />
          <StatCell label="Timeline" value={doc.timeline.length} />
          <StatCell label="Concepts" value={doc.concepts.length} />
        </div>
        {topics.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--color-hairline)]">
            <p className="text-[10px] font-semibold text-[var(--color-ink-faint)] uppercase tracking-wide mb-1.5">
              Topics
            </p>
            <div className="flex flex-wrap gap-1.5">
              {topics.map((t, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] rounded-full border-[var(--color-hairline)] text-[var(--color-ink-muted)]"
                >
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
          Summary
        </p>
        {doc.summary ? (
          <p className="text-[14px] text-[var(--color-ink)] leading-relaxed">{doc.summary}</p>
        ) : (
          <p className="text-[12px] text-[var(--color-ink-faint)]">No summary available</p>
        )}
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
          Key points
        </p>
        {keyPoints.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {keyPoints.map((point, i) => (
              <p key={i} className="text-[13px] text-[var(--color-ink)] leading-relaxed">
                &mdash; {point}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--color-ink-faint)]">No key points found</p>
        )}
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
          Key entities
        </p>
        {entities.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {(
              entities as Array<{
                name: string;
                type: string;
                mentions?: number;
                description?: string;
                paragraphIndex?: number;
              }>
            ).map((e, i) => (
              <button
                key={i}
                onClick={() => {
                  if (e.paragraphIndex != null) scrollToAndHighlight(leftPaneRef, e.paragraphIndex);
                }}
                className="flex items-start gap-2 text-left hover:opacity-70 transition-opacity cursor-pointer"
              >
                <Badge
                  variant="outline"
                  className="text-[9px] font-medium rounded-full border-[var(--color-hairline)] text-[var(--color-ink-muted)] shrink-0"
                >
                  {e.type}
                </Badge>
                <span className="min-w-0">
                  <span className="text-[13px] text-[var(--color-ink)]">{e.name}</span>
                  {e.mentions ? (
                    <span className="text-[10px] text-[var(--color-ink-faint)] ml-1.5">
                      ×{e.mentions}
                    </span>
                  ) : null}
                  {e.description ? (
                    <span className="block text-[11px] text-[var(--color-ink-muted)] leading-snug line-clamp-2">
                      {e.description}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--color-ink-faint)]">No entities found</p>
        )}
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
          Timeline
        </p>
        {doc.timeline.length > 0 ? (
          <div className="flex flex-col gap-2">
            {doc.timeline.map((t, i) => (
              <button
                key={i}
                onClick={() => scrollToAndHighlight(leftPaneRef, t.paragraphIndex)}
                className="text-left hover:opacity-70 transition-opacity cursor-pointer"
              >
                <p className="text-[11px] font-medium text-[var(--color-primary)]">{t.date}</p>
                <p className="text-[13px] text-[var(--color-ink)]">{t.description}</p>
                {t.significance ? (
                  <p className="text-[11px] text-[var(--color-ink-faint)] italic">
                    {t.significance}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--color-ink-faint)]">No timeline events</p>
        )}
      </div>

      <div className="notion-card">
        <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
          Concepts
        </p>
        {doc.concepts.length > 0 ? (
          <div className="flex flex-col gap-2">
            {doc.concepts.map((c, i) => (
              <button
                key={i}
                onClick={() => scrollToAndHighlight(leftPaneRef, c.paragraphIndex)}
                className="text-left hover:opacity-70 transition-opacity cursor-pointer"
              >
                <p className="text-[13px] font-semibold text-[var(--color-ink)]">{c.term}</p>
                <p className="text-[12px] text-[var(--color-ink-muted)] leading-relaxed">
                  {c.definition}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[var(--color-ink-faint)]">No concepts found</p>
        )}
      </div>

      {relationships.length > 0 && (
        <div className="notion-card">
          <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
            Relationships
          </p>
          <div className="flex flex-col gap-1.5">
            {relationships.map((r, i) => (
              <p key={i} className="text-[12px] text-[var(--color-ink)] leading-snug">
                <span className="font-medium">{r.source}</span>
                <span className="text-[var(--color-ink-faint)]">
                  {' '}
                  {r.relation.replace(/-/g, ' ')}{' '}
                </span>
                <span className="font-medium">{r.target}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* LIB-6: Related notes */}
      {relatedNotes.length > 0 && (
        <div className="notion-card">
          <p className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
            Related notes
          </p>
          <div className="flex flex-col gap-2">
            {relatedNotes.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  browser.tabs
                    .create({ url: browser.runtime.getURL(`/reader.html?documentId=${r.id}`) })
                    .catch(() => {});
                }}
                className="text-left group"
              >
                <p className="text-[13px] font-medium text-[var(--color-ink)] group-hover:text-[var(--color-primary)] transition-colors leading-snug">
                  {r.title}
                </p>
                {(r.sharedTags.length > 0 || r.sharedEntities.length > 0) && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.sharedTags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-primary)]/5 text-[var(--color-primary)] border border-[var(--color-primary)]/15"
                      >
                        {t}
                      </span>
                    ))}
                    {r.sharedEntities.slice(0, 2).map((e) => (
                      <span
                        key={e}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--color-ink-faint)]/10 text-[var(--color-ink-muted)] border border-[var(--color-hairline)]"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {isEmpty && (
        <p className="text-[12px] text-[var(--color-ink-faint)] text-center">
          Notes will populate after capture
        </p>
      )}
    </div>
  );
}

function getFontClass(
  family: AppearanceSettings['fontFamily'],
  size: AppearanceSettings['fontSize'],
): string {
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
    accentColor: '#111111',
  });
  const [folder, setFolder] = useState<Folder | null>(null);
  const [showRawMarkdown, setShowRawMarkdown] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(true);
  const [highlights, setHighlights] = useState<DocumentHighlight[]>([]);
  const [depthMode, setDepthMode] = useState<DepthMode>('standard');
  const [pdfExportStatus, setPdfExportStatus] = useState<'idle' | 'preparing' | 'done' | 'error'>(
    'idle',
  );
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'synthesizing' | 'playing'>('idle');
  const audioContextRef = useRef<AudioContext | null>(null);
  const ttsSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const exportContentRef = useRef<HTMLDivElement>(null);
  // CHAT-15: all doc IDs for library scope toggle in ChatPanel
  const [allDocIds, setAllDocIds] = useState<string[]>([]);

  useEffect(() => {
    (window as unknown as { __setHighlights: typeof setHighlights }).__setHighlights =
      setHighlights;
    return () => {
      delete (window as unknown as Record<string, unknown>).__setHighlights;
    };
  }, [setHighlights]);

  useEffect(() => {
    void getAppearance().then((a) => {
      setAppearance(a);
      applyAppearance(a);
    });
    // Live-sync when the theme is toggled on any other page.
    return watchAppearance((a) => {
      setAppearance(a);
      applyAppearance(a);
    });
  }, []);

  const resolvedTheme = resolveTheme(appearance.theme);

  const toggleTheme = useCallback(() => {
    const order: Record<AppearanceSettings['theme'], AppearanceSettings['theme']> = {
      dark: 'light',
      light: 'system',
      system: 'dark',
    };
    const next = { ...appearance, theme: order[appearance.theme] };
    setAppearance(next);
    applyAppearance(next);
    void saveAppearance(next); // persists + broadcasts to other pages
  }, [appearance]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('documentId');
    void (async () => {
      if (!id) {
        setError('No document ID provided.');
        setLoading(false);
        return;
      }
      try {
        const [result, folders] = await Promise.all([getDocument(id), getFolders()]);
        if (!result) {
          log.warn('READER', `Document not found: ${id}`);
          setError(`Document not found: ${id}`);
        } else {
          log.info('READER', 'Loaded doc', {
            id: result.id,
            title: result.title,
            hasContent: !!result.content,
            contentLen: result.content?.length ?? 0,
            contentWordCount: (result.content ?? '').split(/\s+/).filter(Boolean).length,
            hasEnriched: !!result.enrichedContent,
            enrichedLen: result.enrichedContent?.length ?? 0,
            summaryLen: result.summary?.length ?? 0,
            wordCount: result.wordCount,
            entities: result.entities?.length ?? 0,
            concepts: result.concepts?.length ?? 0,
            timeline: result.timeline?.length ?? 0,
            status: result.status,
            hasTextContent: !!result.textContent,
            textContentLen: result.textContent?.length ?? 0,
            textContentWordCount: (result.textContent ?? '').split(/\s+/).filter(Boolean).length,
          });
          // Detect content/wordCount mismatch
          if (
            result.wordCount < 20 &&
            (result.textContent ?? '').split(/\s+/).filter(Boolean).length > 100
          ) {
            log.warn('READER', `wordCount=${result.wordCount} differs from textContent — fixing`);
            result.wordCount = (result.content ?? result.textContent ?? '')
              .split(/\s+/)
              .filter(Boolean).length;
          }
          // If content is empty but textContent exists, surface it so the reader
          // is never completely blank.
          if (!result.content && !result.enrichedContent && result.textContent) {
            log.warn('READER', 'content is empty, using textContent as fallback');
            result.content = result.textContent;
          }
          setDoc(result);
          if (result.folder) {
            const f = folders.find((f) => f.id === result.folder) ?? null;
            setFolder(f);
          }
          getHighlightsByDocument(id)
            .then(setHighlights)
            .catch(() => setHighlights([]));
          // LIB-7: mark document as read when opened in the reader
          if (!result.isRead) void markDocumentRead(id);
        }
        setLoading(false);
      } catch {
        setLoading(false);
      }
    })();
    // CHAT-15: load all doc IDs for library-scope chat
    void getDocIndex().then(setAllDocIds);
  }, []);

  async function playAudioBuffer(wavBytes: Uint8Array, _sampleRate: number) {
    try {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      const ctx = audioContextRef.current;
      const ab = wavBytes.buffer.slice(
        wavBytes.byteOffset,
        wavBytes.byteOffset + wavBytes.byteLength,
      ) as ArrayBuffer;
      const buffer = await ctx.decodeAudioData(ab);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      ttsSourceRef.current = source;
      setTtsStatus('playing');
      source.onended = () => {
        setTtsStatus('idle');
        ttsSourceRef.current = null;
      };
    } catch (err) {
      setTtsStatus('idle');
      log.error('TTS', 'Playback failed', err);
    }
  }

  useEffect(() => {
    function onTtsMsg(msg: unknown) {
      if (!msg || typeof msg !== 'object') return;
      const m = msg as {
        type?: string;
        payload?: { audioBase64?: string; sampleRate?: number; error?: string };
      };
      if (m.type === 'TTS_RESULT') {
        const audioBytes = Uint8Array.from(atob(m.payload?.audioBase64 ?? ''), (c) =>
          c.charCodeAt(0),
        );
        void playAudioBuffer(audioBytes, m.payload?.sampleRate ?? 44100);
      } else if (m.type === 'TTS_ERROR') {
        setTtsStatus('idle');
        log.error('TTS', m.payload?.error ?? 'Unknown TTS error');
      }
    }
    browser.runtime.onMessage.addListener(onTtsMsg);
    return () => browser.runtime.onMessage.removeListener(onTtsMsg);
  }, []);

  function stopTts() {
    if (ttsSourceRef.current) {
      try {
        ttsSourceRef.current.stop();
      } catch {
        /* already stopped */
      }
      ttsSourceRef.current = null;
    }
    setTtsStatus('idle');
    void browser.runtime.sendMessage({ type: 'TTS_STOP', payload: {} });
  }

  function handleTtsReadAloud(text: string) {
    if (ttsStatus !== 'idle') {
      stopTts();
      return;
    }
    setTtsStatus('synthesizing');
    void browser.runtime.sendMessage({ type: 'TTS_SPEAK', payload: { text } });
  }

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
        <button onClick={goToLibrary} className="notion-btn-primary text-[14px]">
          Back to Library
        </button>
      </div>
    );
  }

  const fontClass = getFontClass(appearance.fontFamily, appearance.fontSize);

  return (
    <TooltipProvider>
      <div
        className={cn(
          'h-screen flex flex-col overflow-hidden bg-[var(--color-canvas-soft)] text-[var(--color-ink)]',
          fontClass,
        )}
      >
        <ReaderTopBar
          title={doc.title}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onExportMd={() => downloadMarkdown(doc)}
          onCopyMd={() => {
            // DEV-8: copy note as markdown to clipboard
            const md = `# ${doc.title}\n\n${doc.content ?? doc.textContent ?? ''}`;
            navigator.clipboard.writeText(md).catch(() => {});
          }}
          onExportPdf={() => {
            setPdfExportStatus('preparing');
            void (async () => {
              try {
                const svgs = new Map<string, string>();
                document.querySelectorAll('[data-diagram-id]').forEach((el) => {
                  const id = el.getAttribute('data-diagram-id');
                  const svg = el.querySelector('svg');
                  if (id && svg) svgs.set(id, svg.outerHTML);
                });
                const ok = await exportViaPrint(doc, doc.documentType, svgs);
                setPdfExportStatus(ok ? 'done' : 'error');
              } catch {
                setPdfExportStatus('error');
              }
              setTimeout(() => setPdfExportStatus('idle'), 3000);
            })();
          }}
          folderName={folder?.name}
          folderColor={folder?.color}
          onToggleTheme={toggleTheme}
          themeLabel={appearance.theme.toUpperCase()}
          showSidePanel={showSidePanel}
          onToggleSidePanel={() => setShowSidePanel((v) => !v)}
          depthMode={depthMode}
          onDepthModeChange={setDepthMode}
          pdfExportStatus={pdfExportStatus}
          ttsStatus={ttsStatus}
          onTtsReadAloud={() =>
            handleTtsReadAloud(doc?.content ?? doc?.textContent ?? doc?.summary ?? '')
          }
        />

        <div className="flex flex-1 overflow-hidden">
          <div
            ref={leftPaneRef}
            className={cn(
              'border-r border-[var(--color-hairline)] overflow-y-auto transition-all duration-200 bg-white',
              showSidePanel ? 'w-[70%]' : 'w-full',
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
                {doc.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] font-medium rounded-full border-[var(--color-hairline)] text-[var(--color-ink-muted)]"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              <Separator className="bg-[var(--color-hairline)] mb-8" />
              {(() => {
                const contentForParse = doc.content ?? doc.enrichedContent ?? doc.summary ?? '';
                const parsed = parseMarkdown(contentForParse);
                const total = parsed.blocks.length;
                const known = parsed.blocks.filter((b) => b.type !== 'unknown').length;
                log.info(
                  'READER',
                  `parseMarkdown: total=${total}, known=${known}, contentLen=${contentForParse.length}`,
                );
                const parseFailed =
                  parsed.blocks.length > 0 && parsed.blocks.every((b) => b.type === 'unknown');
                if (!parseFailed) return null;
                return (
                  <EmptyState
                    message="Reader parse failed"
                    action={{
                      label: 'View Raw Markdown',
                      onClick: () => setShowRawMarkdown((v) => !v),
                    }}
                    className="mb-6"
                  />
                );
              })()}
              {showRawMarkdown ? (
                <pre className="text-[13px] text-[var(--color-ink-muted)] whitespace-pre-wrap break-words border border-[var(--color-hairline)] rounded-lg p-5 bg-[var(--color-canvas-soft)]">
                  {doc.content ?? doc.enrichedContent ?? doc.summary ?? ''}
                </pre>
              ) : (
                <DocumentRenderer
                  content={doc.content ?? doc.enrichedContent ?? doc.summary ?? ''}
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
                {activeTab === 'notes' ? (
                  <NotesPanel doc={doc} leftPaneRef={leftPaneRef} />
                ) : (
                  <ChatPanel
                    doc={doc}
                    prefillQuery={chatPrefill}
                    leftPaneRef={leftPaneRef}
                    folderColor={folder?.color}
                    allDocIds={allDocIds}
                  />
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
