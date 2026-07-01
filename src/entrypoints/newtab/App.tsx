import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import { log } from '@/lib/logger';
import type { DocumentMeta, Folder, TagColorMap, ViewMode } from '@/lib/types';
import {
  getDocIndex,
  getDocumentMetas,
  deleteDocument,
  updateDocumentMeta,
  getFolders,
  saveFolder,
  deleteFolder,
  getTagColors,
  getViewMode,
  saveViewMode,
  getSettings,
  getAppearance,
} from '@/lib/storage';
import { FOLDER_COLORS } from '@/lib/color-palette';
import { applyAppearance, watchAppearance } from '@/lib/theme';
import { openSettings } from '@/lib/navigation';
import { importNotchPDF } from '@/lib/import';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/toast';

type ExportFolderFn = (folderId: string, format: 'markdown' | 'pdf') => Promise<Blob>;
let _exportFolderAsZip: ExportFolderFn | undefined;
void (import('@/lib/zip-export') as Promise<{ exportFolderAsZip: ExportFolderFn }>)
  .then((m) => {
    _exportFolderAsZip = m.exportFolderAsZip;
  })
  .catch(() => {});

const PAGE_SIZE = 12;

const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.3 },
    { name: 'summary', weight: 0.15 },
    { name: 'tags', weight: 0.15 },
    { name: 'domain', weight: 0.1 },
    { name: 'topEntities', weight: 0.1 },
    { name: 'topConcepts', weight: 0.1 },
    { name: 'documentType', weight: 0.1 },
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
};

type Filter = 'all' | 'favorites' | 'archive' | 'unread';
type SortOrder = 'newest' | 'oldest' | 'title-az';
type ImportStatus = 'idle' | 'importing' | 'done' | 'error';

type DensityLevel = 'Low' | 'Medium' | 'High' | 'Very High';

function computeDensity(meta: DocumentMeta): DensityLevel {
  const score =
    (meta.entityCount ?? 0) * 2 +
    (meta.conceptCount ?? 0) * 2 +
    (meta.diagramCount ?? 0) * 3 +
    (meta.hasTimeline ? 3 : 0) +
    (meta.qualityScore ?? 0) * 0.1;
  if (score >= 30) return 'Very High';
  if (score >= 15) return 'High';
  if (score >= 6) return 'Medium';
  return 'Low';
}

// Monochrome ink ramp (DESIGN.md): density reads as intensity, not hue. CSS
// vars so the ramp inverts cleanly in dark mode.
const DENSITY_COLORS: Record<DensityLevel, string> = {
  Low: 'var(--color-ink-faint)',
  Medium: 'var(--color-ink-muted)',
  High: 'var(--color-ink-secondary)',
  'Very High': 'var(--color-ink)',
};

function NavItem({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-1.5 text-[14px] font-medium rounded-md transition-all flex items-center gap-2',
        active
          ? 'bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
          : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]',
      )}
    >
      {icon && <span className="text-[16px] w-5 text-center">{icon}</span>}
      {label}
    </button>
  );
}

function SearchInput({
  metas,
  onSearchResults,
  onQueryChange,
}: {
  metas: DocumentMeta[];
  onSearchResults: (r: DocumentMeta[] | null, q: string) => void;
  onQueryChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fuse = useMemo(() => new Fuse(metas, fuseOptions), [metas]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    onQueryChange();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (q.trim().length < 2) {
        onSearchResults(null, '');
      } else {
        const results = fuse.search(q).map((r) => r.item);
        onSearchResults(results, q);
      }
    }, 150);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Input
      ref={inputRef}
      placeholder="Search knowledge base... (/)"
      onChange={handleChange}
      className="w-64 text-[13px]"
    />
  );
}

// ── Knowledge Overview (Task 4) ──────────────────────────────────────────────

function KnowledgeOverview({ metas }: { metas: DocumentMeta[] }) {
  const stats = useMemo(() => {
    let entityCount = 0;
    let conceptCount = 0;
    let timelineCount = 0;
    let diagramCount = 0;
    let imageCount = 0;
    for (const m of metas) {
      entityCount += m.entityCount ?? 0;
      conceptCount += m.conceptCount ?? 0;
      if (m.hasTimeline) timelineCount++;
      diagramCount += m.diagramCount ?? 0;
      imageCount += m.imageCount ?? 0;
    }
    return { entityCount, conceptCount, timelineCount, diagramCount, imageCount };
  }, [metas]);

  const items = [
    { label: 'Documents', value: metas.length, icon: '\u{1F4CB}' },
    { label: 'Entities', value: stats.entityCount, icon: '\u25C6' },
    { label: 'Concepts', value: stats.conceptCount, icon: '\u{1F9E0}' },
    { label: 'Timelines', value: stats.timelineCount, icon: '\u{1F4C5}' },
    { label: 'Diagrams', value: stats.diagramCount, icon: '\u{1F4CA}' },
    { label: 'Images', value: stats.imageCount, icon: '\u{1F5BC}' },
  ];

  if (metas.length === 0) return null;

  return (
    <div className="px-6 pt-5 pb-2">
      <h2 className="text-[13px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">
        Knowledge Base
      </h2>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-white"
          >
            <span className="text-[14px] leading-none">{item.icon}</span>
            <span className="text-[18px] font-bold text-[var(--color-ink)] tabular-nums">
              {item.value}
            </span>
            <span className="text-[11px] text-[var(--color-ink-muted)]">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Trending Knowledge (Task 5) ──────────────────────────────────────────────

function TrendingKnowledge({ metas }: { metas: DocumentMeta[] }) {
  const trending = useMemo(() => {
    const entityFreq: Record<string, number> = {};
    const conceptFreq: Record<string, number> = {};
    for (const m of metas) {
      for (const e of m.topEntities ?? []) {
        entityFreq[e] = (entityFreq[e] ?? 0) + 1;
      }
      for (const c of m.topConcepts ?? []) {
        conceptFreq[c] = (conceptFreq[c] ?? 0) + 1;
      }
    }
    const topEntities = Object.entries(entityFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    const topConcepts = Object.entries(conceptFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name]) => name);
    return { topEntities, topConcepts };
  }, [metas]);

  if (metas.length === 0) return null;
  if (trending.topEntities.length === 0 && trending.topConcepts.length === 0) return null;

  return (
    <div className="px-6 pb-2">
      <div className="flex gap-8 flex-wrap">
        {trending.topEntities.length > 0 && (
          <div>
            <span className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide">
              Trending Entities
            </span>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {trending.topEntities.map((e) => (
                <span
                  key={e}
                  className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-primary)]/5 text-[var(--color-primary)] border border-[var(--color-primary)]/15"
                >
                  {e}
                </span>
              ))}
            </div>
          </div>
        )}
        {trending.topConcepts.length > 0 && (
          <div>
            <span className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide">
              Trending Concepts
            </span>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {trending.topConcepts.map((c) => (
                <span
                  key={c}
                  className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] border border-[var(--color-accent-purple)]/20"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LIB-5: Topic Clusters ─────────────────────────────────────────────────────

function TopicClusters({
  metas,
  onTagClick,
}: {
  metas: DocumentMeta[];
  onTagClick: (tag: string) => void;
}) {
  const clusters = useMemo(() => {
    const tagFreq: Record<string, number> = {};
    for (const m of metas) {
      for (const t of m.tags ?? []) {
        tagFreq[t] = (tagFreq[t] ?? 0) + 1;
      }
    }
    return Object.entries(tagFreq)
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));
  }, [metas]);

  if (clusters.length < 2) return null;

  return (
    <div className="px-6 pb-3">
      <h2 className="text-[13px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-2">
        Topic Clusters
      </h2>
      <div className="flex flex-wrap gap-1.5">
        {clusters.map(({ tag, count }) => (
          <button
            key={tag}
            onClick={() => onTagClick(tag)}
            className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border border-[var(--color-hairline)] bg-white hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] transition-all group"
          >
            <span>{tag}</span>
            <span className="text-[9px] font-bold opacity-50 group-hover:opacity-70">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Document Type Badge (Task 2) ─────────────────────────────────────────────

const DOC_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  Tutorial: { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  'Research Paper': { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  Documentation: { bg: '#fff3e0', text: '#e65100', border: '#ffcc80' },
  News: { bg: '#fce4ec', text: '#c62828', border: '#ef9a9a' },
  Analysis: { bg: '#f3e5f5', text: '#6a1b9a', border: '#ce93d8' },
  Reference: { bg: '#e0f2f1', text: '#00695c', border: '#80cbc4' },
};

function DocTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const style = DOC_TYPE_STYLES[type];
  if (!style) {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-[var(--color-hairline)] text-[var(--color-ink-muted)]">
        {type}
      </span>
    );
  }
  return (
    <span
      className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
      style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
    >
      {type}
    </span>
  );
}

// ── Hover Preview (Task 8) ──────────────────────────────────────────────────

function HoverPreview({ meta }: { meta: DocumentMeta }) {
  const density = computeDensity(meta);
  const densityColor = DENSITY_COLORS[density];

  return (
    <div className="absolute left-0 right-0 bottom-full mb-2 z-50 bg-white border border-[var(--color-hairline)] rounded-xl shadow-level-2 p-4 pointer-events-none animate-page-enter">
      {meta.summary && (
        <p className="text-[13px] text-[var(--color-ink-muted)] leading-relaxed line-clamp-3 mb-3">
          {meta.summary}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-[var(--color-ink-muted)] mb-2">
        <span className="font-medium">{meta.entityCount ?? 0} entities</span>
        <span className="text-[var(--color-hairline)]">|</span>
        <span className="font-medium">{meta.conceptCount ?? 0} concepts</span>
        {meta.hasTimeline && (
          <>
            <span className="text-[var(--color-hairline)]">|</span>
            <span className="font-medium">Timeline</span>
          </>
        )}
        {meta.diagramCount ? (
          <>
            <span className="text-[var(--color-hairline)]">|</span>
            <span className="font-medium">{meta.diagramCount} diagrams</span>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2 text-[11px]">
        {meta.readingTimeMinutes && (
          <span className="text-[var(--color-ink-faint)]">{meta.readingTimeMinutes} min read</span>
        )}
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${densityColor} 14%, transparent)`,
            color: densityColor,
          }}
        >
          {density} density
        </span>
      </div>
    </div>
  );
}

// ── Document Card (Tasks 1, 2, 3, 13, 14) ────────────────────────────────────

interface DocumentCardProps {
  meta: DocumentMeta;
  folders: Folder[];
  viewMode: ViewMode;
  onStar: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onMoveToFolder: (id: string, folderId: string | undefined) => void;
  activeTag: string | null;
  onDragStart?: (e: React.DragEvent, docId: string) => void;
  tagColors: TagColorMap;
}

function DocumentCard({
  meta,
  folders,
  viewMode,
  onStar,
  onArchive,
  onDelete,
  onTagClick,
  onMoveToFolder,
  activeTag,
  onDragStart,
  tagColors,
}: DocumentCardProps) {
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const density = computeDensity(meta);
  const densityColor = DENSITY_COLORS[density];

  function stop<T>(fn: () => T) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      fn();
    };
  }

  function handleMouseEnter() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setShowPreview(true), 400);
  }

  function handleMouseLeave() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setShowPreview(false);
  }

  const currentFolder = folders.find((f) => f.id === meta.folder);

  const folderMenu = (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setShowFolderMenu((v) => !v)}
        title="Move to folder"
        className="text-[13px] text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors px-2.5 py-1.5 min-w-[48px] flex items-center justify-center"
      >
        Move
      </button>
      {showFolderMenu && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[var(--color-hairline)] rounded-lg min-w-[140px] shadow-level-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => {
              onMoveToFolder(meta.id, undefined);
              setShowFolderMenu(false);
            }}
            className="w-full text-left text-[12px] px-3 py-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] rounded-t-lg transition-colors"
          >
            No folder
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                onMoveToFolder(meta.id, f.id);
                setShowFolderMenu(false);
              }}
              className={cn(
                'w-full flex items-center gap-2 text-left text-[12px] px-3 py-2 transition-colors hover:bg-[var(--color-surface-hover)]',
                meta.folder === f.id
                  ? 'text-[var(--color-primary)] font-medium'
                  : 'text-[var(--color-ink-muted)]',
              )}
            >
              <span
                className="inline-block w-2 h-2 rounded-sm shrink-0"
                style={{ backgroundColor: f.color }}
              />
              <span className="truncate">{f.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (viewMode === 'compact') {
    return (
      <div
        draggable
        onDragStart={(e) => {
          setIsDragging(true);
          onDragStart?.(e, meta.id);
        }}
        onDragEnd={() => setIsDragging(false)}
        onClick={() => {
          browser.tabs
            .create({ url: browser.runtime.getURL(`/reader.html?documentId=${meta.id}`) })
            .catch(() => {});
        }}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-lg border border-[var(--color-hairline)] bg-white hover:border-[var(--color-primary)] hover:shadow-level-1 transition-all',
          isDragging && 'opacity-50',
        )}
      >
        <button
          onClick={stop(() => onStar(meta.id, !meta.isStarred))}
          title={meta.isStarred ? 'Unstar' : 'Star'}
          className={cn(
            'text-[18px] transition-colors shrink-0 leading-none flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)]',
            meta.isStarred
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]',
          )}
        >
          {meta.isStarred ? '\u2605' : '\u2606'}
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-1.5 truncate max-w-[30%] shrink-0">
            {!meta.isRead && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0"
                title="Unread"
              />
            )}
            <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate">
              {meta.title}
            </p>
          </div>
          <DocTypeBadge type={meta.documentType} />
          <span className="text-[11px] text-[var(--color-ink-muted)] truncate max-w-[12%] shrink-0">
            {meta.domain}
          </span>
          <div className="flex gap-1 overflow-hidden">
            {meta.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border truncate"
                style={
                  tagColors[tag]
                    ? {
                        borderColor: tagColors[tag],
                        color: tagColors[tag],
                        background: `${tagColors[tag]}10`,
                      }
                    : { borderColor: 'var(--color-hairline)', color: 'var(--color-ink-muted)' }
                }
              >
                {tag}
              </span>
            ))}
          </div>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: `color-mix(in srgb, ${densityColor} 12%, transparent)`,
              color: densityColor,
            }}
          >
            {density}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={stop(() => onArchive(meta.id, !meta.isArchived))}
            title={meta.isArchived ? 'Unarchive' : 'Archive'}
            className={cn(
              'text-[16px] transition-colors flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] leading-none',
              meta.isArchived
                ? 'text-[var(--color-primary)]'
                : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]',
            )}
          >
            &#x22A1;
          </button>
          {folderMenu}
          <button
            onClick={stop(() => onDelete(meta.id))}
            title="Delete"
            className="text-[16px] flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-faint)] hover:text-[var(--color-destructive)] transition-colors leading-none"
          >
            &times;
          </button>
        </div>
      </div>
    );
  }

  const knowledgeMeta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-ink-muted)]">
      {(meta.entityCount ?? 0) > 0 && (
        <span className="font-medium">◆ {meta.entityCount} entities</span>
      )}
      {(meta.conceptCount ?? 0) > 0 && (
        <span className="font-medium">🧠 {meta.conceptCount} concepts</span>
      )}
      {meta.hasTimeline && <span className="font-medium">📅 Timeline</span>}
      {(meta.diagramCount ?? 0) > 0 && (
        <span className="font-medium">
          📊 {meta.diagramCount} diagram{(meta.diagramCount ?? 0) > 1 ? 's' : ''}
        </span>
      )}
      {(meta.imageCount ?? 0) > 0 && (
        <span className="font-medium">
          📷 {meta.imageCount} image{(meta.imageCount ?? 0) > 1 ? 's' : ''}
        </span>
      )}
    </div>
  );

  const hasKnowledge =
    (meta.entityCount ?? 0) > 0 ||
    (meta.conceptCount ?? 0) > 0 ||
    meta.hasTimeline ||
    (meta.diagramCount ?? 0) > 0 ||
    (meta.imageCount ?? 0) > 0;

  const topItems = (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {(meta.topEntities?.length ?? 0) > 0 && (
        <div>
          <span className="text-[10px] font-medium text-[var(--color-ink-faint)]">
            Top entities:
          </span>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {meta.topEntities!.slice(0, 3).map((e) => (
              <span
                key={e}
                className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-primary)]/5 text-[var(--color-primary)]"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      )}
      {(meta.topConcepts?.length ?? 0) > 0 && (
        <div>
          <span className="text-[10px] font-medium text-[var(--color-ink-faint)]">
            Top concepts:
          </span>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {meta.topConcepts!.slice(0, 3).map((c) => (
              <span
                key={c}
                className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-accent-purple)]/10 text-[var(--color-accent-purple)] "
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const detailRow = (
    <div className="flex items-center gap-3 text-[11px] text-[var(--color-ink-faint)]">
      {meta.readingTimeMinutes && <span>{meta.readingTimeMinutes} min read</span>}
      <span className="text-[var(--color-hairline)]">|</span>
      <span>{meta.capturedAt.slice(0, 10)}</span>
      {currentFolder && (
        <>
          <span className="text-[var(--color-hairline)]">|</span>
          <div className="flex items-center gap-1">
            <span
              className="inline-block w-1.5 h-1.5 rounded-sm"
              style={{ backgroundColor: currentFolder.color }}
            />
            <span className="text-[11px] font-medium" style={{ color: currentFolder.color }}>
              {currentFolder.name}
            </span>
          </div>
        </>
      )}
      <span className="ml-auto">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: `color-mix(in srgb, ${densityColor} 12%, transparent)`,
            color: densityColor,
          }}
        >
          {density}
        </span>
      </span>
    </div>
  );

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart?.(e, meta.id);
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => {
        browser.tabs
          .create({ url: browser.runtime.getURL(`/reader.html?documentId=${meta.id}`) })
          .catch(() => {});
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative flex flex-col gap-3 cursor-pointer rounded-xl border border-[var(--color-hairline)] bg-white hover:border-[var(--color-primary)] hover:shadow-level-1 transition-all group',
        viewMode === 'detailed' ? 'p-5' : 'p-4',
        isDragging && 'opacity-50',
      )}
    >
      {showPreview && viewMode !== 'detailed' && <HoverPreview meta={meta} />}

      <div className="flex gap-3 justify-between items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {!meta.isRead && (
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0 mt-0.5"
                title="Unread"
              />
            )}
            <p
              className={cn(
                'font-semibold text-[var(--color-ink)] leading-snug',
                viewMode === 'detailed' ? 'text-[17px]' : 'text-[15px]',
              )}
            >
              {meta.title}
            </p>
          </div>
          <div className="mt-1">
            <DocTypeBadge type={meta.documentType} />
          </div>
        </div>
        <button
          onClick={stop(() => onStar(meta.id, !meta.isStarred))}
          title={meta.isStarred ? 'Unstar' : 'Star'}
          className={cn(
            'text-[18px] flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors shrink-0 leading-none',
            meta.isStarred
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]',
          )}
        >
          {meta.isStarred ? '\u2605' : '\u2606'}
        </button>
      </div>

      {viewMode === 'detailed' && meta.summary && (
        <p className="text-[13px] text-[var(--color-ink-muted)] leading-relaxed line-clamp-3 border-l-2 border-[var(--color-hairline)] pl-3">
          {meta.summary}
        </p>
      )}

      {hasKnowledge && knowledgeMeta}

      {hasKnowledge && viewMode === 'detailed' && topItems}

      <div className="flex flex-wrap items-center gap-1.5">
        {meta.tags.slice(0, viewMode === 'detailed' ? undefined : 3).map((tag) => {
          const tagColor = tagColors[tag];
          return (
            <Badge
              key={tag}
              variant="outline"
              onClick={stop(() => onTagClick(tag))}
              className={cn(
                'text-[10px] font-medium px-2 py-0.5 cursor-pointer transition-colors rounded-full',
                activeTag === tag
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
              )}
              style={
                tagColor && activeTag !== tag
                  ? { borderColor: tagColor, color: tagColor }
                  : undefined
              }
            >
              {tag}
            </Badge>
          );
        })}
      </div>

      {detailRow}

      <div className="flex gap-1 items-center text-[14px]">
        <button
          onClick={stop(() => onArchive(meta.id, !meta.isArchived))}
          title={meta.isArchived ? 'Unarchive' : 'Archive'}
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors leading-none',
            meta.isArchived
              ? 'text-[var(--color-primary)]'
              : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]',
          )}
        >
          &#x22A1;
        </button>
        {folderMenu}
        <button
          onClick={stop(() => onDelete(meta.id))}
          title="Delete"
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-faint)] hover:text-[var(--color-destructive)] ml-auto transition-colors leading-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

function StorageQuotaWarning({
  usedBytes,
  quotaBytes,
  onDismiss,
}: {
  usedBytes: number;
  quotaBytes: number;
  onDismiss: () => void;
}) {
  const pct = Math.round((usedBytes / quotaBytes) * 100);
  return (
    <div className="mx-6 mt-3 px-4 py-2.5 border border-[var(--color-destructive)] rounded-lg bg-[var(--color-destructive)]/5 flex items-center justify-between gap-3">
      <span className="text-[12px] font-medium text-[var(--color-destructive)]">
        Storage warning: {pct}% used — archive or delete documents to free space
      </span>
      <button
        onClick={onDismiss}
        className="text-[16px] text-[var(--color-destructive)] hover:opacity-70 shrink-0 leading-none"
      >
        &times;
      </button>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-4 border-t border-[var(--color-hairline)] bg-white">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        &larr; Previous
      </button>
      <span className="text-[13px] text-[var(--color-ink-muted)]">
        {page} / {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={page === totalPages}
        className="text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        Next &rarr;
      </button>
    </div>
  );
}

function EmptyLibrary({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-12 text-center">
      <span className="text-[40px] mb-4 leading-none">{icon}</span>
      <h3 className="text-[17px] font-semibold text-[var(--color-ink)] mb-2">{title}</h3>
      <p className="text-[13px] text-[var(--color-ink-muted)] max-w-[320px] leading-relaxed mb-6">
        {description}
      </p>
      {action && (
        <button onClick={action.onClick} className="notion-btn-primary text-[13px] px-5 py-2">
          {action.label}
        </button>
      )}
    </div>
  );
}

function DocumentGrid({
  metas,
  folders,
  viewMode,
  loading,
  error,
  onStar,
  onArchive,
  onDelete,
  onTagClick,
  onMoveToFolder,
  activeTag,
  onDragStart,
  tagColors,
  activeFolderId,
  hasApiKey,
  onAddDocument,
  bulkMode,
  selectedIds,
  onToggleSelect,
}: {
  metas: DocumentMeta[];
  folders: Folder[];
  viewMode: ViewMode;
  loading: boolean;
  error: string | null;
  onStar: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  onMoveToFolder: (id: string, folderId: string | undefined) => void;
  activeTag: string | null;
  onDragStart: (e: React.DragEvent, docId: string) => void;
  tagColors: TagColorMap;
  activeFolderId: string | null;
  hasApiKey: boolean;
  onAddDocument: () => void;
  // LIB-3: bulk selection
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  if (error) {
    return (
      <EmptyLibrary
        icon={'\u26A0\uFE0F'}
        title="Something went wrong"
        description={error}
        action={{ label: 'Try Again', onClick: () => window.location.reload() }}
      />
    );
  }
  if (loading) {
    return (
      <div
        className={cn(
          'grid gap-3 p-6',
          viewMode === 'compact'
            ? 'grid-cols-1'
            : viewMode === 'detailed'
              ? 'grid-cols-2'
              : 'grid-cols-3',
        )}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton
            key={i}
            className={
              viewMode === 'compact'
                ? 'h-10 rounded-lg'
                : viewMode === 'detailed'
                  ? 'h-64 rounded-xl'
                  : 'h-52 rounded-xl'
            }
          />
        ))}
      </div>
    );
  }
  if (metas.length === 0) {
    if (activeFolderId) {
      return (
        <EmptyLibrary
          icon={'\u{1F4C2}'}
          title="This collection is empty"
          description="Capture pages to this collection, or drag existing documents here."
          action={{
            label: 'Add Document',
            onClick: () => {
              onAddDocument();
            },
          }}
        />
      );
    }
    if (!hasApiKey) {
      return (
        <EmptyLibrary
          icon={'\u{1F511}'}
          title="No API key set"
          description="Configure an AI provider in Settings to start capturing and structuring documents."
          action={{
            label: 'Open Settings',
            onClick: () => {
              void openSettings();
            },
          }}
        />
      );
    }
    return (
      <EmptyLibrary
        icon={'\u{1F4CB}'}
        title="No knowledge objects yet"
        description="Open any web page, open the Notch extension, and click 'Capture this page' to save your first document."
        action={{
          label: 'Learn More',
          onClick: () => {
            browser.tabs.create({ url: 'https://notch.ai' }).catch(() => {});
          },
        }}
      />
    );
  }
  return (
    <div
      className={cn(
        'grid gap-3 p-6',
        viewMode === 'compact'
          ? 'grid-cols-1'
          : viewMode === 'detailed'
            ? 'grid-cols-2'
            : 'grid-cols-3',
      )}
    >
      {metas.map((meta) => (
        <div key={meta.id} className="relative">
          {/* LIB-3: bulk selection checkbox overlay */}
          {bulkMode && (
            <button
              onClick={() => onToggleSelect?.(meta.id)}
              className={cn(
                'absolute top-2 left-2 z-20 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                selectedIds?.has(meta.id)
                  ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'bg-white border-[var(--color-hairline)] hover:border-[var(--color-primary)]',
              )}
            >
              {selectedIds?.has(meta.id) && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                  <path
                    d="M2 5l2 2 4-4"
                    stroke="white"
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          )}
          <div
            onClick={() => bulkMode && onToggleSelect?.(meta.id)}
            className={cn(
              bulkMode &&
                selectedIds?.has(meta.id) &&
                'ring-2 ring-[var(--color-primary)] rounded-xl',
            )}
          >
            <DocumentCard
              meta={meta}
              folders={folders}
              viewMode={viewMode}
              onStar={onStar}
              onArchive={onArchive}
              onDelete={onDelete}
              onTagClick={onTagClick}
              onMoveToFolder={onMoveToFolder}
              activeTag={activeTag}
              onDragStart={onDragStart}
              tagColors={tagColors}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LibraryApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('comfortable');
  const [metas, setMetas] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<DocumentMeta[] | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [quotaWarning, setQuotaWarning] = useState<{
    usedBytes: number;
    quotaBytes: number;
  } | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [tagColors, setTagColors] = useState<TagColorMap>({});
  const [hasApiKey, setHasApiKey] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const { addToast } = useToast();
  // LIB-3: bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [index, storedFolders, storedTagColors, storedViewMode, storedSettings] =
          await Promise.all([
            getDocIndex(),
            getFolders(),
            getTagColors(),
            getViewMode(),
            getSettings(),
          ]);
        setFolders(storedFolders);
        setTagColors(storedTagColors);
        setViewMode(storedViewMode);
        setHasApiKey(Boolean(storedSettings.apiKey));
        if (index.length === 0) {
          setLoading(false);
          return;
        }
        const firstBatch = await getDocumentMetas(index.slice(0, 20));
        setMetas(firstBatch);
        setLoading(false);
        if (index.length > 20) {
          const rest = await getDocumentMetas(index.slice(20));
          setMetas((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...rest.filter((m) => !seen.has(m.id))];
          });
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load documents');
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    void getAppearance().then(applyAppearance);
    return watchAppearance(applyAppearance);
  }, []);

  useEffect(() => {
    function onMsg(msg: unknown) {
      if (
        msg &&
        typeof msg === 'object' &&
        (msg as { type?: string }).type === 'STORAGE_QUOTA_WARNING'
      ) {
        const m = msg as { payload: { usedBytes: number; quotaBytes: number } };
        setQuotaWarning(m.payload);
      }
    }
    browser.runtime.onMessage.addListener(onMsg);
    return () => browser.runtime.onMessage.removeListener(onMsg);
  }, []);

  function handleStar(id: string, starred: boolean) {
    setMetas((prev) => prev.map((m) => (m.id === id ? { ...m, isStarred: starred } : m)));
    void updateDocumentMeta(id, { isStarred: starred });
  }
  function handleArchive(id: string, archived: boolean) {
    setMetas((prev) => prev.map((m) => (m.id === id ? { ...m, isArchived: archived } : m)));
    void updateDocumentMeta(id, { isArchived: archived });
  }
  function handleDelete(id: string) {
    setMetas((prev) => prev.filter((m) => m.id !== id));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    void deleteDocument(id);
  }

  // LIB-3: bulk delete
  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setMetas((prev) => prev.filter((m) => !selectedIds.has(m.id)));
    ids.forEach((id) => {
      void deleteDocument(id);
    });
    setSelectedIds(new Set());
    setBulkMode(false);
    addToast(`Deleted ${ids.length} document${ids.length > 1 ? 's' : ''}`, 'info');
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function handleFolderCreate(name: string, color: string) {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name,
      color,
      createdAt: new Date().toISOString(),
    };
    await saveFolder(folder);
    setFolders((prev) => [...prev, folder]);
  }
  async function handleFolderDelete(id: string) {
    await deleteFolder(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    if (activeFolderId === id) setActiveFolderId(null);
    setMetas((prev) => prev.map((m) => (m.folder === id ? { ...m, folder: undefined } : m)));
  }
  function handleMoveToFolder(docId: string, folderId: string | undefined) {
    setMetas((prev) => prev.map((m) => (m.id === docId ? { ...m, folder: folderId } : m)));
    void updateDocumentMeta(docId, { folder: folderId });
  }

  function handleDragStart(e: React.DragEvent, docId: string) {
    e.dataTransfer.setData('text/plain', docId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDropDocumentOnFolder(docId: string, folderId: string) {
    handleMoveToFolder(docId, folderId);
  }

  async function handleExportFolder(folderId: string) {
    if (!_exportFolderAsZip) {
      addToast('Export not yet available', 'info');
      return;
    }
    const folder = folders.find((f) => f.id === folderId);
    const count = metas.filter((m) => m.folder === folderId).length;
    if (count === 0) {
      addToast('No documents in this collection', 'info');
      return;
    }
    try {
      const blob = await _exportFolderAsZip(folderId, 'markdown');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folder?.name ?? 'collection'}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast(`Exported ${count} document${count !== 1 ? 's' : ''}`, 'info');
    } catch (err) {
      log.error('LIBRARY', 'Export failed', err);
      addToast('Export failed. Please try again.', 'info');
    }
  }

  function handleImportClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('importing');
    try {
      let docId: string;
      try {
        docId = await importNotchPDF(file);
      } catch {
        const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
        const importResult = await (
          browser.runtime.sendMessage as (
            ...args: unknown[]
          ) => Promise<{ type: string; payload: { error?: string; documentId?: string } }>
        )({
          type: 'IMPORT_PDF',
          payload: { fileName: file.name, bytes, tags: [] },
        });
        if (importResult.type === 'CAPTURE_ERROR')
          throw new Error(importResult.payload.error ?? 'Import failed');
        docId = importResult.payload.documentId!;
      }
      const index = await getDocIndex();
      const updatedMetas = await getDocumentMetas(index);
      setMetas(updatedMetas);
      setImportStatus('done');
      setTimeout(() => setImportStatus('idle'), 2500);
      void browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${docId}`) });
    } catch (err) {
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
      log.error('LIBRARY', 'PDF import failed', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  }

  function handleFilterChange(f: Filter) {
    setActiveFilter(f);
    setActiveFolderId(null);
    setPage(1);
  }
  function handleSortChange(s: SortOrder) {
    setSortOrder(s);
    setPage(1);
  }
  function handleTagClick(tag: string) {
    setActiveTag((prev) => (prev === tag ? null : tag));
    setPage(1);
  }
  function handleSearchReset() {
    setPage(1);
  }

  function handleSearchResults(results: DocumentMeta[] | null, _query: string) {
    setSearchResults(results);
  }

  const filtered = metas.filter((m) => {
    if (activeFolderId) return m.folder === activeFolderId;
    if (activeFilter === 'favorites') return m.isStarred;
    if (activeFilter === 'archive') return m.isArchived;
    if (activeFilter === 'unread') return !m.isRead && !m.isArchived;
    return !m.isArchived;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'newest')
      return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
    if (sortOrder === 'oldest')
      return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
    return a.title.localeCompare(b.title);
  });

  const tagFiltered = activeTag ? sorted.filter((m) => m.tags.includes(activeTag)) : sorted;
  const displayList = searchResults ?? tagFiltered;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.target as HTMLElement).tagName === 'INPUT' ||
        (e.target as HTMLElement).tagName === 'TEXTAREA'
      )
        return;
      if (displayList.length === 0) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, displayList.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const doc = displayList[selectedIndex];
        if (doc) {
          void browser.tabs.create({
            url: browser.runtime.getURL(`/reader.html?documentId=${doc.id}`),
          });
        }
      } else if (e.key === 's' && selectedIndex >= 0) {
        e.preventDefault();
        const doc = displayList[selectedIndex];
        if (doc) {
          void updateDocumentMeta(doc.id, { isStarred: !doc.isStarred });
          setMetas((prev) =>
            prev.map((m) => (m.id === doc.id ? { ...m, isStarred: !m.isStarred } : m)),
          );
          addToast(doc.isStarred ? 'Removed from favorites' : 'Added to favorites', 'info');
        }
      } else if (e.key === 'a' && selectedIndex >= 0) {
        e.preventDefault();
        const doc = displayList[selectedIndex];
        if (doc) {
          void updateDocumentMeta(doc.id, { isArchived: !doc.isArchived });
          setMetas((prev) =>
            prev.map((m) => (m.id === doc.id ? { ...m, isArchived: !m.isArchived } : m)),
          );
          addToast(doc.isArchived ? 'Unarchived' : 'Archived', 'info');
        }
      } else if (e.key === 'd' && selectedIndex >= 0) {
        e.preventDefault();
        const doc = displayList[selectedIndex];
        if (doc && confirm(`Delete "${doc.title}"?`)) {
          setMetas((prev) => prev.filter((m) => m.id !== doc.id));
          void deleteDocument(doc.id);
          addToast('Document deleted', 'info');
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayList, selectedIndex, addToast]);

  const totalPages = Math.max(1, Math.ceil(displayList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = displayList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex h-screen bg-[var(--color-canvas-soft)] text-[var(--color-ink)]">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          handleFileChange(e).catch(() => {});
        }}
        accept="application/pdf"
        className="hidden"
      />

      <div className="w-56 h-screen bg-white border-r border-[var(--color-hairline)] shrink-0 flex flex-col py-4">
        <div className="px-4 pb-4 flex items-center gap-2">
          <span className="text-[18px] font-bold tracking-tight text-[var(--color-ink)]">
            Notch
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-2">
          <div className="space-y-0.5 mb-4">
            <NavItem
              label="All documents"
              icon={'\u{1F4CB}'}
              active={activeFilter === 'all' && activeFolderId === null}
              onClick={() => handleFilterChange('all')}
            />
            <NavItem
              label="Favorites"
              icon={'\u2605'}
              active={activeFilter === 'favorites'}
              onClick={() => handleFilterChange('favorites')}
            />
            <NavItem
              label="Unread"
              icon={'\u25CF'}
              active={activeFilter === 'unread'}
              onClick={() => handleFilterChange('unread')}
            />
            <NavItem
              label="Archive"
              icon={'\u{1F4E6}'}
              active={activeFilter === 'archive'}
              onClick={() => handleFilterChange('archive')}
            />
            <NavItem
              label="Settings"
              icon={'\u2699'}
              active={false}
              onClick={() => {
                void openSettings();
              }}
            />
          </div>

          <Separator className="bg-[var(--color-hairline)] my-3" />

          <div className="flex items-center justify-between px-4 mb-1">
            <span className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide">
              Collections
            </span>
            <button
              onClick={() => setShowFolderInput((v) => !v)}
              className="text-[14px] text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors leading-none"
              title="New collection"
            >
              +
            </button>
          </div>

          {showFolderInput && (
            <div className="px-4 mb-2 flex flex-col gap-1.5">
              <input
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const name = newFolderName.trim();
                    if (name) {
                      void handleFolderCreate(name, newFolderColor);
                      setNewFolderName('');
                      setNewFolderColor(FOLDER_COLORS[0]);
                      setShowFolderInput(false);
                    }
                  }
                  if (e.key === 'Escape') setShowFolderInput(false);
                }}
                placeholder="Collection name"
                className="notion-input text-[12px]"
              />
              <div className="flex gap-1 flex-wrap">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewFolderColor(c)}
                    className="w-3.5 h-3.5 rounded-sm transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: newFolderColor === c ? `2px solid ${c}` : 'none',
                      outlineOffset: '1px',
                    }}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  const name = newFolderName.trim();
                  if (name) {
                    void handleFolderCreate(name, newFolderColor);
                    setNewFolderName('');
                    setNewFolderColor(FOLDER_COLORS[0]);
                    setShowFolderInput(false);
                  }
                }}
                className="text-[11px] font-medium text-[var(--color-primary)] text-left"
              >
                Create
              </button>
            </div>
          )}

          {folders.map((folder) => (
            <div
              key={folder.id}
              className={cn('group flex items-center rounded-md mx-2')}
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const docId = e.dataTransfer.getData('text/plain');
                if (docId) handleDropDocumentOnFolder(docId, folder.id);
              }}
            >
              <button
                onClick={() => {
                  setActiveFolderId(folder.id);
                  setActiveFilter('all');
                }}
                className={cn(
                  'flex items-center gap-2 flex-1 text-left px-2 py-1 text-[13px] font-medium rounded-md transition-all',
                  activeFolderId === folder.id
                    ? 'bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]',
                )}
              >
                <span
                  className="inline-block w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: folder.color }}
                />
                <span className="truncate">{folder.name}</span>
              </button>
              <button
                onClick={() => {
                  handleExportFolder(folder.id).catch(() => {});
                }}
                className="text-[var(--color-ink-faint)] hover:text-[var(--color-primary)] text-[11px] opacity-0 group-hover:opacity-100 transition-opacity px-1"
                title="Export collection"
              >
                ↓
              </button>
              <button
                onClick={() => {
                  handleFolderDelete(folder.id).catch(() => {});
                }}
                className="text-[var(--color-ink-faint)] hover:text-[var(--color-destructive)] text-[11px] opacity-0 group-hover:opacity-100 transition-opacity px-1"
                title="Delete collection"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <div className="px-4 mt-4">
          <button
            onClick={() => {
              handleImportClick();
            }}
            disabled={importStatus === 'importing'}
            className={cn(
              'w-full text-[12px] font-medium py-2 rounded-full border border-dashed transition-all',
              importStatus === 'importing'
                ? 'border-[var(--color-primary)] text-[var(--color-primary)] opacity-60 cursor-not-allowed'
                : importStatus === 'done'
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : importStatus === 'error'
                    ? 'border-[var(--color-destructive)] text-[var(--color-destructive)]'
                    : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]',
            )}
          >
            {importStatus === 'importing'
              ? 'Importing...'
              : importStatus === 'done'
                ? 'Imported'
                : importStatus === 'error'
                  ? 'Failed — retry'
                  : 'Import PDF'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-hairline)] bg-white">
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-ink)]">
              Knowledge Base
            </h1>
            <span className="text-[13px] text-[var(--color-ink-muted)]">
              {searchResults !== null
                ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`
                : `${displayList.length} knowledge object${displayList.length !== 1 ? 's' : ''}`}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SearchInput
              metas={filtered}
              onSearchResults={handleSearchResults}
              onQueryChange={handleSearchReset}
            />
            {folders.length > 0 && (
              <select
                value={activeFolderId ?? ''}
                onChange={(e) => {
                  setActiveFolderId(e.target.value || null);
                  setPage(1);
                }}
                className="text-[12px] font-medium bg-white border border-[var(--color-hairline)] text-[var(--color-ink-muted)] rounded-md px-2 py-1.5 focus:border-[var(--color-primary)] focus:outline-none cursor-pointer"
              >
                <option value="">All collections</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex gap-0.5 border border-[var(--color-hairline)] rounded-md overflow-hidden">
              {(
                [
                  { label: 'Newest', value: 'newest' },
                  { label: 'Oldest', value: 'oldest' },
                  { label: 'A–Z', value: 'title-az' },
                ] as const
              ).map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleSortChange(value)}
                  className={cn(
                    'px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                    sortOrder === value
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] bg-white',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-0.5 border border-[var(--color-hairline)] rounded-md overflow-hidden">
              {(['compact', 'comfortable', 'detailed'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setViewMode(v);
                    void saveViewMode(v);
                  }}
                  className={cn(
                    'px-2 py-1.5 text-[11px] font-medium transition-colors',
                    viewMode === v
                      ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] bg-white',
                  )}
                >
                  {v === 'compact' ? 'Compact' : v === 'comfortable' ? 'Comfort' : 'Detailed'}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                void openSettings();
              }}
              title="Settings"
              className="text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors px-2 py-1"
            >
              Settings
            </button>
            {/* LIB-3: bulk select toggle */}
            <button
              onClick={() => {
                setBulkMode((v) => !v);
                setSelectedIds(new Set());
              }}
              className={cn(
                'text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all',
                bulkMode
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)]',
              )}
            >
              {bulkMode ? '✓ Selecting' : 'Select'}
            </button>
          </div>
        </div>

        {/* LIB-3: floating bulk action bar */}
        {bulkMode && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#111111] text-white rounded-full px-4 py-2.5 shadow-xl">
            <label className="flex items-center gap-2 text-[12px] font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={selectedIds.size === pageSlice.length && pageSlice.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(pageSlice.map((m) => m.id)));
                  else setSelectedIds(new Set());
                }}
                className="accent-white w-3.5 h-3.5"
              />
              {selectedIds.size === 0 ? 'Select all' : `${selectedIds.size} selected`}
            </label>
            <span className="w-px h-4 bg-white/30" />
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="text-[12px] font-semibold text-red-300 hover:text-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Delete {selectedIds.size > 0 ? selectedIds.size : ''}
            </button>
            <button
              onClick={() => {
                setBulkMode(false);
                setSelectedIds(new Set());
              }}
              className="text-[11px] text-white/60 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {!searchResults && metas.length > 0 && (
          <>
            <KnowledgeOverview metas={metas} />
            <TrendingKnowledge metas={metas} />
            <TopicClusters metas={metas} onTagClick={handleTagClick} />
          </>
        )}

        {activeTag && (
          <div className="flex items-center gap-2 px-6 pt-3">
            <span className="text-[11px] text-[var(--color-ink-muted)]">Filtering by:</span>
            <Badge
              variant="outline"
              className="text-[11px] font-medium rounded-full border-[var(--color-primary)] text-[var(--color-primary)] gap-1.5"
            >
              {activeTag}
              <button
                onClick={() => {
                  setActiveTag(null);
                  setPage(1);
                }}
                className="hover:text-[var(--color-primary-active)] leading-none"
              >
                &times;
              </button>
            </Badge>
          </div>
        )}

        {quotaWarning && (
          <StorageQuotaWarning
            usedBytes={quotaWarning.usedBytes}
            quotaBytes={quotaWarning.quotaBytes}
            onDismiss={() => setQuotaWarning(null)}
          />
        )}

        <ScrollArea className="flex-1">
          <DocumentGrid
            metas={pageSlice}
            folders={folders}
            viewMode={viewMode}
            loading={loading}
            error={loadError}
            onStar={handleStar}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onTagClick={handleTagClick}
            onMoveToFolder={handleMoveToFolder}
            activeTag={activeTag}
            onDragStart={handleDragStart}
            tagColors={tagColors}
            activeFolderId={activeFolderId}
            hasApiKey={hasApiKey}
            onAddDocument={handleImportClick}
            bulkMode={bulkMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        </ScrollArea>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}
