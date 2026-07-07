import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { Folder } from '@/lib/types';

export type LibraryFilter = 'all' | 'unread' | 'favorites' | 'processed' | 'archive';
export type LibrarySort = 'newest' | 'oldest' | 'title-az';
export type LibraryView = 'grid' | 'list';

interface Segment<T extends string> {
  value: T;
  label: string;
}

function Segmented<T extends string>({
  segments,
  value,
  onChange,
  groupId,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  groupId: string;
}) {
  return (
    <div className="flex items-center rounded-xl bg-soft-cloud p-0.5">
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            onClick={() => onChange(s.value)}
            className={cn(
              'relative rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
              active ? 'text-ink' : 'text-ink-faint hover:text-ink-muted',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 rounded-lg bg-surface shadow-level-1"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function Dropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-xl border border-hairline bg-card py-1.5 pl-3 pr-8 text-[12px] font-medium text-ink-muted outline-none transition-colors hover:border-ink-faint focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-[11px] leading-none text-ink-faint">
        ⌄
      </span>
    </div>
  );
}

interface FilterBarProps {
  filter: LibraryFilter;
  sort: LibrarySort;
  view: LibraryView;
  folders: Folder[];
  activeFolderId: string | null;
  docTypes: string[];
  activeType: string | null;
  onFilter: (f: LibraryFilter) => void;
  onSort: (s: LibrarySort) => void;
  onView: (v: LibraryView) => void;
  onFolder: (id: string | null) => void;
  onType: (t: string | null) => void;
}

export function FilterBar({
  filter,
  sort,
  view,
  folders,
  activeFolderId,
  docTypes,
  activeType,
  onFilter,
  onSort,
  onView,
  onFolder,
  onType,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-6 py-3">
      <Segmented
        groupId="filter"
        value={filter}
        onChange={onFilter}
        segments={[
          { value: 'all', label: 'All' },
          { value: 'unread', label: 'Unread' },
          { value: 'favorites', label: 'Favorites' },
          { value: 'processed', label: 'Processed' },
          { value: 'archive', label: 'Archive' },
        ]}
      />

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {folders.length > 0 && (
          <Dropdown
            label="Collection"
            value={activeFolderId ?? ''}
            onChange={(v) => onFolder(v || null)}
            options={[
              { value: '', label: 'All collections' },
              ...folders.map((f) => ({ value: f.id, label: f.name })),
            ]}
          />
        )}

        {docTypes.length > 0 && (
          <Dropdown
            label="Document type"
            value={activeType ?? ''}
            onChange={(v) => onType(v || null)}
            options={[
              { value: '', label: 'All types' },
              ...docTypes.map((t) => ({ value: t, label: t })),
            ]}
          />
        )}

        <Segmented
          groupId="sort"
          value={sort}
          onChange={onSort}
          segments={[
            { value: 'newest', label: 'Newest' },
            { value: 'oldest', label: 'Oldest' },
            { value: 'title-az', label: 'A–Z' },
          ]}
        />

        <Segmented
          groupId="view"
          value={view}
          onChange={onView}
          segments={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
        />
      </div>
    </div>
  );
}
