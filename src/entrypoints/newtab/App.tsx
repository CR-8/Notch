import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import type { DocumentMeta } from '@/lib/types';
import { getDocIndex, getDocumentMetas, saveDocument, deleteDocument, updateDocumentMeta, getDocument, deriveDocumentMeta } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// ── Constants ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 10;

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
  searchSlot,
}: {
  sortOrder: SortOrder;
  onSortChange: (s: SortOrder) => void;
  searchSlot?: React.ReactNode;
}) {
  const sorts: { label: string; value: SortOrder }[] = [
    { label: 'NEWEST', value: 'newest' },
    { label: 'OLDEST', value: 'oldest' },
    { label: 'A–Z',    value: 'title-az' },
  ];
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border">
      <span className="font-heading font-bold text-2xl text-white">LIBRARY</span>
      <div className="flex items-center gap-3">
        {searchSlot}
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
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ activeFilter, onFilterChange }: { activeFilter: Filter; onFilterChange: (f: Filter) => void }) {
  const items: { label: string; value: Filter | 'settings' }[] = [
    { label: 'ALL DOCUMENTS', value: 'all' },
    { label: 'FAVORITES',     value: 'favorites' },
    { label: 'ARCHIVE',       value: 'archive' },
    { label: 'SETTINGS',      value: 'settings' },
  ];
  return (
    <div className="w-48 h-screen bg-background border-r border-border shrink-0 flex flex-col py-6">
      <div className="font-mono font-semibold text-sm uppercase tracking-widest px-4 pb-6 text-white">
        NOTCH
      </div>
      {items.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => value === 'settings' ? browser.runtime.openOptionsPage() : onFilterChange(value as Filter)}
          className={cn(
            'font-mono font-semibold text-[11px] uppercase tracking-wider px-4 py-2 text-left transition-colors border-l-2',
            activeFilter === value
              ? 'text-white border-primary'
              : 'text-muted border-transparent hover:text-white'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Document card (uses DocumentMeta) ─────────────────────────────────────────
interface DocumentCardProps {
  meta: DocumentMeta;
  onStar: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
}

function DocumentCard({ meta, onStar, onArchive, onDelete, onTagClick, activeTag }: DocumentCardProps) {
  function stop<T>(fn: () => T) {
    return (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  }

  return (
    <div
      onClick={() => browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${meta.id}`) })}
      className="card p-3 cursor-pointer flex flex-col gap-1.5 hover:bg-surface-hover transition-colors"
    >
      <p className="font-heading font-bold text-sm text-white truncate">{meta.title}</p>

      <div className="flex gap-3 items-center">
        <span className="font-mono text-[10px] text-muted uppercase">{meta.domain}</span>
        <span className="font-mono text-[10px] text-muted">{meta.wordCount}w</span>
        <span className="font-mono text-[10px] text-muted">{meta.capturedAt.slice(0, 10)}</span>
      </div>

      {meta.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {meta.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              onClick={stop(() => onTagClick(tag))}
              className={cn(
                'font-mono text-[9px] uppercase px-1 py-0 cursor-pointer transition-colors',
                activeTag === tag
                  ? 'border-primary text-primary'
                  : 'border-border text-muted hover:border-white hover:text-white'
              )}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-0.5 items-center">
        <button
          onClick={stop(() => onStar(meta.id, !meta.isStarred))}
          title={meta.isStarred ? 'Unstar' : 'Star'}
          className={cn('font-mono text-[24px] transition-colors', meta.isStarred ? 'text-primary' : 'text-muted hover:text-white')}
        >
          {meta.isStarred ? '★' : '☆'}
        </button>
        <button
          onClick={stop(() => onArchive(meta.id, !meta.isArchived))}
          title={meta.isArchived ? 'Unarchive' : 'Archive'}
          className={cn('font-mono text-[24px] transition-colors', meta.isArchived ? 'text-primary' : 'text-muted hover:text-white')}
        >
          ⊡
        </button>
        <button
          onClick={stop(() => onDelete(meta.id))}
          title="Delete"
          className="font-mono font-semibold text-[24px] text-danger hover:text-danger/80 ml-auto transition-colors"
        >
          ×
        </button>
      </div>
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
function DocumentGrid({ metas, loading, onStar, onArchive, onDelete, onTagClick, activeTag }: {
  metas: DocumentMeta[];
  loading: boolean;
  onStar: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3 p-6">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    );
  }
  if (metas.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 p-6">
        <span className="font-mono font-semibold text-xs uppercase tracking-wider text-muted">
          NO DOCUMENTS FOUND. CAPTURE SOMETHING.
        </span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-4 gap-3 p-6">
      {metas.map((meta) => (
        <DocumentCard
          key={meta.id}
          meta={meta}
          onStar={onStar}
          onArchive={onArchive}
          onDelete={onDelete}
          onTagClick={onTagClick}
          activeTag={activeTag}
        />
      ))}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function LibraryApp() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [metas, setMetas] = useState<DocumentMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<DocumentMeta[] | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [quotaWarning, setQuotaWarning] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);

  // ── Boot: load cached first 20 metas immediately, hydrate rest in background
  useEffect(() => {
    async function boot() {
      const index = await getDocIndex();
      if (index.length === 0) { setLoading(false); return; }

      // Phase 1: serve first CACHE_SIZE from warm cache — instant
      const firstBatch = await getDocumentMetas(index.slice(0, 20));
      setMetas(firstBatch);
      setLoading(false);

      // Phase 2: hydrate the rest in the background
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

  // ── Mutations — update meta state + warm cache + full doc in IDB
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

  // ── Reset page on filter/sort/search/tag change
  function handleFilterChange(f: Filter) { setActiveFilter(f); setPage(1); }
  function handleSortChange(s: SortOrder) { setSortOrder(s); setPage(1); }
  function handleTagClick(tag: string) { setActiveTag(prev => prev === tag ? null : tag); setPage(1); }
  function handleSearchReset() { setPage(1); }

  // ── Derived display list
  const filtered = metas.filter(m => {
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

  // ── Pagination
  const totalPages = Math.max(1, Math.ceil(displayList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = displayList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="flex h-screen bg-background text-white">
      <Sidebar activeFilter={activeFilter} onFilterChange={handleFilterChange} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <LibraryHeader
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
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
            loading={loading}
            onStar={handleStar}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onTagClick={handleTagClick}
            activeTag={activeTag}
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
