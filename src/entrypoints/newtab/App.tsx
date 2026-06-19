import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import type { DocumentMeta, Folder, TagColorMap, ViewMode } from '@/lib/types';
import { getDocIndex, getDocumentMetas, deleteDocument, updateDocumentMeta, getFolders, saveFolder, deleteFolder, getTagColors, setTagColor, getViewMode, saveViewMode, getSettings, getAppearance } from '@/lib/storage';
import { FOLDER_COLORS } from '@/lib/color-palette';
import { applyAppearance, watchAppearance } from '@/lib/theme';
import { importNotchPDF } from '@/lib/import';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/ui/toast';

type ExportFolderFn = (folderId: string, format: 'markdown' | 'pdf') => Promise<Blob>;
let _exportFolderAsZip: ExportFolderFn | undefined;
void (import('@/lib/zip-export') as Promise<{ exportFolderAsZip: ExportFolderFn }>)
  .then(m => { _exportFolderAsZip = m.exportFolderAsZip; })
  .catch(() => {});

const PAGE_SIZE = 12;

const fuseOptions = {
  keys: [
    { name: 'title',        weight: 0.3 },
    { name: 'summary',      weight: 0.15 },
    { name: 'tags',         weight: 0.15 },
    { name: 'domain',       weight: 0.1 },
    { name: 'topEntities',  weight: 0.1 },
    { name: 'topConcepts',  weight: 0.1 },
    { name: 'documentType', weight: 0.1 },
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
};

type Filter = 'all' | 'favorites' | 'archive';
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

const DENSITY_COLORS: Record<DensityLevel, string> = {
  'Low': '#a39e98',
  'Medium': '#62aef0',
  'High': '#0075de',
  'Very High': '#213183',
};

function NavItem({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-1.5 text-[14px] font-medium rounded-md transition-all flex items-center gap-2',
        active
          ? 'bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
          : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]'
      )}
    >
      {icon && <span className="text-[16px] w-5 text-center">{icon}</span>}
      {label}
    </button>
  );
}

interface SearchMatch {
  field: string;
  value: string;
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
        const results = fuse.search(q).map(r => r.item);
        onSearchResults(results, q);
      }
    }, 150);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
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
      <h2 className="text-[13px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide mb-3">Knowledge Base</h2>
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-hairline)] bg-white"
          >
            <span className="text-[14px] leading-none">{item.icon}</span>
            <span className="text-[18px] font-bold text-[var(--color-ink)] tabular-nums">{item.value}</span>
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
              {trending.topEntities.map(e => (
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
              {trending.topConcepts.map(c => (
                <span
                  key={c}
                  className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-accent-purple)]/20 text-[var(--color-secondary)] border border-[var(--color-accent-purple)]/20"
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

// ── Document Type Badge (Task 2) ─────────────────────────────────────────────

const DOC_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Tutorial':       { bg: '#e8f5e9', text: '#2e7d32', border: '#a5d6a7' },
  'Research Paper': { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
  'Documentation':  { bg: '#fff3e0', text: '#e65100', border: '#ffcc80' },
  'News':           { bg: '#fce4ec', text: '#c62828', border: '#ef9a9a' },
  'Analysis':       { bg: '#f3e5f5', text: '#6a1b9a', border: '#ce93d8' },
  'Reference':      { bg: '#e0f2f1', text: '#00695c', border: '#80cbc4' },
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
        <span className="font-medium">{(meta.entityCount ?? 0)} entities</span>
        <span className="text-[var(--color-hairline)]">|</span>
        <span className="font-medium">{(meta.conceptCount ?? 0)} concepts</span>
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
          style={{ backgroundColor: `${densityColor}15`, color: densityColor }}
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

function DocumentCard({ meta, folders, viewMode, onStar, onArchive, onDelete, onTagClick, onMoveToFolder, activeTag, onDragStart, tagColors }: DocumentCardProps) {
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const density = computeDensity(meta);
  const densityColor = DENSITY_COLORS[density];

  function stop<T>(fn: () => T) {
    return (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  }

  function handleMouseEnter() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setShowPreview(true), 400);
  }

  function handleMouseLeave() {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setShowPreview(false);
  }

  const currentFolder = folders.find(f => f.id === meta.folder);

  const folderMenu = (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setShowFolderMenu(v => !v)}
        title="Move to folder"
        className="text-[13px] text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors px-2.5 py-1.5 min-w-[48px] flex items-center justify-center"
      >
        Move
      </button>
      {showFolderMenu && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-[var(--color-hairline)] rounded-lg min-w-[140px] shadow-level-1 max-h-48 overflow-y-auto">
          <button
            onClick={() => { onMoveToFolder(meta.id, undefined); setShowFolderMenu(false); }}
            className="w-full text-left text-[12px] px-3 py-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-hover)] rounded-t-lg transition-colors"
          >
            No folder
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => { onMoveToFolder(meta.id, f.id); setShowFolderMenu(false); }}
              className={cn(
                'w-full flex items-center gap-2 text-left text-[12px] px-3 py-2 transition-colors hover:bg-[var(--color-surface-hover)]',
                meta.folder === f.id ? 'text-[var(--color-primary)] font-medium' : 'text-[var(--color-ink-muted)]'
              )}
            >
              <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: f.color }} />
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
        onDragStart={e => { setIsDragging(true); onDragStart?.(e, meta.id); }}
        onDragEnd={() => setIsDragging(false)}
        onClick={() => browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${meta.id}`) })}
        className={cn(
          'flex items-center gap-3 px-4 py-2.5 cursor-pointer rounded-lg border border-[var(--color-hairline)] bg-white hover:border-[var(--color-primary)] hover:shadow-level-1 transition-all',
          isDragging && 'opacity-50'
        )}
      >
        <button
          onClick={stop(() => onStar(meta.id, !meta.isStarred))}
          title={meta.isStarred ? 'Unstar' : 'Star'}
          className={cn('text-[18px] transition-colors shrink-0 leading-none flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)]', meta.isStarred ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]')}
        >
          {meta.isStarred ? '\u2605' : '\u2606'}
        </button>
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <p className="text-[13px] font-semibold text-[var(--color-ink)] truncate max-w-[30%] shrink-0">{meta.title}</p>
          <DocTypeBadge type={meta.documentType} />
          <span className="text-[11px] text-[var(--color-ink-muted)] truncate max-w-[12%] shrink-0">{meta.domain}</span>
          <div className="flex gap-1 overflow-hidden">
            {meta.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="text-[10px] font-medium px-1.5 py-0.5 rounded-full border truncate"
                style={tagColors[tag]
                  ? { borderColor: tagColors[tag], color: tagColors[tag], background: `${tagColors[tag]}10` }
                  : { borderColor: 'var(--color-hairline)', color: 'var(--color-ink-muted)' }
                }
              >{tag}</span>
            ))}
          </div>
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
            style={{ backgroundColor: `${densityColor}12`, color: densityColor }}
          >
            {density}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={stop(() => onArchive(meta.id, !meta.isArchived))} title={meta.isArchived ? 'Unarchive' : 'Archive'} className={cn('text-[16px] transition-colors flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] leading-none', meta.isArchived ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]')}>&#x22A1;</button>
          {folderMenu}
          <button onClick={stop(() => onDelete(meta.id))} title="Delete" className="text-[16px] flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] text-[var(--color-ink-faint)] hover:text-[var(--color-destructive)] transition-colors leading-none">&times;</button>
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
      {meta.hasTimeline && (
        <span className="font-medium">📅 Timeline</span>
      )}
      {(meta.diagramCount ?? 0) > 0 && (
        <span className="font-medium">📊 {meta.diagramCount} diagram{(meta.diagramCount ?? 0) > 1 ? 's' : ''}</span>
      )}
      {(meta.imageCount ?? 0) > 0 && (
        <span className="font-medium">📷 {meta.imageCount} image{(meta.imageCount ?? 0) > 1 ? 's' : ''}</span>
      )}
    </div>
  );

  const hasKnowledge = (meta.entityCount ?? 0) > 0 || (meta.conceptCount ?? 0) > 0 || meta.hasTimeline || (meta.diagramCount ?? 0) > 0 || (meta.imageCount ?? 0) > 0;

  const topItems = (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {(meta.topEntities?.length ?? 0) > 0 && (
        <div>
          <span className="text-[10px] font-medium text-[var(--color-ink-faint)]">Top entities:</span>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {meta.topEntities!.slice(0, 3).map(e => (
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
          <span className="text-[10px] font-medium text-[var(--color-ink-faint)]">Top concepts:</span>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            {meta.topConcepts!.slice(0, 3).map(c => (
              <span
                key={c}
                className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--color-accent-purple)]/15 text-[var(--color-secondary)]"
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
      {meta.readingTimeMinutes && (
        <span>{meta.readingTimeMinutes} min read</span>
      )}
      <span className="text-[var(--color-hairline)]">|</span>
      <span>{meta.capturedAt.slice(0, 10)}</span>
      {currentFolder && (
        <>
          <span className="text-[var(--color-hairline)]">|</span>
          <div className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-sm" style={{ backgroundColor: currentFolder.color }} />
            <span className="text-[11px] font-medium" style={{ color: currentFolder.color }}>{currentFolder.name}</span>
          </div>
        </>
      )}
      <span className="ml-auto">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: `${densityColor}12`, color: densityColor }}
        >
          {density}
        </span>
      </span>
    </div>
  );

  return (
    <div
      draggable
      onDragStart={e => { setIsDragging(true); onDragStart?.(e, meta.id); }}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${meta.id}`) })}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative flex flex-col gap-3 cursor-pointer rounded-xl border border-[var(--color-hairline)] bg-white hover:border-[var(--color-primary)] hover:shadow-level-1 transition-all group',
        viewMode === 'detailed' ? 'p-5' : 'p-4',
        isDragging && 'opacity-50'
      )}
    >
      {showPreview && viewMode !== 'detailed' && (
        <HoverPreview meta={meta} />
      )}

      <div className="flex gap-3 justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className={cn("font-semibold text-[var(--color-ink)] leading-snug", viewMode === 'detailed' ? 'text-[17px]' : 'text-[15px]')}>
            {meta.title}
          </p>
          <div className="mt-1">
            <DocTypeBadge type={meta.documentType} />
          </div>
        </div>
        <button
          onClick={stop(() => onStar(meta.id, !meta.isStarred))}
          title={meta.isStarred ? 'Unstar' : 'Star'}
          className={cn('text-[18px] flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors shrink-0 leading-none', meta.isStarred ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]')}
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

      {hasKnowledge && (viewMode === 'detailed') && topItems}

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
                  : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
              )}
              style={tagColor && activeTag !== tag
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
          className={cn('flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors leading-none', meta.isArchived ? 'text-[var(--color-primary)]' : 'text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]')}
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

function ColorLegend({ folders, tagColors, onSetTagColor, allTags }: {
  folders: Folder[];
  tagColors: TagColorMap;
  onSetTagColor: (tag: string, color: string | null) => void;
  allTags: string[];
}) {
  const coloredFolders = folders.filter(f => f.color);
  const coloredTags = Object.entries(tagColors);

  if (coloredFolders.length === 0 && coloredTags.length === 0 && allTags.length === 0) return null;

  return (
    <div className="px-4 mt-4 border-t border-[var(--color-hairline)] pt-3">
      <span className="text-[10px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide block mb-2">Legend</span>

      {coloredFolders.map(f => (
        <div key={f.id} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: f.color }} />
          <span className="text-[11px] font-medium truncate" style={{ color: f.color }}>{f.name}</span>
        </div>
      ))}

      {coloredTags.map(([tag, color]) => (
        <div key={tag} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: color }} />
          <span className="text-[11px] font-medium truncate" style={{ color }}>{tag}</span>
          <button
            onClick={() => onSetTagColor(tag, null)}
            className="text-[10px] text-[var(--color-ink-faint)] hover:text-[var(--color-destructive)] ml-auto shrink-0 transition-colors"
            title="Remove color"
          >
            &times;
          </button>
        </div>
      ))}

      {allTags.filter(t => !tagColors[t]).length > 0 && (
        <>
          <span className="text-[9px] font-semibold text-[var(--color-ink-faint)] uppercase tracking-wide block mt-2 mb-1">Uncolored tags</span>
          {allTags.filter(t => !tagColors[t]).map(tag => (
            <div key={tag} className="flex items-center gap-1 mb-1 flex-wrap">
              <span className="text-[10px] font-medium text-[var(--color-ink-muted)] truncate max-w-[80px]">{tag}</span>
              <div className="flex gap-0.5 flex-wrap">
                {FOLDER_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => onSetTagColor(tag, c)}
                    className="w-2.5 h-2.5 rounded-sm transition-transform hover:scale-125"
                    style={{ backgroundColor: c }}
                    title={`Set ${tag} to ${c}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StorageQuotaWarning({ usedBytes, quotaBytes, onDismiss }: { usedBytes: number; quotaBytes: number; onDismiss: () => void }) {
  const pct = Math.round((usedBytes / quotaBytes) * 100);
  return (
    <div className="mx-6 mt-3 px-4 py-2.5 border border-[var(--color-destructive)] rounded-lg bg-[var(--color-destructive)]/5 flex items-center justify-between gap-3">
      <span className="text-[12px] font-medium text-[var(--color-destructive)]">
        Storage warning: {pct}% used — archive or delete documents to free space
      </span>
      <button onClick={onDismiss} className="text-[16px] text-[var(--color-destructive)] hover:opacity-70 shrink-0 leading-none">&times;</button>
    </div>
  );
}

function Pagination({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
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

function EmptyLibrary({ icon, title, description, action }: {
  icon: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 p-12 text-center">
      <span className="text-[40px] mb-4 leading-none">{icon}</span>
      <h3 className="text-[17px] font-semibold text-[var(--color-ink)] mb-2">{title}</h3>
      <p className="text-[13px] text-[var(--color-ink-muted)] max-w-[320px] leading-relaxed mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="notion-btn-primary text-[13px] px-5 py-2"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function DocumentGrid({ metas, folders, viewMode, loading, error, onStar, onArchive, onDelete, onTagClick, onMoveToFolder, activeTag, onDragStart, tagColors, activeFolderId, hasApiKey, onAddDocument }: {
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
      <div className={cn("grid gap-3 p-6", viewMode === 'compact' ? 'grid-cols-1' : viewMode === 'detailed' ? 'grid-cols-2' : 'grid-cols-3')}>
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={viewMode === 'compact' ? "h-10 rounded-lg" : viewMode === 'detailed' ? "h-64 rounded-xl" : "h-52 rounded-xl"} />)}
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
          action={{ label: 'Add Document', onClick: onAddDocument }}
        />
      );
    }
    if (!hasApiKey) {
      return (
        <EmptyLibrary
          icon={'\u{1F511}'}
          title="No API key set"
          description="Configure an AI provider in Settings to start capturing and structuring documents."
          action={{ label: 'Open Settings', onClick: () => browser.runtime.openOptionsPage() }}
        />
      );
    }
    return (
      <EmptyLibrary
        icon={'\u{1F4CB}'}
        title="No knowledge objects yet"
        description="Open any web page, open the Notch extension, and click 'Capture this page' to save your first document."
        action={{ label: 'Learn More', onClick: () => browser.tabs.create({ url: 'https://notch.ai' }) }}
      />
    );
  }
  return (
    <div className={cn("grid gap-3 p-6", viewMode === 'compact' ? 'grid-cols-1' : viewMode === 'detailed' ? 'grid-cols-2' : 'grid-cols-3')}>
      {metas.map((meta) => (
        <DocumentCard
          key={meta.id}
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [quotaWarning, setQuotaWarning] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
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

  useEffect(() => {
    async function boot() {
      try {
        const [index, storedFolders, storedTagColors, storedViewMode, storedSettings] = await Promise.all([
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
        if (index.length === 0) { setLoading(false); return; }
        const firstBatch = await getDocumentMetas(index.slice(0, 20));
        setMetas(firstBatch);
        setLoading(false);
        if (index.length > 20) {
          const rest = await getDocumentMetas(index.slice(20));
          setMetas(prev => {
            const seen = new Set(prev.map(m => m.id));
            return [...prev, ...rest.filter(m => !seen.has(m.id))];
          });
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load documents');
        setLoading(false);
      }
    }
    boot();
  }, []);

  useEffect(() => {
    getAppearance().then(applyAppearance);
    return watchAppearance(applyAppearance);
  }, []);

  useEffect(() => {
    function onMsg(msg: unknown) {
      if (msg && typeof msg === 'object' && (msg as { type?: string }).type === 'STORAGE_QUOTA_WARNING') {
        const m = msg as { payload: { usedBytes: number; quotaBytes: number } };
        setQuotaWarning(m.payload);
      }
    }
    browser.runtime.onMessage.addListener(onMsg);
    return () => browser.runtime.onMessage.removeListener(onMsg);
  }, []);

  function handleStar(id: string, starred: boolean) {
    setMetas(prev => prev.map(m => m.id === id ? { ...m, isStarred: starred } : m));
    updateDocumentMeta(id, { isStarred: starred });
  }
  function handleArchive(id: string, archived: boolean) {
    setMetas(prev => prev.map(m => m.id === id ? { ...m, isArchived: archived } : m));
    updateDocumentMeta(id, { isArchived: archived });
  }
  function handleDelete(id: string) {
    setMetas(prev => prev.filter(m => m.id !== id));
    deleteDocument(id);
  }

  async function handleFolderCreate(name: string, color: string) {
    const folder: Folder = { id: crypto.randomUUID(), name, color, createdAt: new Date().toISOString() };
    await saveFolder(folder);
    setFolders(prev => [...prev, folder]);
  }
  async function handleFolderDelete(id: string) {
    await deleteFolder(id);
    setFolders(prev => prev.filter(f => f.id !== id));
    if (activeFolderId === id) setActiveFolderId(null);
    setMetas(prev => prev.map(m => m.folder === id ? { ...m, folder: undefined } : m));
  }
  function handleMoveToFolder(docId: string, folderId: string | undefined) {
    setMetas(prev => prev.map(m => m.id === docId ? { ...m, folder: folderId } : m));
    updateDocumentMeta(docId, { folder: folderId });
  }

  async function handleSetTagColor(tag: string, color: string | null) {
    await setTagColor(tag, color);
    setTagColors(prev => {
      const next = { ...prev };
      if (color === null) delete next[tag];
      else next[tag] = color;
      return next;
    });
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
    const folder = folders.find(f => f.id === folderId);
    const count = metas.filter(m => m.folder === folderId).length;
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
      console.error('Export failed:', err);
      addToast('Export failed. Please try again.', 'info');
    }
  }

  async function handleImportClick() { fileInputRef.current?.click(); }

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
        const response = await browser.runtime.sendMessage({
          type: 'IMPORT_PDF',
          payload: { fileName: file.name, bytes, tags: [] },
        }) as { type: string; payload: { documentId?: string; error?: string } };
        if (response.type === 'CAPTURE_ERROR') throw new Error(response.payload.error ?? 'Import failed');
        docId = response.payload.documentId!;
      }
      const index = await getDocIndex();
      const updatedMetas = await getDocumentMetas(index);
      setMetas(updatedMetas);
      setImportStatus('done');
      setTimeout(() => setImportStatus('idle'), 2500);
      browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${docId}`) });
    } catch (err) {
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
      console.error('PDF import failed:', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  }

  function handleFilterChange(f: Filter) { setActiveFilter(f); setActiveFolderId(null); setPage(1); }
  function handleSortChange(s: SortOrder) { setSortOrder(s); setPage(1); }
  function handleTagClick(tag: string) { setActiveTag(prev => prev === tag ? null : tag); setPage(1); }
  function handleSearchReset() { setPage(1); }

  function handleSearchResults(results: DocumentMeta[] | null, query: string) {
    setSearchResults(results);
    setSearchQuery(query);
  }

  const filtered = metas.filter(m => {
    if (activeFolderId) return m.folder === activeFolderId;
    if (activeFilter === 'favorites') return m.isStarred;
    if (activeFilter === 'archive')   return m.isArchived;
    return !m.isArchived;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
    if (sortOrder === 'oldest') return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
    return a.title.localeCompare(b.title);
  });

  const tagFiltered = activeTag ? sorted.filter(m => m.tags.includes(activeTag)) : sorted;
  const displayList = searchResults ?? tagFiltered;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
      if (displayList.length === 0) return;

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, displayList.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        const doc = displayList[selectedIndex];
        if (doc) browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${doc.id}`) });
      } else if (e.key === 's' && selectedIndex >= 0) {
        e.preventDefault();
        const doc = displayList[selectedIndex];
        if (doc) {
          updateDocumentMeta(doc.id, { isStarred: !doc.isStarred });
          setMetas(prev => prev.map(m => m.id === doc.id ? { ...m, isStarred: !m.isStarred } : m));
          addToast(doc.isStarred ? 'Removed from favorites' : 'Added to favorites', 'info');
        }
      } else if (e.key === 'a' && selectedIndex >= 0) {
        e.preventDefault();
        const doc = displayList[selectedIndex];
        if (doc) {
          updateDocumentMeta(doc.id, { isArchived: !doc.isArchived });
          setMetas(prev => prev.map(m => m.id === doc.id ? { ...m, isArchived: !m.isArchived } : m));
          addToast(doc.isArchived ? 'Unarchived' : 'Archived', 'info');
        }
      } else if (e.key === 'd' && selectedIndex >= 0) {
        e.preventDefault();
        const doc = displayList[selectedIndex];
        if (doc && confirm(`Delete "${doc.title}"?`)) {
          setMetas(prev => prev.filter(m => m.id !== doc.id));
          deleteDocument(doc.id);
          addToast('Document deleted', 'info');
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayList, selectedIndex, addToast]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    metas.forEach(m => m.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [metas]);

  const totalPages = Math.max(1, Math.ceil(displayList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = displayList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex h-screen bg-[var(--color-canvas-soft)] text-[var(--color-ink)]">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        className="hidden"
      />

      <div className="w-56 h-screen bg-white border-r border-[var(--color-hairline)] shrink-0 flex flex-col py-4">
        <div className="px-4 pb-4 flex items-center gap-2">
          <span className="text-[18px] font-bold tracking-tight text-[var(--color-ink)]">Notch</span>
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
              label="Archive"
              icon={'\u{1F4E6}'}
              active={activeFilter === 'archive'}
              onClick={() => handleFilterChange('archive')}
            />
            <NavItem
              label="Settings"
              icon={'\u2699'}
              active={false}
              onClick={() => browser.runtime.openOptionsPage()}
            />
          </div>

          <Separator className="bg-[var(--color-hairline)] my-3" />

          <div className="flex items-center justify-between px-4 mb-1">
            <span className="text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide">Collections</span>
            <button
              onClick={() => setShowFolderInput(v => !v)}
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
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const name = newFolderName.trim();
                    if (name) {
                      handleFolderCreate(name, newFolderColor);
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
                {FOLDER_COLORS.map(c => (
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
                    handleFolderCreate(name, newFolderColor);
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

          {folders.map(folder => (
            <div
              key={folder.id}
              className={cn(
                'group flex items-center rounded-md mx-2'
              )}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={e => {
                e.preventDefault();
                const docId = e.dataTransfer.getData('text/plain');
                if (docId) handleDropDocumentOnFolder(docId, folder.id);
              }}
            >
              <button
                onClick={() => { setActiveFolderId(folder.id); setActiveFilter('all'); }}
                className={cn(
                  'flex items-center gap-2 flex-1 text-left px-2 py-1 text-[13px] font-medium rounded-md transition-all',
                  activeFolderId === folder.id
                    ? 'bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                    : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]'
                )}
              >
                <span className="inline-block w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: folder.color }} />
                <span className="truncate">{folder.name}</span>
              </button>
              <button
                onClick={() => handleExportFolder(folder.id)}
                className="text-[var(--color-ink-faint)] hover:text-[var(--color-primary)] text-[11px] opacity-0 group-hover:opacity-100 transition-opacity px-1"
                title="Export collection"
              >
                ↓
              </button>
              <button
                onClick={() => handleFolderDelete(folder.id)}
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
            onClick={handleImportClick}
            disabled={importStatus === 'importing'}
            className={cn(
              'w-full text-[12px] font-medium py-2 rounded-full border border-dashed transition-all',
              importStatus === 'importing' ? 'border-[var(--color-primary)] text-[var(--color-primary)] opacity-60 cursor-not-allowed'
                : importStatus === 'done' ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : importStatus === 'error' ? 'border-[var(--color-destructive)] text-[var(--color-destructive)]'
                : 'border-[var(--color-hairline)] text-[var(--color-ink-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
            )}
          >
            {importStatus === 'importing' ? 'Importing...'
              : importStatus === 'done' ? 'Imported'
              : importStatus === 'error' ? 'Failed — retry'
              : 'Import PDF'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--color-hairline)] bg-white">
          <div className="flex items-center gap-4">
            <h1 className="text-[22px] font-bold tracking-tight text-[var(--color-ink)]">Knowledge Base</h1>
            <span className="text-[13px] text-[var(--color-ink-muted)]">
              {searchResults !== null
                ? `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`
                : `${displayList.length} knowledge object${displayList.length !== 1 ? 's' : ''}`
              }
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
                onChange={e => { setActiveFolderId(e.target.value || null); setPage(1); }}
                className="text-[12px] font-medium bg-white border border-[var(--color-hairline)] text-[var(--color-ink-muted)] rounded-md px-2 py-1.5 focus:border-[var(--color-primary)] focus:outline-none cursor-pointer"
              >
                <option value="">All collections</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-0.5 border border-[var(--color-hairline)] rounded-md overflow-hidden">
              {([{ label: 'Newest', value: 'newest' }, { label: 'Oldest', value: 'oldest' }, { label: 'A–Z', value: 'title-az' }] as const).map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => handleSortChange(value)}
                  className={cn(
                    'px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                    sortOrder === value
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] bg-white'
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
                  onClick={() => { setViewMode(v); saveViewMode(v); }}
                  className={cn(
                    'px-2 py-1.5 text-[11px] font-medium transition-colors',
                    viewMode === v
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] bg-white'
                  )}
                >
                  {v === 'compact' ? 'Compact' : v === 'comfortable' ? 'Comfort' : 'Detailed'}
                </button>
              ))}
            </div>
            <button
              onClick={() => browser.runtime.openOptionsPage()}
              title="Settings"
              className="text-[13px] font-medium text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors px-2 py-1"
            >
              Settings
            </button>
          </div>
        </div>

        {!searchResults && metas.length > 0 && (
          <>
            <KnowledgeOverview metas={metas} />
            <TrendingKnowledge metas={metas} />
          </>
        )}

        {activeTag && (
          <div className="flex items-center gap-2 px-6 pt-3">
            <span className="text-[11px] text-[var(--color-ink-muted)]">Filtering by:</span>
            <Badge variant="outline" className="text-[11px] font-medium rounded-full border-[var(--color-primary)] text-[var(--color-primary)] gap-1.5">
              {activeTag}
              <button onClick={() => { setActiveTag(null); setPage(1); }} className="hover:text-[var(--color-primary-active)] leading-none">&times;</button>
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
          />
        </ScrollArea>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPrev={() => setPage(p => Math.max(1, p - 1))}
          onNext={() => setPage(p => Math.min(totalPages, p + 1))}
        />
      </div>
    </div>
  );
}
