import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ListTree, BarChart3, Bookmark, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TOCItem } from '@/lib/content-engine/hierarchy';
import type { DocumentHighlight } from '@/lib/types';
import type { ReadingStats } from '../hooks/useReadingStats';

const PANEL_WIDTH = 300;
type Tab = 'contents' | 'stats' | 'bookmarks';

interface UtilityPanelProps {
  open: boolean;
  overlay?: boolean;
  toc: TOCItem[];
  activeId: string | null;
  progress: number;
  stats: ReadingStats;
  totalWords: number;
  readingTimeMinutes: number;
  sectionCount: number;
  highlights: DocumentHighlight[];
  onNavigate: (id: string) => void;
  onJumpHighlight: (h: DocumentHighlight) => void;
  onDeleteHighlight: (id: string) => void;
}

function TocNode({
  item,
  activeId,
  depth,
  onNavigate,
}: {
  item: TOCItem;
  activeId: string | null;
  depth: number;
  onNavigate: (id: string) => void;
}) {
  const isActive = activeId === item.id;
  return (
    <div>
      <button
        onClick={() => onNavigate(item.id)}
        aria-current={isActive ? 'true' : undefined}
        className={cn(
          'group relative flex w-full items-start gap-2 rounded-md py-1 pr-2 text-left text-[13px] leading-snug transition-colors',
          isActive ? 'text-ink' : 'text-ink-muted hover:text-ink',
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        {isActive && (
          <motion.span
            layoutId="panel-toc-active"
            className="absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
            transition={{ type: 'spring', stiffness: 500, damping: 34 }}
          />
        )}
        {item.number && (
          <span
            className={cn(
              'shrink-0 font-mono text-[10px] leading-5',
              isActive ? 'text-primary' : 'text-ink-faint',
            )}
          >
            {item.number}
          </span>
        )}
        <span className="truncate">{item.text}</span>
      </button>
      {item.children.length > 0 && (
        <div>
          {item.children.map((c) => (
            <TocNode
              key={c.id}
              item={c}
              activeId={activeId}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-ink-faint">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-[18px] font-semibold tabular-nums text-ink">
        {value}
      </div>
      {sub && <div className="text-[11px] text-ink-muted">{sub}</div>}
    </div>
  );
}

export function UtilityPanel({
  open,
  overlay,
  toc,
  activeId,
  progress,
  stats,
  totalWords,
  readingTimeMinutes,
  sectionCount,
  highlights,
  onNavigate,
  onJumpHighlight,
  onDeleteHighlight,
}: UtilityPanelProps) {
  const [tab, setTab] = useState<Tab>('contents');
  const pct = Math.round(progress * 100);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'contents', label: 'Contents', icon: <ListTree className="h-3.5 w-3.5" /> },
    { id: 'stats', label: 'Stats', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: 'bookmarks', label: 'Marks', icon: <Bookmark className="h-3.5 w-3.5" /> },
  ];

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="reader-panel"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: PANEL_WIDTH, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          className={cn(
            'h-full overflow-hidden border-l border-hairline bg-canvas-soft',
            overlay ? 'fixed inset-y-0 right-0 z-40 shadow-level-2' : 'relative z-20 shrink-0',
          )}
          aria-label="Reading tools"
        >
          <div className="flex h-full flex-col" style={{ width: PANEL_WIDTH }}>
            {/* Tab switcher */}
            <div className="flex gap-1 p-3 pb-2">
              <div className="flex flex-1 rounded-lg bg-soft-cloud p-0.5">
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'relative flex flex-1 items-center justify-center gap-1.5 rounded-md py-1 text-[12px] font-medium transition-colors',
                      tab === t.id ? 'text-ink' : 'text-ink-faint hover:text-ink-muted',
                    )}
                  >
                    {tab === t.id && (
                      <motion.span
                        layoutId="panel-tab-bg"
                        className="absolute inset-0 rounded-md bg-surface shadow-level-1"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-1.5">
                      {t.icon}
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-6">
              {tab === 'contents' && (
                <nav aria-label="Table of contents" className="pt-1">
                  {toc.length > 0 ? (
                    toc.map((item) => (
                      <TocNode
                        key={item.id}
                        item={item}
                        activeId={activeId}
                        depth={0}
                        onNavigate={onNavigate}
                      />
                    ))
                  ) : (
                    <p className="px-2 py-6 text-center text-[12px] text-ink-faint">
                      No headings in this document.
                    </p>
                  )}
                </nav>
              )}

              {tab === 'stats' && (
                <div className="space-y-2 pt-1">
                  <div className="rounded-xl border border-hairline bg-surface p-3">
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className="font-medium text-ink">Progress</span>
                      <span className="font-mono tabular-nums text-ink-muted">{pct}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-soft-cloud">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        animate={{ width: `${pct}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <StatTile label="Words" value={totalWords.toLocaleString()} />
                    <StatTile
                      label="Read"
                      value={readingTimeMinutes ? `${readingTimeMinutes}m` : '—'}
                    />
                    <StatTile
                      label="Left"
                      value={`${stats.minutesLeft}m`}
                      sub={`${stats.wordsLeft.toLocaleString()} words`}
                    />
                    <StatTile label="Pace" value={`${stats.wpm}`} sub="words / min" />
                    <StatTile label="Sections" value={`${sectionCount}`} />
                    <StatTile
                      label="Done"
                      value={`${stats.wordsRead.toLocaleString()}`}
                      sub="words read"
                    />
                  </div>
                </div>
              )}

              {tab === 'bookmarks' && (
                <div className="space-y-1.5 pt-1">
                  {highlights.length > 0 ? (
                    highlights.map((h) => (
                      <div
                        key={h.id}
                        className="group flex items-start gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-2"
                      >
                        <button
                          onClick={() => onJumpHighlight(h)}
                          className="flex-1 text-left text-[12px] leading-snug text-ink-muted transition-colors hover:text-ink"
                        >
                          <span className="line-clamp-3 border-l-2 border-accent-orange/60 pl-2">
                            {h.text}
                          </span>
                        </button>
                        <button
                          onClick={() => onDeleteHighlight(h.id)}
                          aria-label="Remove bookmark"
                          className="mt-0.5 rounded p-1 text-ink-faint opacity-0 transition hover:bg-surface-hover hover:text-sale group-hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="px-2 py-8 text-center">
                      <Bookmark className="mx-auto mb-2 h-5 w-5 text-ink-faint" />
                      <p className="text-[12px] text-ink-faint">
                        Select text and choose Highlight to save a bookmark here.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
