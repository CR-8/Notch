import { useEffect, useMemo, useRef, useState, startTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Fuse from 'fuse.js';
import { Search, Hash, FileText, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnrichedBlock } from '@/lib/content-engine/types';

interface SearchOverlayProps {
  open: boolean;
  blocks: EnrichedBlock[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}

interface IndexEntry {
  id: string;
  heading: string;
  text: string;
  kind: 'heading' | 'content';
}

function stripMarkdown(raw: string): string {
  return raw
    .replace(/^#{1,6}\s*/, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .replace(/[*_~>#]+/g, '')
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 1);
  if (terms.length === 0) return <>{text}</>;
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const termSet = new Set(escaped.map((t) => t.toLowerCase()));
  const parts = text.split(new RegExp(`(${escaped.join('|')})`, 'gi'));
  return (
    <>
      {parts.map((p, i) =>
        termSet.has(p.toLowerCase()) ? (
          <mark key={i} className="rounded-[2px] bg-primary/20 text-ink">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function SearchOverlay({ open, blocks, onClose, onNavigate }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const index = useMemo<IndexEntry[]>(() => {
    const entries: IndexEntry[] = [];
    let currentHeading = { id: '', text: 'Introduction' };
    for (const b of blocks) {
      if (b.type === 'heading' && b.id) {
        const text = stripMarkdown(b.raw);
        currentHeading = { id: b.id, text };
        entries.push({ id: b.id, heading: text, text, kind: 'heading' });
      } else if (['paragraph', 'list', 'blockquote', 'reference'].includes(b.type)) {
        const text = stripMarkdown(b.raw);
        if (text.length > 8) {
          entries.push({
            id: currentHeading.id,
            heading: currentHeading.text,
            text,
            kind: 'content',
          });
        }
      }
    }
    return entries;
  }, [blocks]);

  const fuse = useMemo(
    () =>
      new Fuse(index, {
        keys: [
          { name: 'text', weight: 0.7 },
          { name: 'heading', weight: 0.3 },
        ],
        threshold: 0.38,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [index],
  );

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      return index
        .filter((e) => e.kind === 'heading')
        .slice(0, 12)
        .map((item) => ({ item }));
    }
    return fuse.search(q, { limit: 40 });
  }, [query, fuse, index]);

  useEffect(() => {
    if (open) {
      startTransition(() => {
        setQuery('');
        setActive(0);
      });
      // Defer focus until the overlay has mounted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    startTransition(() => setActive(0));
  }, [query]);

  const commit = (i: number) => {
    const entry = results[i]?.item;
    if (!entry) return;
    onNavigate(entry.id);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(results.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(active);
    }
  };

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Search document"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="reader-glass-strong relative w-full max-w-[600px] overflow-hidden rounded-2xl"
          >
            <div className="flex items-center gap-2.5 border-b border-hairline px-4">
              <Search className="h-4 w-4 shrink-0 text-ink-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search headings and content…"
                className="flex-1 bg-transparent py-3.5 text-[15px] text-ink outline-none placeholder:text-ink-faint"
              />
              <kbd className="hidden rounded bg-ink/[0.06] px-1.5 py-0.5 font-mono text-[10px] text-ink-faint sm:block">
                Esc
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <div className="px-3 py-10 text-center text-[13px] text-ink-faint">
                  No matches for “{query}”.
                </div>
              ) : (
                results.map(({ item }, i) => (
                  <button
                    key={`${item.id}-${i}`}
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => commit(i)}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                      active === i ? 'bg-surface-hover' : 'hover:bg-surface-hover/60',
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-ink-faint">
                      {item.kind === 'heading' ? (
                        <Hash className="h-3.5 w-3.5" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        <Highlighted
                          text={item.kind === 'heading' ? item.heading : item.text}
                          query={query}
                        />
                      </span>
                      {item.kind === 'content' && (
                        <span className="mt-0.5 block truncate text-[11px] text-ink-faint">
                          in {item.heading}
                        </span>
                      )}
                    </span>
                    {active === i && (
                      <CornerDownLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
