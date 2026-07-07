import { useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { readingTime } from './data';
import type { PageContext, CaptureState } from './hooks';

function compact(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
      <span className="text-[15px] font-semibold text-ink tabular-nums leading-none tracking-tight">
        {value}
      </span>
      <span className="text-[10px] font-medium text-ink-faint tracking-wide">{label}</span>
    </div>
  );
}

function StatusChip({ state }: { state: CaptureState }) {
  const map = {
    idle: { dot: 'bg-accent-green', label: 'Ready', tone: 'text-ink-muted' },
    loading: { dot: 'bg-accent-orange animate-pulse', label: 'Capturing', tone: 'text-ink-muted' },
    success: { dot: 'bg-accent-green', label: 'Captured', tone: 'text-accent-green' },
    error: { dot: 'bg-destructive', label: 'Failed', tone: 'text-destructive' },
  }[state];
  return (
    <span className="inline-flex items-center gap-1.5 shrink-0">
      <span className={cn('w-1.5 h-1.5 rounded-full', map.dot)} />
      <span className={cn('text-[11px] font-medium', map.tone)}>{map.label}</span>
    </span>
  );
}

function Favicon({ favicon, domain }: { favicon?: string; domain: string }) {
  const [broken, setBroken] = useState(false);
  if (favicon && !broken) {
    return (
      <img
        src={favicon}
        alt=""
        onError={() => setBroken(true)}
        className="w-9 h-9 rounded-lg object-cover bg-soft-cloud"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-lg bg-soft-cloud grid place-items-center">
      <span className="text-[15px] font-semibold text-ink-muted uppercase">
        {domain.charAt(0) || '?'}
      </span>
    </div>
  );
}

export function PageCard({
  page,
  captureState,
}: {
  page: PageContext;
  captureState: CaptureState;
}) {
  const minutes = readingTime(page.wordCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="rounded-xl bg-surface border border-hairline shadow-level-1 overflow-hidden"
    >
      <div className="flex items-start gap-3 p-3.5">
        <Favicon favicon={page.favicon} domain={page.domain} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {page.loading ? (
              <div className="h-3.5 w-[65%] rounded bg-hairline animate-pulse mt-0.5" />
            ) : (
              <p className="text-[13.5px] font-semibold text-ink leading-snug line-clamp-2">
                {page.title || 'Untitled page'}
              </p>
            )}
            <StatusChip state={captureState} />
          </div>
          <p className="text-[11.5px] text-ink-muted truncate mt-1">{page.domain}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1 px-3.5 pb-3.5 pt-1">
        <Stat value={minutes ? `${minutes}` : '—'} label={minutes ? 'min read' : 'read'} />
        <Stat
          value={page.headingCount != null ? String(page.headingCount) : '—'}
          label="headings"
        />
        <Stat value={page.imageCount != null ? String(page.imageCount) : '—'} label="images" />
        <Stat value={page.wordCount != null ? compact(page.wordCount) : '—'} label="words" />
      </div>
    </motion.div>
  );
}
