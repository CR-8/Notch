import { useMemo } from 'react';
import { motion } from 'motion/react';
import type { DocumentMeta, Folder } from '@/lib/types';
import { TypeGlyph, computeDensity, readingTimeOf } from './doc-visuals';

interface LibraryHomeProps {
  metas: DocumentMeta[];
  folders: Folder[];
  onOpen: (id: string) => void;
  onSelectFolder: (id: string) => void;
  onSelectConcept: (concept: string) => void;
  onShowFavorites: () => void;
  onImport: () => void;
  onOpenSettings: () => void;
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h2 className="text-[14px] font-semibold text-ink">{title}</h2>
      {hint && <span className="text-[12px] text-ink-faint">{hint}</span>}
    </div>
  );
}

function MiniDocCard({ meta, onOpen }: { meta: DocumentMeta; onOpen: (id: string) => void }) {
  return (
    <motion.button
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      onClick={() => onOpen(meta.id)}
      className="group flex w-[248px] shrink-0 snap-start flex-col gap-2.5 rounded-2xl border border-hairline bg-card p-3.5 text-left transition-shadow hover:shadow-level-1"
    >
      <div className="flex items-center justify-between">
        <TypeGlyph type={meta.documentType} label={meta.title} size="sm" />
        <span className="text-[11px] tabular-nums text-ink-faint">{readingTimeOf(meta)} min</span>
      </div>
      <p className="line-clamp-2 min-h-[38px] text-[13px] font-semibold leading-snug text-ink">
        {meta.title}
      </p>
      <span className="truncate text-[11px] text-ink-faint">{meta.domain}</span>
    </motion.button>
  );
}

function Rail({ metas, onOpen }: { metas: DocumentMeta[]; onOpen: (id: string) => void }) {
  return (
    <div className="-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {metas.map((m) => (
        <MiniDocCard key={m.id} meta={m} onOpen={onOpen} />
      ))}
    </div>
  );
}

export function LibraryHome({
  metas,
  folders,
  onOpen,
  onSelectFolder,
  onSelectConcept,
  onShowFavorites,
  onImport,
  onOpenSettings,
}: LibraryHomeProps) {
  const continueReading = useMemo(
    () =>
      metas
        .filter((m) => !m.isRead && !m.isArchived)
        .sort((a, b) => {
          const d = computeDensity(b).score - computeDensity(a).score;
          if (Math.abs(d) > 2) return d;
          return new Date(b.capturedAt).getTime() - new Date(a.capturedAt).getTime();
        })
        .slice(0, 10),
    [metas],
  );

  const pinned = useMemo(
    () => metas.filter((m) => m.isStarred && !m.isArchived).slice(0, 10),
    [metas],
  );

  const trending = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const m of metas) {
      for (const c of m.topConcepts ?? []) freq[c] = (freq[c] ?? 0) + 1;
      for (const e of m.topEntities ?? []) freq[e] = (freq[e] ?? 0) + 1;
    }
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [metas]);

  const collections = useMemo(
    () =>
      folders
        .map((f) => ({
          folder: f,
          count: metas.filter((m) => m.folder === f.id && !m.isArchived).length,
        }))
        .filter((c) => c.count > 0)
        .sort((a, b) => b.count - a.count),
    [folders, metas],
  );

  const quickAction =
    'rounded-xl border border-hairline bg-card px-3.5 py-2 text-[13px] font-medium text-ink transition-colors hover:border-primary/40 hover:shadow-level-1';

  return (
    <div className="space-y-8 px-6 pt-6">
      {/* Quick actions */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onImport} className={quickAction}>
          Import PDF
        </button>
        {pinned.length > 0 && (
          <button onClick={onShowFavorites} className={quickAction}>
            Favorites
          </button>
        )}
        <button onClick={onOpenSettings} className={quickAction}>
          Settings
        </button>
      </div>

      {continueReading.length > 0 && (
        <section>
          <SectionHeader title="Continue reading" hint={`${continueReading.length} unread`} />
          <Rail metas={continueReading} onOpen={onOpen} />
        </section>
      )}

      {pinned.length > 0 && (
        <section>
          <SectionHeader title="Pinned" />
          <Rail metas={pinned} onOpen={onOpen} />
        </section>
      )}

      {(collections.length > 0 || trending.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {collections.length > 0 && (
            <section>
              <SectionHeader title="Collections" />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {collections.slice(0, 6).map(({ folder, count }) => (
                  <button
                    key={folder.id}
                    onClick={() => onSelectFolder(folder.id)}
                    className="group flex items-center gap-3 rounded-xl border border-hairline bg-card px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:shadow-level-1"
                  >
                    <span
                      className="h-8 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: folder.color }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">
                        {folder.name}
                      </span>
                      <span className="text-[11px] text-ink-faint">
                        {count} document{count !== 1 ? 's' : ''}
                      </span>
                    </span>
                    <span className="text-[16px] leading-none text-ink-faint opacity-0 transition-opacity group-hover:opacity-100">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {trending.length > 0 && (
            <section>
              <SectionHeader title="Trending concepts" />
              <div className="flex flex-wrap gap-1.5">
                {trending.map(({ name, count }) => (
                  <button
                    key={name}
                    onClick={() => onSelectConcept(name)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-card px-3 py-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:border-primary/40 hover:text-primary"
                  >
                    {name}
                    {count > 1 && <span className="text-[10px] text-ink-faint">{count}</span>}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
