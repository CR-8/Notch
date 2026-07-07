import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { FOLDER_COLORS } from '@/lib/color-palette';
import type { Folder } from '@/lib/types';
import { LineNav, type LineNavItem } from '@/components/line-nav';
import type { LibraryFilter } from './filter-bar';

type ImportStatus = 'idle' | 'importing' | 'done' | 'error';

interface LibrarySidebarProps {
  activeFilter: LibraryFilter;
  activeFolderId: string | null;
  folders: Folder[];
  importStatus: ImportStatus;
  onFilterChange: (f: LibraryFilter) => void;
  onSelectFolder: (id: string) => void;
  onFolderCreate: (name: string, color: string) => void;
  onFolderDelete: (id: string) => void;
  onExportFolder: (id: string) => void;
  onDropDocument: (docId: string, folderId: string) => void;
  onImportClick: () => void;
  onOpenSettings: () => void;
}

const FILTERS: { id: LibraryFilter; title: string }[] = [
  { id: 'all', title: 'All documents' },
  { id: 'unread', title: 'Unread' },
  { id: 'favorites', title: 'Favorites' },
  { id: 'processed', title: 'Processed' },
  { id: 'archive', title: 'Archive' },
];

const lineVariants = { normal: { width: 24 }, active: { width: 40 }, hover: { width: 40 } };

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
      {children}
    </div>
  );
}

/** A collection row sharing the LineNav growing-line language, with the folder
 * color, hover actions, and a drag-and-drop move target. */
function CollectionRow({
  folder,
  active,
  onSelect,
  onDelete,
  onExport,
  onDrop,
}: {
  folder: Folder;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onExport: () => void;
  onDrop: (docId: string) => void;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={cn('group relative flex items-center rounded-lg pr-1', over && 'bg-surface-hover')}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const docId = e.dataTransfer.getData('text/plain');
        if (docId) onDrop(docId);
      }}
    >
      <motion.button
        onClick={onSelect}
        aria-current={active ? 'page' : undefined}
        className="group/row flex h-7 flex-1 items-center gap-3"
        initial={false}
        animate={active ? 'active' : 'normal'}
        whileHover="hover"
      >
        <motion.span
          className="block h-[3px] shrink-0 rounded-full"
          style={{ backgroundColor: folder.color, opacity: active ? 1 : 0.55 }}
          variants={lineVariants}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />
        <span
          className={cn(
            'truncate text-sm transition-colors',
            active ? 'text-ink' : 'text-ink-muted group-hover/row:text-ink',
          )}
        >
          {folder.name}
        </span>
      </motion.button>
      <div className="flex items-center gap-0.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={onExport}
          aria-label="Export collection"
          title="Export"
          className="rounded px-1.5 text-[13px] leading-none hover:text-ink"
        >
          ↓
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete collection"
          title="Delete"
          className="rounded px-1.5 text-[15px] leading-none hover:text-sale"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function LibrarySidebar({
  activeFilter,
  activeFolderId,
  folders,
  importStatus,
  onFilterChange,
  onSelectFolder,
  onFolderCreate,
  onFolderDelete,
  onExportFolder,
  onDropDocument,
  onImportClick,
  onOpenSettings,
}: LibrarySidebarProps) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(FOLDER_COLORS[0]);

  const filterItems: LineNavItem[] = FILTERS.map((f) => ({ title: f.title, href: `f:${f.id}` }));
  const filterActiveHref = activeFolderId ? '' : `f:${activeFilter}`;

  const submitFolder = () => {
    const n = name.trim();
    if (!n) return;
    onFolderCreate(n, color);
    setName('');
    setColor(FOLDER_COLORS[0]);
    setCreating(false);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 pb-4">
      {/* Workspace header */}
      <div className="flex items-center gap-2.5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-[15px] font-bold text-primary-foreground">
          N
        </div>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[14px] font-semibold text-ink">Notch</div>
          <div className="truncate text-[11px] text-ink-faint">Knowledge base</div>
        </div>
      </div>

      {/* Filters */}
      <GroupLabel>Library</GroupLabel>
      <LineNav
        className="mb-4 w-full !gap-2 !py-2"
        items={filterItems}
        activeHref={filterActiveHref}
        scrollActiveIntoView={false}
        onItemClick={(item, e) => {
          e.preventDefault();
          onFilterChange(item.href.slice(2) as LibraryFilter);
        }}
      />

      {/* Collections */}
      <div className="mb-1 flex items-center justify-between">
        <GroupLabel>Collections</GroupLabel>
        <button
          onClick={() => setCreating((v) => !v)}
          aria-label="New collection"
          title="New collection"
          className="rounded px-1.5 text-[16px] leading-none text-ink-faint transition-colors hover:text-ink"
        >
          +
        </button>
      </div>

      {creating && (
        <div className="mb-2 rounded-xl border border-hairline bg-surface p-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitFolder();
              if (e.key === 'Escape') setCreating(false);
            }}
            placeholder="Collection name"
            className="w-full rounded-md bg-transparent px-1 text-[13px] text-ink outline-none placeholder:text-ink-faint"
          />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex gap-1">
              {FOLDER_COLORS.slice(0, 6).map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] leading-none text-white"
                  style={{ backgroundColor: c }}
                >
                  {color === c && '✓'}
                </button>
              ))}
            </div>
            <button
              onClick={submitFolder}
              className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {folders.length === 0 && !creating && (
          <p className="px-1 py-1 text-[12px] text-ink-faint">No collections yet.</p>
        )}
        {folders.map((f) => (
          <CollectionRow
            key={f.id}
            folder={f}
            active={activeFolderId === f.id}
            onSelect={() => onSelectFolder(f.id)}
            onDelete={() => onFolderDelete(f.id)}
            onExport={() => onExportFolder(f.id)}
            onDrop={(docId) => onDropDocument(docId, f.id)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-auto flex flex-col gap-0.5 pt-4">
        <button
          onClick={onImportClick}
          disabled={importStatus === 'importing'}
          className="flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          {importStatus === 'importing' && (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-hairline border-t-ink-muted" />
          )}
          {importStatus === 'importing'
            ? 'Importing…'
            : importStatus === 'done'
              ? 'Imported'
              : importStatus === 'error'
                ? 'Import failed'
                : 'Import PDF'}
        </button>
        <button
          onClick={onOpenSettings}
          className="flex items-center rounded-lg px-1 py-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink"
        >
          Settings
        </button>
      </div>
    </div>
  );
}
