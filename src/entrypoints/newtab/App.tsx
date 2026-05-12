import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import type { DocumentMeta, Folder, TagColorMap, ViewMode } from '@/lib/types';
import { getDocIndex, getDocumentMetas, deleteDocument, updateDocumentMeta, getFolders, saveFolder, deleteFolder, getTagColors, setTagColor, getViewMode, saveViewMode, getSettings, getAppearance } from '@/lib/storage';
import { FOLDER_COLORS } from '@/lib/color-palette';
import { importNotchPDF } from '@/lib/import';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/EmptyState';
import { useToast } from '@/components/ui/toast';

// exportFolderAsZip will be implemented in task 20; loaded lazily so missing module doesn't break build
type ExportFolderFn = (folderId: string, format: 'markdown' | 'pdf') => Promise<Blob>;
let _exportFolderAsZip: ExportFolderFn | undefined;
void (import('@/lib/zip-export') as Promise<{ exportFolderAsZip: ExportFolderFn }>)
  .then(m => { _exportFolderAsZip = m.exportFolderAsZip; })
  .catch(() => { /* zip-export not yet implemented — will be wired in task 20 */ });

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 12;

// ── Fuse config — meta fields only, no full content ──────────────────────────
const fuseOptions = {
  keys: [
    { name: 'title',   weight: 0.5 },
    { name: 'tags',    weight: 0.25 },
    { name: 'domain',  weight: 0.15 },
    { name: 'summary', weight: 0.1 },
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
  ignoreLocation: true,
};

// ── Types ─────────────────────────────────────────────────────────────────────
type Filter = 'all' | 'favorites' | 'archive';
type SortOrder = 'newest' | 'oldest' | 'title-az';
type ImportStatus = 'idle' | 'importing' | 'done' | 'error';


// ── Search input ──────────────────────────────────────────────────────────────
function SearchInput({
  metas,
  onSearchResults,
  onQueryChange,
}: {
  metas: DocumentMeta[];
  onSearchResults: (r: DocumentMeta[] | null) => void;
  onQueryChange: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fuse = useMemo(() => new Fuse(metas, fuseOptions), [metas]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    onQueryChange(); // reset page
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchResults(q.trim().length < 2 ? null : fuse.search(q).map(r => r.item));
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
      placeholder="SEARCH... (/)"
      onChange={handleChange}
      className="font-mono text-[11px] bg-surface border-border text-white placeholder:text-muted w-60 h-7"
    />
  );
}

// ── Library header ────────────────────────────────────────────────────────────
function LibraryHeader({
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  searchSlot,
  folders,
  activeFolderId,
  onFolderSelect,
}: {
  sortOrder: SortOrder;
  onSortChange: (s: SortOrder) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  searchSlot?: React.ReactNode;
  folders: Folder[];
  activeFolderId: string | null;
  onFolderSelect: (id: string | null) => void;
}) {
  const sorts: { label: string; value: SortOrder }[] = [
    { label: 'NEWEST', value: 'newest' },
    { label: 'OLDEST', value: 'oldest' },
    { label: 'A–Z',    value: 'title-az' },
  ];
  const views: { label: string; value: ViewMode; icon: string }[] = [
    { label: 'COMPACT',     value: 'compact',     icon: '⣿' },
    { label: 'COMFORTABLE', value: 'comfortable', icon: '▤' },
    { label: 'DETAILED',    value: 'detailed',    icon: '▬' },
  ];
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-border">
      <span className="font-mono font-bold text-2xl text-white">LIBRARY</span>
      <div className="flex items-center gap-3">
        {searchSlot}
        {/* Folder filter */}
        {folders.length > 0 && (
          <select
            value={activeFolderId ?? ''}
            onChange={e => onFolderSelect(e.target.value || null)}
            className="font-mono text-[10px] uppercase tracking-wider bg-surface border border-border text-muted hover:text-white px-2 py-1 h-7 focus:outline-none focus:border-primary cursor-pointer"
          >
            <option value="">ALL FOLDERS</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name.toUpperCase()}</option>
            ))}
          </select>
        )}
        {/* Sort */}
        <div className="flex gap-1">
          {sorts.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => onSortChange(value)}
              className={cn(
                'font-mono font-semibold text-[10px] uppercase tracking-wider px-2 py-1 transition-colors',
                sortOrder === value ? 'text-primary' : 'text-muted hover:text-white'
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {/* View mode */}
        <div className="flex gap-0.5 border border-border">
          {views.map(({ value, icon, label }) => (
            <button
              key={value}
              onClick={() => onViewModeChange(value)}
              title={label}
              className={cn(
                'px-2 py-1 font-mono text-[13px] transition-colors',
                viewMode === value ? 'bg-surface text-primary' : 'text-muted hover:text-white'
              )}
            >
              {icon}
            </button>
          ))}
        </div>
        {/* Settings */}
        <button
          onClick={() => browser.runtime.openOptionsPage()}
          title="Settings"
          className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-border text-muted hover:text-white hover:border-primary transition-colors"
        >
          [⚙]
        </button>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({
  activeFilter,
  onFilterChange,
  onImport,
  importStatus,
  folders,
  activeFolderId,
  onFolderSelect,
  onFolderCreate,
  onFolderDelete,
  onDropDocumentOnFolder,
  onExportFolder,
  tagColors,
  onSetTagColor,
  allTags,
}: {
  activeFilter: Filter;
  onFilterChange: (f: Filter) => void;
  onImport: () => void;
  importStatus: ImportStatus;
  folders: Folder[];
  activeFolderId: string | null;
  onFolderSelect: (id: string | null) => void;
  onFolderCreate: (name: string, color: string) => void;
  onFolderDelete: (id: string) => void;
  onDropDocumentOnFolder: (docId: string, folderId: string) => void;
  onExportFolder: (folderId: string) => void;
  tagColors: TagColorMap;
  onSetTagColor: (tag: string, color: string | null) => void;
  allTags: string[];
}) {
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const topItems: { label: string; value: Filter | 'settings' }[] = [
    { label: 'ALL DOCUMENTS', value: 'all' },
    { label: 'FAVORITES',     value: 'favorites' },
    { label: 'ARCHIVE',       value: 'archive' },
    { label: 'SETTINGS',      value: 'settings' },
  ];

  function submitFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    onFolderCreate(name, newFolderColor);
    setNewFolderName('');
    setNewFolderColor(FOLDER_COLORS[0]);
    setShowFolderInput(false);
  }

  const importLabel = importStatus === 'importing' ? '[ IMPORTING... ]'
    : importStatus === 'done' ? '[ IMPORTED ✓ ]'
    : importStatus === 'error' ? '[ FAILED — RETRY ]'
    : '+ IMPORT PDF';

  return (
    <div className="w-52 h-screen bg-background border-r border-border shrink-0 flex flex-col py-6">
      <div className="font-mono font-semibold text-sm uppercase tracking-widest px-4 pb-6 text-white">
        NOTCH
      </div>

      <div className="flex-1 overflow-y-auto">
        {topItems.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => value === 'settings' ? window.location.href = '/settings.html': onFilterChange(value as Filter)}
            className={cn(
              'font-mono font-semibold text-[11px] uppercase tracking-wider px-4 py-2 text-left w-full transition-colors border-l-2',
              activeFilter === value && activeFolderId === null
                ? 'text-white border-primary'
                : 'text-muted border-transparent hover:text-white'
            )}
          >
            {label}
          </button>
        ))}

        {/* Folders section */}
        <Separator className="bg-border my-3" />
        <div className="flex items-center justify-between px-4 mb-1">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted">FOLDERS</span>
          <button
            onClick={() => setShowFolderInput(v => !v)}
            className="font-mono text-[10px] text-muted hover:text-primary transition-colors leading-none"
            title="New folder"
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
              onKeyDown={e => { if (e.key === 'Enter') submitFolder(); if (e.key === 'Escape') setShowFolderInput(false); }}
              placeholder="Folder name"
              className="w-full bg-surface border border-border text-white font-mono text-[10px] px-2 py-1 focus:border-primary outline-none"
            />
            {/* Color picker */}
            <div className="flex gap-1 flex-wrap">
              {FOLDER_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewFolderColor(c)}
                  className="w-4 h-4 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    outline: newFolderColor === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px',
                  }}
                  title={c}
                />
              ))}
            </div>
            <button onClick={submitFolder} className="font-mono text-[9px] uppercase tracking-wider text-primary text-left">
              ✓ CREATE
            </button>
          </div>
        )}

        {folders.map(folder => (
          <div
            key={folder.id}
            className={cn(
              'group flex items-center transition-colors',
              dragOverFolderId === folder.id && 'bg-surface-hover'
            )}
            onDragOver={e => { e.preventDefault(); setDragOverFolderId(folder.id); }}
            onDragLeave={() => setDragOverFolderId(null)}
            onDrop={e => {
              e.preventDefault();
              setDragOverFolderId(null);
              const docId = e.dataTransfer.getData('text/plain');
              if (docId) onDropDocumentOnFolder(docId, folder.id);
            }}
          >
            <button
              onClick={() => { onFolderSelect(folder.id); onFilterChange('all'); }}
              className={cn(
                'font-mono text-[11px] uppercase tracking-wider px-4 py-1.5 text-left flex-1 transition-colors border-l-2 truncate flex items-center gap-2',
                activeFolderId === folder.id
                  ? 'text-white'
                  : 'text-muted border-transparent hover:text-white'
              )}
              style={{
                borderLeftColor: activeFolderId === folder.id ? folder.color : 'transparent',
              }}
            >
              <span
                className="inline-block w-2 h-2 shrink-0"
                style={{ backgroundColor: folder.color }}
              />
              <span className="truncate">{folder.name}</span>
            </button>
            <button
              onClick={() => onExportFolder(folder.id)}
              className="text-muted hover:text-primary text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              title="Export folder as zip"
            >
              ↓
            </button>
            <button
              onClick={() => onFolderDelete(folder.id)}
              className="pr-3 text-muted hover:text-danger text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete folder"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="px-4 mt-4">
        <button
          onClick={onImport}
          disabled={importStatus === 'importing'}
          className={cn(
            'w-full font-mono font-semibold text-[10px] uppercase tracking-wider py-2 border border-dashed transition-all',
            importStatus === 'importing' ? 'border-primary text-primary opacity-60 cursor-not-allowed'
              : importStatus === 'done' ? 'border-primary text-primary'
              : importStatus === 'error' ? 'border-danger text-danger'
              : 'border-border text-muted hover:text-primary hover:border-primary'
          )}
        >
          {importLabel}
        </button>
      </div>

      <ColorLegend
        folders={folders}
        tagColors={tagColors}
        onSetTagColor={onSetTagColor}
        allTags={allTags}
      />
    </div>

  );
}

// ── Document card (uses DocumentMeta) ─────────────────────────────────────────
// ── Document card (uses DocumentMeta) ─────────────────────────────────────────
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

  function stop<T>(fn: () => T) {
    return (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  }

  const currentFolder = folders.find(f => f.id === meta.folder);

  const folderMenu = (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setShowFolderMenu(v => !v)}
        title="Move to folder"
        className="font-mono text-[14px] text-muted hover:text-primary transition-colors leading-none"
      >
        📁
      </button>
      {showFolderMenu && (
        <div className="absolute right-0 bottom-full mb-1 z-50 bg-surface border border-border min-w-[140px] shadow-lg max-h-48 overflow-y-auto">
          <button
            onClick={() => { onMoveToFolder(meta.id, undefined); setShowFolderMenu(false); }}
            className="w-full text-left font-mono text-[10px] uppercase tracking-wider px-3 py-2 text-muted hover:text-white hover:bg-surface-hover transition-colors"
          >
            — No folder
          </button>
          {folders.map(f => (
            <button
              key={f.id}
              onClick={() => { onMoveToFolder(meta.id, f.id); setShowFolderMenu(false); }}
              className={cn(
                'w-full flex items-center gap-2 text-left font-mono text-[10px] uppercase tracking-wider px-3 py-2 transition-colors hover:bg-surface-hover',
                meta.folder === f.id ? 'text-primary' : 'text-muted hover:text-white'
              )}
            >
              <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: f.color }} />
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
          'group card px-4 py-2 cursor-pointer flex items-center hover:bg-surface-hover transition-colors relative h-12',
          isDragging && 'opacity-50'
        )}
      >
        <div className="flex-1 flex items-center gap-4 min-w-0 pr-24">
          <button
            onClick={stop(() => onStar(meta.id, !meta.isStarred))}
            title={meta.isStarred ? 'Unstar' : 'Star'}
            className={cn('font-mono text-[16px] transition-colors shrink-0 leading-none', meta.isStarred ? 'text-primary' : 'text-muted hover:text-white')}
          >
            {meta.isStarred ? '★' : '☆'}
          </button>
          <p className="font-mono font-bold text-[13px] text-white truncate max-w-[40%] shrink-0">{meta.title}</p>
          <span className="font-mono text-[10px] text-muted uppercase shrink-0 truncate max-w-[15%]">{meta.domain}</span>
          
          {currentFolder && (
            <div className="flex items-center gap-1.5 shrink-0 max-w-[15%]">
              <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: currentFolder.color }} />
              <span className="font-mono text-[9px] uppercase truncate" style={{ color: currentFolder.color }}>{currentFolder.name}</span>
            </div>
          )}

          <div className="flex gap-1.5 overflow-hidden opacity-60">
            {meta.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="font-mono text-[9px] uppercase px-1 border truncate leading-tight py-0.5"
                style={tagColors[tag]
                  ? { borderColor: tagColors[tag], color: tagColors[tag] }
                  : { borderColor: 'var(--color-border)', color: 'var(--color-muted)' }
                }
              >{tag}</span>
            ))}
          </div>
        </div>

        <div className="absolute right-4 top-0 bottom-0 flex items-center gap-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-linear-to-l from-surface-hover via-surface-hover to-transparent pl-8">
          <button onClick={stop(() => onArchive(meta.id, !meta.isArchived))} title={meta.isArchived ? 'Unarchive' : 'Archive'} className={cn('font-mono text-[16px] transition-colors hover:text-white leading-none', meta.isArchived ? 'text-primary' : 'text-muted')}>⊡</button>
          {folderMenu}
          <button onClick={stop(() => onDelete(meta.id))} title="Delete" className="font-mono font-semibold text-[16px] text-danger hover:text-danger/80 transition-colors leading-none">×</button>
        </div>
      </div>
    );
  }

  // Comfortable (default) & Detailed
  return (
    <div
      draggable
      onDragStart={e => { setIsDragging(true); onDragStart?.(e, meta.id); }}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${meta.id}`) })}
      className={cn(
        'card cursor-pointer flex flex-col gap-2 hover:bg-surface-hover transition-colors relative',
        viewMode === 'detailed' ? 'p-4' : 'p-3',
        isDragging && 'opacity-50'
      )}
    >
      <div className="flex gap-3 justify-between items-start">
        <p className={cn("font-mono font-bold text-white leading-tight", viewMode === 'detailed' ? 'text-base' : 'text-sm')}>{meta.title}</p>
        <button
          onClick={stop(() => onStar(meta.id, !meta.isStarred))}
          title={meta.isStarred ? 'Unstar' : 'Star'}
          className={cn('font-mono transition-colors shrink-0 leading-none', viewMode === 'detailed' ? 'text-[20px]' : 'text-[18px]', meta.isStarred ? 'text-primary' : 'text-muted hover:text-white')}
        >
          {meta.isStarred ? '★' : '☆'}
        </button>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <span className="font-mono text-[10px] text-muted uppercase">{meta.domain}</span>
        <span className="font-mono text-[10px] text-muted">{meta.wordCount}w</span>
        <span className="font-mono text-[10px] text-muted">{meta.capturedAt.slice(0, 10)}</span>
        {currentFolder && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-block w-2 h-2 shrink-0" style={{ backgroundColor: currentFolder.color }} />
            <span className="font-mono text-[9px] uppercase truncate" style={{ color: currentFolder.color }}>{currentFolder.name}</span>
          </div>
        )}
      </div>

      {viewMode === 'detailed' && meta.summary && (
        <p className="font-mono text-[11px] text-muted leading-relaxed line-clamp-3 my-1 border-l-2 border-border pl-3">
          {meta.summary}
        </p>
      )}

      {meta.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {meta.tags.map((tag) => {
            const tagColor = tagColors[tag];
            return (
              <Badge
                key={tag}
                variant="outline"
                onClick={stop(() => onTagClick(tag))}
                className={cn(
                  'font-mono text-[9px] uppercase px-1.5 py-0.5 cursor-pointer transition-colors',
                  activeTag === tag
                    ? 'border-primary text-primary'
                    : 'border-border text-muted hover:border-white hover:text-white'
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
      )}

      <div className="flex gap-3 mt-1 items-center">
        <button
          onClick={stop(() => onArchive(meta.id, !meta.isArchived))}
          title={meta.isArchived ? 'Unarchive' : 'Archive'}
          className={cn('font-mono text-[18px] transition-colors leading-none', meta.isArchived ? 'text-primary' : 'text-muted hover:text-white')}
        >
          ⊡
        </button>
        {folderMenu}
        <button
          onClick={stop(() => onDelete(meta.id))}
          title="Delete"
          className="font-mono font-semibold text-[18px] text-danger hover:text-danger/80 ml-auto transition-colors leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Color legend ──────────────────────────────────────────────────────────────
interface ColorLegendProps {
  folders: Folder[];
  tagColors: TagColorMap;
  onSetTagColor: (tag: string, color: string | null) => void;
  allTags: string[];
}

function ColorLegend({ folders, tagColors, onSetTagColor, allTags }: ColorLegendProps) {
  const coloredFolders = folders.filter(f => f.color);
  const coloredTags = Object.entries(tagColors);

  if (coloredFolders.length === 0 && coloredTags.length === 0 && allTags.length === 0) return null;

  return (
    <div className="px-4 mt-4 border-t border-border pt-3">
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted block mb-2">COLOR LEGEND</span>

      {coloredFolders.map(f => (
        <div key={f.id} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2.5 h-2.5 shrink-0" style={{ backgroundColor: f.color }} />
          <span className="font-mono text-[9px] uppercase truncate" style={{ color: f.color }}>{f.name}</span>
        </div>
      ))}

      {coloredTags.map(([tag, color]) => (
        <div key={tag} className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2.5 h-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
          <span className="font-mono text-[9px] uppercase truncate" style={{ color }}>{tag}</span>
          <button
            onClick={() => onSetTagColor(tag, null)}
            className="font-mono text-[9px] text-muted hover:text-danger transition-colors ml-auto shrink-0"
            title="Remove color"
          >
            ×
          </button>
        </div>
      ))}

      {allTags.filter(t => !tagColors[t]).length > 0 && (
        <>
          <span className="font-mono text-[8px] uppercase tracking-widest text-muted block mt-2 mb-1">UNCOLORED TAGS</span>
          {allTags.filter(t => !tagColors[t]).map(tag => (
            <div key={tag} className="flex items-center gap-1 mb-1 flex-wrap">
              <span className="font-mono text-[9px] uppercase text-muted truncate max-w-[80px]">{tag}</span>
              <div className="flex gap-0.5 flex-wrap">
                {FOLDER_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => onSetTagColor(tag, c)}
                    className="w-3 h-3 transition-transform hover:scale-125"
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

// ── Storage quota warning ─────────────────────────────────────────────────────
function StorageQuotaWarning({ usedBytes, quotaBytes, onDismiss }: { usedBytes: number; quotaBytes: number; onDismiss: () => void }) {
  const pct = Math.round((usedBytes / quotaBytes) * 100);
  return (
    <div className="mx-6 mt-3 px-3 py-2 border border-danger bg-surface flex items-center justify-between gap-3">
      <span className="font-mono font-semibold text-[11px] uppercase tracking-wider text-danger">
        STORAGE WARNING: {pct}% USED — ARCHIVE OR DELETE DOCUMENTS TO FREE SPACE
      </span>
      <button onClick={onDismiss} className="font-mono font-semibold text-sm text-danger hover:text-danger/80 shrink-0">×</button>
    </div>
  );
}

// ── Pagination controls ───────────────────────────────────────────────────────
function Pagination({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-4 border-t border-border">
      <button
        onClick={onPrev}
        disabled={page === 1}
        className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        ← PREV
      </button>
      <span className="font-mono text-[11px] text-muted uppercase tracking-wider">
        {page} / {totalPages}
      </span>
      <button
        onClick={onNext}
        disabled={page === totalPages}
        className="font-mono text-[11px] uppercase tracking-wider text-muted hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        NEXT →
      </button>
    </div>
  );
}

// ── Document grid ─────────────────────────────────────────────────────────────
function DocumentGrid({ metas, folders, viewMode, loading, onStar, onArchive, onDelete, onTagClick, onMoveToFolder, activeTag, onDragStart, tagColors, activeFolderId, hasApiKey, onAddDocument }: {
  metas: DocumentMeta[];
  folders: Folder[];
  viewMode: ViewMode;
  loading: boolean;
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
  if (loading) {
    return (
      <div className={cn("grid gap-3 p-6", viewMode === 'compact' ? 'grid-cols-1' : viewMode === 'detailed' ? 'grid-cols-3' : 'grid-cols-4')}>
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className={viewMode === 'compact' ? "h-12" : viewMode === 'detailed' ? "h-56" : "h-40"} />)}
      </div>
    );
  }
  if (metas.length === 0) {
    // Req 6.4 — empty folder filter
    if (activeFolderId) {
      return (
        <div className="flex items-center justify-center flex-1 p-6">
          <EmptyState
            message="This folder is empty"
            action={{ label: '+ Add Document', onClick: onAddDocument }}
          />
        </div>
      );
    }
    // Req 6.1 — no docs and no API key
    if (!hasApiKey) {
      return (
        <div className="flex items-center justify-center flex-1 p-6">
          <EmptyState
            message="No API key set"
            action={{ label: 'Open Settings', onClick: () => browser.runtime.openOptionsPage() }}
          />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center flex-1 p-6">
        <span className="font-mono font-semibold text-xs uppercase tracking-wider text-muted">
          NO DOCUMENTS FOUND. CAPTURE SOMETHING.
        </span>
      </div>
    );
  }
  return (
    <div className={cn("grid gap-3 p-6", viewMode === 'compact' ? 'grid-cols-1' : viewMode === 'detailed' ? 'grid-cols-3' : 'grid-cols-4')}>
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

// ── Root ──────────────────────────────────────────────────────────────────────
export default function LibraryApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('comfortable');
  const [metas, setMetas] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<DocumentMeta[] | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [quotaWarning, setQuotaWarning] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [tagColors, setTagColors] = useState<TagColorMap>({});
  const [hasApiKey, setHasApiKey] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const { addToast } = useToast();

  // ── Boot
  useEffect(() => {
    async function boot() {
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
    }
    boot();
  }, []);

  // Apply global appearance
  useEffect(() => {
    getAppearance().then((a) => {
      const resolved = a.theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : a.theme;
      document.documentElement.dataset.theme = resolved;
      document.body.dataset.theme = resolved;
      document.documentElement.style.setProperty('--color-primary', a.accentColor);
    });
  }, []);

  // ── Quota warning listener
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

  // ── Keyboard navigation (j/k/arrows to navigate, Enter to open, s to star, a to archive, d to delete)
  // Note: This is placed after displayList is computed below

  // ── Mutations
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

  // ── Folder mutations
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

  // ── Tag color mutations
  async function handleSetTagColor(tag: string, color: string | null) {
    await setTagColor(tag, color);
    setTagColors(prev => {
      const next = { ...prev };
      if (color === null) delete next[tag];
      else next[tag] = color;
      return next;
    });
  }

  // ── Drag-and-drop: set docId on dataTransfer so folder drop targets can read it
  function handleDragStart(e: React.DragEvent, docId: string) {
    e.dataTransfer.setData('text/plain', docId);
    e.dataTransfer.effectAllowed = 'move';
  }

  // ── Drop document onto folder (called from Sidebar)
  function handleDropDocumentOnFolder(docId: string, folderId: string) {
    handleMoveToFolder(docId, folderId);
  }

  // ── Export folder as zip
  async function handleExportFolder(folderId: string) {
    if (!_exportFolderAsZip) {
      alert('Export is not yet available (will be implemented in task 20).');
      return;
    }
    try {
      const blob = await _exportFolderAsZip(folderId, 'markdown');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const folder = folders.find(f => f.id === folderId);
      a.download = `${folder?.name ?? 'folder'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Export failed. Please try again.');
    }
  }

  // ── PDF import — try Notch bundle first, fall back to general PDF parse
  async function handleImportClick() { fileInputRef.current?.click(); }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus('importing');
    try {
      let docId: string;
      try {
        // Try Notch-exported PDF (has embedded notch_data.json)
        docId = await importNotchPDF(file);
      } catch {
        // Fallback: send raw bytes to the background IMPORT_PDF pipeline
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
      // Open the newly imported doc
      browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${docId}`) });
    } catch (err) {
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
      console.error('PDF import failed:', err);
    } finally {
      if (e.target) e.target.value = '';
    }
  }

  // ── Reset page on filter/sort/search/tag change
  function handleFilterChange(f: Filter) { setActiveFilter(f); setActiveFolderId(null); setPage(1); }
  function handleSortChange(s: SortOrder) { setSortOrder(s); setPage(1); }
  function handleTagClick(tag: string) { setActiveTag(prev => prev === tag ? null : tag); setPage(1); }
  function handleSearchReset() { setPage(1); }

  // ── Derived display list
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

  // ── Keyboard navigation (j/k/arrows to navigate, Enter to open, s to star, a to archive, d to delete)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input
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

  // ── All unique tags across all metas (for color legend)
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    metas.forEach(m => m.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [metas]);

  // ── Pagination
  const totalPages = Math.max(1, Math.ceil(displayList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = displayList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex h-screen bg-background text-white">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="application/pdf"
        className="hidden"
      />
      <Sidebar
        activeFilter={activeFilter}
        onFilterChange={handleFilterChange}
        onImport={handleImportClick}
        importStatus={importStatus}
        folders={folders}
        activeFolderId={activeFolderId}
        onFolderSelect={id => { setActiveFolderId(id); setPage(1); }}
        onFolderCreate={handleFolderCreate}
        onFolderDelete={handleFolderDelete}
        onDropDocumentOnFolder={handleDropDocumentOnFolder}
        onExportFolder={handleExportFolder}
        tagColors={tagColors}
        onSetTagColor={handleSetTagColor}
        allTags={allTags}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <LibraryHeader
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          viewMode={viewMode}
          onViewModeChange={(v) => { setViewMode(v); saveViewMode(v); }}
          folders={folders}
          activeFolderId={activeFolderId}
          onFolderSelect={id => { setActiveFolderId(id); setPage(1); }}
          searchSlot={
            <SearchInput
              metas={filtered}
              onSearchResults={setSearchResults}
              onQueryChange={handleSearchReset}
            />
          }
        />

        {activeTag && (
          <div className="flex items-center gap-2 px-6 pt-3">
            <span className="font-mono text-[10px] text-muted uppercase">FILTERING BY:</span>
            <Badge variant="outline" className="font-mono text-[10px] uppercase border-primary text-primary gap-1.5">
              {activeTag}
              <button onClick={() => { setActiveTag(null); setPage(1); }} className="hover:text-white leading-none">×</button>
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
