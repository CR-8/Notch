import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Library,
  Settings,
  Star,
  Clock,
  Folder as FolderIcon,
  ChevronRight,
  FileText,
  Search,
} from 'lucide-react';
import { browser } from 'wxt/browser';
import { getAllNotes, getFolders } from '@/lib/storage';
import { openSettings, goToLibrary } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import type { Document, Folder } from '@/lib/types';

const SIDEBAR_WIDTH = 268;

interface ReaderSidebarProps {
  open: boolean;
  currentDocId: string;
  onOpenSearch: () => void;
  overlay?: boolean;
}

function readerUrl(id: string): string {
  return `${browser.runtime.getURL('/reader.html')}?documentId=${encodeURIComponent(id)}`;
}

function DocRow({
  doc,
  active,
}: {
  doc: Pick<Document, 'id' | 'title' | 'domain'>;
  active: boolean;
}) {
  return (
    <a
      href={readerUrl(doc.id)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors',
        active
          ? 'bg-surface-hover font-medium text-ink'
          : 'text-ink-muted hover:bg-surface-hover hover:text-ink',
      )}
    >
      <FileText
        className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-primary' : 'text-ink-faint')}
      />
      <span className="truncate">{doc.title}</span>
    </a>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
      {children}
    </div>
  );
}

export function ReaderSidebar({ open, currentDocId, onOpenSearch, overlay }: ReaderSidebarProps) {
  const [docs, setDocs] = useState<Document[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    void Promise.all([getAllNotes(), getFolders()]).then(([d, f]) => {
      if (!alive) return;
      setDocs(d.filter((doc) => !doc.archived));
      setFolders(f);
    });
    return () => {
      alive = false;
    };
  }, []);

  const starred = useMemo(() => docs.filter((d) => d.starred), [docs]);
  const recent = useMemo(
    () =>
      [...docs].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 8),
    [docs],
  );
  const byFolder = useMemo(() => {
    const map = new Map<string, Document[]>();
    for (const d of docs) {
      if (!d.folder) continue;
      const arr = map.get(d.folder) ?? [];
      arr.push(d);
      map.set(d.folder, arr);
    }
    return map;
  }, [docs]);

  const toggleFolder = (id: string) =>
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="reader-sidebar"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: SIDEBAR_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className={cn(
            'h-full overflow-hidden border-r border-hairline bg-canvas-soft',
            overlay ? 'fixed inset-y-0 left-0 z-40 shadow-level-2' : 'relative z-20 shrink-0',
          )}
          aria-label="Workspace navigation"
        >
          <div className="flex h-full flex-col" style={{ width: SIDEBAR_WIDTH }}>
            {/* Workspace header */}
            <div className="flex items-center gap-2 px-3 pb-2 pt-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
                N
              </div>
              <span className="text-[13px] font-semibold text-ink">Notch</span>
            </div>

            {/* Search launcher */}
            <div className="px-3 pb-1">
              <button
                type="button"
                onClick={onOpenSearch}
                className="flex w-full items-center gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[12px] text-ink-faint transition-colors hover:border-primary/40 hover:text-ink-muted"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
                <kbd className="ml-auto rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10px] leading-none">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Quick actions */}
            <nav className="px-3 pt-1">
              <button
                onClick={goToLibrary}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <Library className="h-3.5 w-3.5 text-ink-faint" />
                Library
              </button>
              <button
                onClick={() => void openSettings()}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <Settings className="h-3.5 w-3.5 text-ink-faint" />
                Settings
              </button>
            </nav>

            {/* Scrollable collections */}
            <div className="mt-1 flex-1 overflow-y-auto px-3 pb-4">
              {starred.length > 0 && (
                <>
                  <SectionLabel>
                    <Star className="h-3 w-3" /> Pinned
                  </SectionLabel>
                  {starred.map((d) => (
                    <DocRow key={d.id} doc={d} active={d.id === currentDocId} />
                  ))}
                </>
              )}

              {folders.length > 0 && (
                <>
                  <SectionLabel>
                    <FolderIcon className="h-3 w-3" /> Collections
                  </SectionLabel>
                  {folders.map((f) => {
                    const items = byFolder.get(f.id) ?? [];
                    const isOpen = openFolders.has(f.id);
                    return (
                      <div key={f.id}>
                        <button
                          onClick={() => toggleFolder(f.id)}
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                        >
                          <ChevronRight
                            className={cn(
                              'h-3.5 w-3.5 text-ink-faint transition-transform duration-200',
                              isOpen && 'rotate-90',
                            )}
                          />
                          <span
                            className="h-2 w-2 shrink-0 rounded-sm"
                            style={{ backgroundColor: f.color }}
                          />
                          <span className="truncate">{f.name}</span>
                          <span className="ml-auto text-[11px] text-ink-faint">{items.length}</span>
                        </button>
                        <AnimatePresence initial={false}>
                          {isOpen && items.length > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                              className="overflow-hidden pl-4"
                            >
                              {items.map((d) => (
                                <DocRow key={d.id} doc={d} active={d.id === currentDocId} />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </>
              )}

              <SectionLabel>
                <Clock className="h-3 w-3" /> Recent
              </SectionLabel>
              {recent.map((d) => (
                <DocRow key={d.id} doc={d} active={d.id === currentDocId} />
              ))}
              {recent.length === 0 && (
                <p className="px-2 py-4 text-[12px] text-ink-faint">No documents yet.</p>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
