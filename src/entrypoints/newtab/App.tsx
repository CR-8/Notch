import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import type { Document } from '@/lib/types';
import { getDocIndex, getDocument, saveDocument, deleteDocument } from '@/lib/storage';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// ── Fuse config ───────────────────────────────────────────────────────────────
const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'tags', weight: 0.3 },
    { name: 'content', weight: 0.2 },
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
function SearchInput({ documents, onSearchResults }: { documents: Document[]; onSearchResults: (r: Document[] | null) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fuse = useMemo(() => new Fuse(documents, fuseOptions), [documents]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
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
function LibraryHeader({ sortOrder, onSortChange, searchSlot }: { sortOrder: SortOrder; onSortChange: (s: SortOrder) => void; searchSlot?: React.ReactNode }) {
  const sorts: { label: string; value: SortOrder }[] = [
    { label: 'NEWEST', value: 'newest' },
    { label: 'OLDEST', value: 'oldest' },
    { label: 'A–Z', value: 'title-az' },
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
    { label: 'FAVORITES', value: 'favorites' },
    { label: 'ARCHIVE', value: 'archive' },
    { label: 'SETTINGS', value: 'settings' },
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

// ── Document card ─────────────────────────────────────────────────────────────
interface DocumentCardProps {
  doc: Document;
  onStar: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
}

function DocumentCard({ doc, onStar, onArchive, onDelete, onTagClick, activeTag }: DocumentCardProps) {
  function stop<T>(fn: () => T) {
    return (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
  }

  return (
    <div
      onClick={() => browser.tabs.create({ url: browser.runtime.getURL(`/reader.html?documentId=${doc.id}`) })}
      className="card p-3 cursor-pointer flex flex-col gap-1.5 hover:bg-surface-hover transition-colors"
    >
      <p className="font-heading font-bold text-sm text-white truncate">{doc.title}</p>

      <div className="flex gap-3 items-center">
        <span className="font-mono text-[10px] text-muted uppercase">{doc.domain}</span>
        <span className="font-mono text-[10px] text-muted">{doc.wordCount}w</span>
        <span className="font-mono text-[10px] text-muted">{doc.capturedAt.slice(0, 10)}</span>
      </div>

      {doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {doc.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              onClick={stop(() => onTagClick(tag))}
              className={cn(
                'font-mono text-[9px] uppercase px-1 py-0 cursor-pointer transition-colors',
                activeTag === tag ? 'border-primary text-primary' : 'border-border text-muted hover:border-white hover:text-white'
              )}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-0.5 items-center">
        <button
          onClick={stop(() => onStar(doc.id, !doc.isStarred))}
          title={doc.isStarred ? 'Unstar' : 'Star'}
          className={cn('font-mono text-[11px] transition-colors', doc.isStarred ? 'text-primary' : 'text-muted hover:text-white')}
        >
          {doc.isStarred ? '★' : '☆'}
        </button>
        <button
          onClick={stop(() => onArchive(doc.id, !doc.isArchived))}
          title={doc.isArchived ? 'Unarchive' : 'Archive'}
          className={cn('font-mono text-[11px] transition-colors', doc.isArchived ? 'text-primary' : 'text-muted hover:text-white')}
        >
          ⊡
        </button>
        <button
          onClick={stop(() => onDelete(doc.id))}
          title="Delete"
          className="font-mono font-semibold text-[11px] text-danger hover:text-danger/80 ml-auto transition-colors"
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

// ── Document grid ─────────────────────────────────────────────────────────────
function DocumentGrid({ documents, loading, onStar, onArchive, onDelete, onTagClick, activeTag }: {
  documents: Document[]; loading: boolean;
  onStar: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onTagClick: (tag: string) => void;
  activeTag: string | null;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-4 gap-3 p-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  }

  if (documents.length === 0) {
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
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          doc={doc}
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
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Document[] | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);

  useEffect(() => {
    getDocIndex().then(async (index) => {
      const docs = await Promise.all(index.map(id => getDocument(id)));
      setDocuments(docs.filter((d): d is Document => d !== null));
      setLoading(false);
    });
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
    setDocuments(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, isStarred: starred } : d);
      const doc = updated.find(d => d.id === id);
      if (doc) saveDocument(doc);
      return updated;
    });
  }

  function handleArchive(id: string, archived: boolean) {
    setDocuments(prev => {
      const updated = prev.map(d => d.id === id ? { ...d, isArchived: archived } : d);
      const doc = updated.find(d => d.id === id);
      if (doc) saveDocument(doc);
      return updated;
    });
  }

  function handleDelete(id: string) {
    setDocuments(prev => prev.filter(d => d.id !== id));
    deleteDocument(id);
  }

  const filtered = documents.filter(doc => {
    if (activeFilter === 'favorites') return doc.isStarred;
    if (activeFilter === 'archive') return doc.isArchived;
    return !doc.isArchived;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === 'newest') return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
    if (sortOrder === 'oldest') return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
    return a.title.localeCompare(b.title);
  });

  const tagFiltered = activeTag ? sorted.filter(d => d.tags.includes(activeTag)) : sorted;
  const finalDocs = searchResults ?? tagFiltered;

  return (
    <div className="flex h-screen bg-background text-white">
      <Sidebar activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <LibraryHeader
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          searchSlot={<SearchInput documents={filtered} onSearchResults={setSearchResults} />}
        />

        {activeTag && (
          <div className="flex items-center gap-2 px-6 pt-3">
            <span className="font-mono text-[10px] text-muted uppercase">FILTERING BY:</span>
            <Badge
              variant="outline"
              className="font-mono text-[10px] uppercase border-primary text-primary gap-1.5"
            >
              {activeTag}
              <button onClick={() => setActiveTag(null)} className="hover:text-white leading-none">×</button>
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
            documents={finalDocs}
            loading={loading}
            onStar={handleStar}
            onArchive={handleArchive}
            onDelete={handleDelete}
            onTagClick={(tag) => setActiveTag(prev => prev === tag ? null : tag)}
            activeTag={activeTag}
          />
        </ScrollArea>
      </div>
    </div>
  );
}
