import { useState } from 'react';
import { LayoutGroup, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { DocumentMeta, Folder, TagColorMap } from '@/lib/types';
import { IntelligenceCard, ExpandedCard } from './intelligence-card';

export interface DocActions {
  onStar: (id: string, v: boolean) => void;
  onArchive: (id: string, v: boolean) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, folderId: string | undefined) => void;
  onRename: (id: string, title: string) => void;
  onOpen: (id: string) => void;
}

interface DocumentGridProps {
  metas: DocumentMeta[];
  folders: Folder[];
  tagColors: TagColorMap;
  view: 'grid' | 'list';
  actions: DocActions;
  bulkMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  keyboardActiveId?: string;
  emptyState?: React.ReactNode;
}

export function DocumentGrid({
  metas,
  folders,
  tagColors,
  view,
  actions,
  bulkMode,
  selectedIds,
  onToggleSelect,
  keyboardActiveId,
  emptyState,
}: DocumentGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const folderOf = (id?: string) => folders.find((f) => f.id === id);

  if (metas.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <LayoutGroup>
      <motion.div
        layout
        className={cn(
          'grid gap-4 px-6 py-6',
          view === 'list'
            ? 'grid-cols-1'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
        )}
      >
        {metas.map((meta) => {
          const isExpanded = expandedId === meta.id;
          return (
            <motion.div
              key={meta.id}
              layout
              transition={{ type: 'spring', stiffness: 260, damping: 30 }}
              // When expanded, the card claims a full-width row so siblings reflow below it.
              className={cn(isExpanded ? 'col-span-full' : 'min-h-[168px]')}
            >
              {isExpanded ? (
                <ExpandedCard
                  meta={meta}
                  folder={folderOf(meta.folder)}
                  folders={folders}
                  tagColors={tagColors}
                  onClose={() => setExpandedId(null)}
                  onOpen={() => actions.onOpen(meta.id)}
                  onStar={(v) => actions.onStar(meta.id, v)}
                  onArchive={(v) => actions.onArchive(meta.id, v)}
                  onDelete={() => {
                    actions.onDelete(meta.id);
                    setExpandedId(null);
                  }}
                  onMove={(folderId) => actions.onMove(meta.id, folderId)}
                  onRename={(title) => actions.onRename(meta.id, title)}
                  onOpenDoc={(id) => {
                    // If the related doc is on-screen, expand it inline; otherwise open the reader.
                    if (metas.some((m) => m.id === id)) setExpandedId(id);
                    else actions.onOpen(id);
                  }}
                />
              ) : (
                <IntelligenceCard
                  meta={meta}
                  folder={folderOf(meta.folder)}
                  tagColors={tagColors}
                  keyboardActive={keyboardActiveId === meta.id}
                  bulkMode={bulkMode}
                  bulkSelected={selectedIds?.has(meta.id)}
                  dimmed={expandedId !== null}
                  onExpand={() => setExpandedId(meta.id)}
                  onStar={(v) => actions.onStar(meta.id, v)}
                  onToggleBulk={() => onToggleSelect?.(meta.id)}
                />
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </LayoutGroup>
  );
}
