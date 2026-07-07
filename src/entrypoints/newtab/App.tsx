import { useState, useEffect, useRef, useMemo } from 'react';
import Fuse from 'fuse.js';
import { motion, AnimatePresence } from 'motion/react';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import { log } from '@/lib/logger';
import { useIsBreakpoint } from '@/hooks/use-is-breakpoint';
import type { DocumentMeta, Folder, TagColorMap } from '@/lib/types';
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
  getSettings,
  getAppearance,
  getAllProviders,
} from '@/lib/storage';
import { applyAppearance, watchAppearance } from '@/lib/theme';
import { openSettings } from '@/lib/navigation';
import { importNotchPDF } from '@/lib/import';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/toast';
import { LibrarySidebar } from '@/components/library/library-sidebar';
import { LibraryHome } from '@/components/library/library-home';
import {
  FilterBar,
  type LibraryFilter,
  type LibrarySort,
  type LibraryView,
} from '@/components/library/filter-bar';
import { DocumentGrid, type DocActions } from '@/components/library/document-grid';

type ImportStatus = 'idle' | 'importing' | 'done' | 'error';
const PAGE_SIZE = 18;
const SIDEBAR_WIDTH = 260;

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
  ignoreLocation: true,
  minMatchCharLength: 2,
};

function isProcessed(m: DocumentMeta): boolean {
  return (m.conceptCount ?? 0) > 0 || (m.entityCount ?? 0) > 0 || m.qualityScore != null;
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-16 text-center">
      <h3 className="mb-1.5 text-[16px] font-semibold text-ink">{title}</h3>
      <p className="mb-6 max-w-[340px] text-[13px] leading-relaxed text-ink-muted">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="rounded-full bg-primary px-5 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary-active"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

export default function LibraryApp() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const isMobile = useIsBreakpoint('max', 768);

  const [metas, setMetas] = useState<DocumentMeta[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tagColors, setTagColors] = useState<TagColorMap>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [sort, setSort] = useState<LibrarySort>('newest');
  const [view, setView] = useState<LibraryView>('grid');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window === 'undefined' ? true : window.innerWidth >= 768,
  );

  const [importStatus, setImportStatus] = useState<ImportStatus>('idle');
  const [quotaWarning, setQuotaWarning] = useState<{
    usedBytes: number;
    quotaBytes: number;
  } | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [keyboardIndex, setKeyboardIndex] = useState(-1);

  /* ── Data load ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [
          index,
          storedFolders,
          storedTagColors,
          storedViewMode,
          storedSettings,
          allProviders,
        ] = await Promise.all([
          getDocIndex(),
          getFolders(),
          getTagColors(),
          getViewMode(),
          getSettings(),
          getAllProviders(),
        ]);
        if (cancelled) return;
        setFolders(storedFolders);
        setTagColors(storedTagColors);
        setView(storedViewMode === 'compact' ? 'list' : 'grid');
        setHasApiKey(
          Boolean(storedSettings.apiKey) || allProviders.some((p) => p.apiKey && p.enabled),
        );
        if (index.length === 0) {
          setLoading(false);
          return;
        }
        const firstBatch = await getDocumentMetas(index.slice(0, 24));
        if (cancelled) return;
        setMetas(firstBatch);
        setLoading(false);
        if (index.length > 24) {
          const rest = await getDocumentMetas(index.slice(24));
          if (cancelled) return;
          setMetas((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...rest.filter((m) => !seen.has(m.id))];
          });
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Failed to load documents');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
        setQuotaWarning((msg as { payload: { usedBytes: number; quotaBytes: number } }).payload);
      }
    }
    browser.runtime.onMessage.addListener(onMsg);
    return () => browser.runtime.onMessage.removeListener(onMsg);
  }, []);

  /* ── Actions ───────────────────────────────────────────────────────────── */
  const openReader = (id: string) => {
    browser.tabs
      .create({ url: browser.runtime.getURL(`/reader.html?documentId=${id}`) })
      .catch(() => {});
  };

  function handleStar(id: string, starred: boolean) {
    setMetas((prev) => prev.map((m) => (m.id === id ? { ...m, isStarred: starred } : m)));
    void updateDocumentMeta(id, { starred });
  }
  function handleArchive(id: string, archived: boolean) {
    setMetas((prev) => prev.map((m) => (m.id === id ? { ...m, isArchived: archived } : m)));
    void updateDocumentMeta(id, { archived });
  }
  function handleDelete(id: string) {
    setMetas((prev) => prev.filter((m) => m.id !== id));
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    void deleteDocument(id);
    addToast('Document deleted', 'info');
  }
  function handleMove(id: string, folderId: string | undefined) {
    setMetas((prev) => prev.map((m) => (m.id === id ? { ...m, folder: folderId } : m)));
    void updateDocumentMeta(id, { folder: folderId });
  }
  function handleRename(id: string, title: string) {
    setMetas((prev) => prev.map((m) => (m.id === id ? { ...m, title } : m)));
    void updateDocumentMeta(id, { title, updatedAt: new Date().toISOString() });
    addToast('Renamed', 'success');
  }

  const actions: DocActions = {
    onStar: handleStar,
    onArchive: handleArchive,
    onDelete: handleDelete,
    onMove: handleMove,
    onRename: handleRename,
    onOpen: openReader,
  };

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setMetas((prev) => prev.filter((m) => !selectedIds.has(m.id)));
    ids.forEach((id) => void deleteDocument(id));
    setSelectedIds(new Set());
    setBulkMode(false);
    addToast(`Deleted ${ids.length} document${ids.length > 1 ? 's' : ''}`, 'info');
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
  async function handleExportFolder(folderId: string) {
    const count = metas.filter((m) => m.folder === folderId).length;
    if (count === 0) {
      addToast('No documents in this collection', 'info');
      return;
    }
    try {
      const { exportFolderAsZip } = await import('@/lib/zip-export');
      const blob = await exportFolderAsZip(folderId, 'markdown');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${folders.find((f) => f.id === folderId)?.name ?? 'collection'}.zip`;
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
      } catch (localErr) {
        log.warn('LIBRARY', 'Local PDF import failed, falling back to background', localErr);
        const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
        const importResult = await (
          browser.runtime.sendMessage as (
            ...args: unknown[]
          ) => Promise<{ type: string; payload: { error?: string; documentId?: string } }>
        )({ type: 'IMPORT_PDF', payload: { fileName: file.name, bytes, tags: [] } });
        if (importResult.type === 'CAPTURE_ERROR')
          throw new Error(importResult.payload.error ?? 'Import failed', { cause: localErr });
        docId = importResult.payload.documentId!;
      }
      const index = await getDocIndex();
      setMetas(await getDocumentMetas(index));
      setImportStatus('done');
      setTimeout(() => setImportStatus('idle'), 2500);
      openReader(docId);
    } catch (err) {
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
      log.error('LIBRARY', 'PDF import failed', err);
    } finally {
      if (e.currentTarget) e.currentTarget.value = '';
    }
  }

  /* ── Derived lists ─────────────────────────────────────────────────────── */
  const base = useMemo(() => {
    return metas
      .filter((m) => {
        if (activeFolderId) return m.folder === activeFolderId && !m.isArchived;
        if (filter === 'favorites') return m.isStarred && !m.isArchived;
        if (filter === 'archive') return m.isArchived;
        if (filter === 'unread') return !m.isRead && !m.isArchived;
        if (filter === 'processed') return isProcessed(m) && !m.isArchived;
        return !m.isArchived;
      })
      .filter((m) => !activeType || m.documentType === activeType);
  }, [metas, filter, activeFolderId, activeType]);

  const sorted = useMemo(() => {
    return [...base].sort((a, b) => {
      if (sort === 'newest')
        return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
      if (sort === 'oldest')
        return new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime();
      return a.title.localeCompare(b.title);
    });
  }, [base, sort]);

  const fuse = useMemo(() => new Fuse(base, fuseOptions), [base]);
  const searchResults = useMemo(() => {
    const q = query.trim();
    if (q.length < 2) return null;
    return fuse.search(q).map((r) => r.item);
  }, [query, fuse]);

  const tagFiltered = activeTag ? sorted.filter((m) => m.tags.includes(activeTag)) : sorted;
  const displayList = searchResults ?? tagFiltered;

  const docTypes = useMemo(() => {
    const set = new Set<string>();
    for (const m of metas) if (m.documentType) set.add(m.documentType);
    return Array.from(set).sort();
  }, [metas]);

  const showHome =
    !query && !activeTag && !activeFolderId && filter === 'all' && !activeType && metas.length > 0;

  const totalPages = Math.max(1, Math.ceil(displayList.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageSlice = displayList.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const keyboardActiveId = keyboardIndex >= 0 ? pageSlice[keyboardIndex]?.id : undefined;

  const resetPage = () => setPage(1);

  /* ── Keyboard: '/' to search, j/k/enter over the visible page ──────────── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      const typing = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (typing || pageSlice.length === 0) return;
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setKeyboardIndex((p) => Math.min(p + 1, pageSlice.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setKeyboardIndex((p) => Math.max(p - 1, 0));
      } else if (e.key === 'Enter' && keyboardIndex >= 0) {
        e.preventDefault();
        const doc = pageSlice[keyboardIndex];
        if (doc) openReader(doc.id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pageSlice, keyboardIndex]);

  /* ── Empty state ───────────────────────────────────────────────────────── */
  const emptyState = loadError ? (
    <EmptyState
      title="Something went wrong"
      description={loadError}
      action={{ label: 'Try again', onClick: () => window.location.reload() }}
    />
  ) : activeFolderId ? (
    <EmptyState
      title="This collection is empty"
      description="Drag documents here, or capture pages directly into this collection."
    />
  ) : !hasApiKey ? (
    <EmptyState
      title="Connect an AI provider"
      description="Add a provider key in Settings to start capturing and structuring documents."
      action={{ label: 'Open Settings', onClick: () => void openSettings() }}
    />
  ) : (
    <EmptyState
      title={query ? 'No matches' : 'Your library is empty'}
      description={
        query
          ? `Nothing matched “${query}”. Try a different term.`
          : 'Open any page, launch Notch, and capture it to build your knowledge base.'
      }
    />
  );

  const sidebar = (
    <LibrarySidebar
      activeFilter={filter}
      activeFolderId={activeFolderId}
      folders={folders}
      importStatus={importStatus}
      onFilterChange={(f) => {
        setFilter(f);
        setActiveFolderId(null);
        setActiveTag(null);
        resetPage();
        if (isMobile) setSidebarOpen(false);
      }}
      onSelectFolder={(id) => {
        setActiveFolderId(id);
        setFilter('all');
        setActiveTag(null);
        resetPage();
        if (isMobile) setSidebarOpen(false);
      }}
      onFolderCreate={(name, color) => {
        handleFolderCreate(name, color).catch(() => {});
      }}
      onFolderDelete={(id) => {
        handleFolderDelete(id).catch(() => {});
      }}
      onExportFolder={(id) => {
        handleExportFolder(id).catch(() => {});
      }}
      onDropDocument={handleMove}
      onImportClick={handleImportClick}
      onOpenSettings={() => void openSettings()}
    />
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-canvas-soft text-ink">
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          handleFileChange(e).catch(() => {});
        }}
        accept="application/pdf"
        className="hidden"
      />

      {/* Desktop / tablet: push sidebar (content reflows via flex-1) */}
      {!isMobile && (
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.aside
              key="library-sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="relative z-20 h-full shrink-0 overflow-hidden border-r border-hairline bg-canvas-soft"
              aria-label="Library navigation"
            >
              <div style={{ width: SIDEBAR_WIDTH }} className="h-full">
                {sidebar}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      )}

      {/* Mobile: drawer overlay */}
      {isMobile && (
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                key="scrim"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-[2px]"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                key="drawer"
                initial={{ x: -SIDEBAR_WIDTH }}
                animate={{ x: 0 }}
                exit={{ x: -SIDEBAR_WIDTH }}
                transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                className="fixed inset-y-0 left-0 z-40 border-r border-hairline bg-canvas-soft shadow-level-2"
                style={{ width: SIDEBAR_WIDTH }}
                aria-label="Library navigation"
              >
                {sidebar}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      )}

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 border-b border-hairline px-6 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              aria-pressed={sidebarOpen}
              className="-ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[15px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
            >
              ☰
            </button>
            <h1 className="whitespace-nowrap text-[20px] font-bold tracking-[-0.011em] text-ink">
              Library
            </h1>
            <span className="hidden whitespace-nowrap text-[13px] text-ink-muted sm:inline">
              {displayList.length} document{displayList.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
                placeholder="Search knowledge base…"
                className="w-44 rounded-xl border border-hairline bg-card py-2 pl-3 pr-8 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-primary sm:w-56"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-[15px] leading-none text-ink-faint hover:text-ink"
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setBulkMode((v) => !v);
                setSelectedIds(new Set());
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors',
                bulkMode
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-hairline bg-card text-ink-muted hover:border-ink-faint',
              )}
            >
              {bulkMode ? 'Selecting' : 'Select'}
            </button>
          </div>
        </header>

        {quotaWarning && (
          <div className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-xl border border-destructive bg-destructive/5 px-4 py-2.5">
            <span className="text-[12px] font-medium text-destructive">
              Storage {Math.round((quotaWarning.usedBytes / quotaWarning.quotaBytes) * 100)}% full —
              archive or delete documents to free space.
            </span>
            <button
              onClick={() => setQuotaWarning(null)}
              aria-label="Dismiss"
              className="px-1 text-[16px] leading-none text-destructive hover:opacity-70"
            >
              ×
            </button>
          </div>
        )}

        {activeTag && (
          <div className="flex items-center gap-2 px-6 pt-3">
            <span className="text-[12px] text-ink-muted">Filtering by concept:</span>
            <button
              onClick={() => {
                setActiveTag(null);
                resetPage();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary px-2.5 py-0.5 text-[12px] font-medium text-primary"
            >
              {activeTag}
              <span className="text-[14px] leading-none">×</span>
            </button>
          </div>
        )}

        <ScrollArea className="flex-1">
          {showHome && (
            <LibraryHome
              metas={metas}
              folders={folders}
              onOpen={openReader}
              onSelectFolder={(id) => {
                setActiveFolderId(id);
                setFilter('all');
                resetPage();
              }}
              onSelectConcept={(concept) => {
                setQuery(concept);
                resetPage();
                searchRef.current?.focus();
              }}
              onShowFavorites={() => {
                setFilter('favorites');
                resetPage();
              }}
              onImport={handleImportClick}
              onOpenSettings={() => void openSettings()}
            />
          )}

          {showHome && (
            <div className="mt-2 flex items-center gap-2 px-6">
              <div className="h-px flex-1 bg-hairline" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                All documents
              </span>
              <div className="h-px flex-1 bg-hairline" />
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 gap-4 px-6 py-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-[168px] rounded-2xl" />
              ))}
            </div>
          ) : (
            <>
              <FilterBar
                filter={filter}
                sort={sort}
                view={view}
                folders={folders}
                activeFolderId={activeFolderId}
                docTypes={docTypes}
                activeType={activeType}
                onFilter={(f) => {
                  setFilter(f);
                  setActiveFolderId(null);
                  resetPage();
                }}
                onSort={(s) => {
                  setSort(s);
                  resetPage();
                }}
                onView={setView}
                onFolder={(id) => {
                  setActiveFolderId(id);
                  resetPage();
                }}
                onType={(t) => {
                  setActiveType(t);
                  resetPage();
                }}
              />

              <DocumentGrid
                metas={pageSlice}
                folders={folders}
                tagColors={tagColors}
                view={view}
                actions={actions}
                bulkMode={bulkMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                keyboardActiveId={keyboardActiveId}
                emptyState={emptyState}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 border-t border-hairline py-4">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className="text-[13px] font-medium text-ink-muted transition-colors hover:text-primary disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <span className="text-[13px] tabular-nums text-ink-muted">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className="text-[13px] font-medium text-ink-muted transition-colors hover:text-primary disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </ScrollArea>
      </main>

      {/* Bulk action bar */}
      <AnimatePresence>
        {bulkMode && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="reader-glass fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2.5"
          >
            <label className="flex cursor-pointer items-center gap-2 text-[12px] font-medium text-ink">
              <input
                type="checkbox"
                checked={selectedIds.size === pageSlice.length && pageSlice.length > 0}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(pageSlice.map((m) => m.id)));
                  else setSelectedIds(new Set());
                }}
                className="h-3.5 w-3.5 accent-primary"
              />
              {selectedIds.size === 0 ? 'Select page' : `${selectedIds.size} selected`}
            </label>
            <span className="h-4 w-px bg-hairline" />
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0}
              className="text-[12px] font-semibold text-destructive transition-opacity hover:opacity-80 disabled:opacity-30"
            >
              Delete
            </button>
            <button
              onClick={() => {
                setBulkMode(false);
                setSelectedIds(new Set());
              }}
              className="text-[11px] text-ink-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
