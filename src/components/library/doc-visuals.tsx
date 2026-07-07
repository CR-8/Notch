import type { DocumentMeta } from '@/lib/types';

/** Accent color per document type. Real types only; unknown types stay neutral.
 * We deliberately avoid icon glyphs here — a colored monogram tile reads cleaner
 * and more editorial than a generic line icon. */
const TYPE_COLOR: Record<string, string> = {
  Tutorial: 'var(--color-accent-green)',
  'Research Paper': 'var(--color-accent-sky)',
  Documentation: 'var(--color-accent-orange)',
  News: 'var(--color-accent-pink)',
  Analysis: 'var(--color-accent-purple)',
  Reference: 'var(--color-accent-teal)',
  Article: 'var(--color-accent-sky)',
};

export function docTypeColor(type?: string): string {
  return (type && TYPE_COLOR[type]) || 'var(--color-ink-muted)';
}

/** Soft-tinted rounded monogram tile: the document type's (or title's) initial. */
export function TypeGlyph({
  type,
  label,
  size = 'md',
}: {
  type?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const color = docTypeColor(type);
  const letter = (type || label || '·').trim().charAt(0).toUpperCase();
  const box =
    size === 'lg'
      ? 'h-11 w-11 rounded-2xl text-[16px]'
      : size === 'sm'
        ? 'h-7 w-7 rounded-lg text-[11px]'
        : 'h-9 w-9 rounded-xl text-[13px]';
  return (
    <div
      className={`flex shrink-0 items-center justify-center font-semibold ${box}`}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      {letter}
    </div>
  );
}

export type DensityLevel = 'Low' | 'Medium' | 'High' | 'Dense';

export function computeDensity(meta: DocumentMeta): { level: DensityLevel; score: number } {
  const score =
    (meta.entityCount ?? 0) * 2 +
    (meta.conceptCount ?? 0) * 2 +
    (meta.diagramCount ?? 0) * 3 +
    (meta.hasTimeline ? 3 : 0) +
    (meta.qualityScore ?? 0) * 0.1;
  let level: DensityLevel = 'Low';
  if (score >= 30) level = 'Dense';
  else if (score >= 15) level = 'High';
  else if (score >= 6) level = 'Medium';
  return { level, score };
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function readingTimeOf(meta: DocumentMeta): number {
  return meta.readingTimeMinutes ?? Math.max(1, Math.round((meta.wordCount ?? 0) / 220));
}
