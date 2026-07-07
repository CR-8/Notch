import type { GenerationMode } from '@/lib/types';

/** Metadata that drives the segmented processing-mode control. */
export interface ModeMeta {
  mode: GenerationMode;
  label: string;
  glyph: string;
  tagline: string;
  estTime: string;
  features: string[];
}

export const MODES: ModeMeta[] = [
  {
    mode: 'FAST',
    label: 'Fast',
    glyph: '⚡',
    tagline: 'Skim it in seconds',
    estTime: '~15s',
    features: ['Clean summary', 'Key points'],
  },
  {
    mode: 'BALANCED',
    label: 'Balanced',
    glyph: '◆',
    tagline: 'The sensible default',
    estTime: '~40s',
    features: ['Summary & key points', 'Concept extraction', 'Structured reader'],
  },
  {
    mode: 'DEEP',
    label: 'Deep',
    glyph: '🧠',
    tagline: 'Understand everything',
    estTime: '~90s',
    features: ['Everything in Balanced', 'Entities & timeline', 'Knowledge graph'],
  },
];

export function modeMeta(mode: GenerationMode): ModeMeta {
  return MODES.find((m) => m.mode === mode) ?? MODES[0];
}

/**
 * The animated understanding sequence shown on the processing screen. The real
 * pipeline reports a percentage; we map that percentage onto these labels so the
 * checklist advances in step with actual work.
 */
export const PROCESSING_STEPS: string[] = [
  'Reading the page',
  'Extracting content',
  'Finding concepts',
  'Analyzing structure',
  'Generating summary',
  'Building knowledge graph',
];

/** Map a 0–100 progress percentage onto the index of the currently-active step. */
export function stepForPct(pct: number): number {
  const per = 100 / PROCESSING_STEPS.length;
  const idx = Math.floor(pct / per);
  return Math.min(idx, PROCESSING_STEPS.length - 1);
}

/**
 * Color-coded tag chips. Tags are decorative categories, so they draw from the
 * sticker palette (never the structural blue). A stable hash keeps a given tag
 * the same color every time it appears.
 */
const TAG_PALETTE = [
  { dot: 'bg-accent-purple', text: 'text-accent-purple', chip: 'bg-accent-purple/10' },
  { dot: 'bg-accent-teal', text: 'text-accent-teal', chip: 'bg-accent-teal/10' },
  { dot: 'bg-accent-pink', text: 'text-accent-pink', chip: 'bg-accent-pink/10' },
  { dot: 'bg-accent-sky', text: 'text-accent-sky', chip: 'bg-accent-sky/10' },
  { dot: 'bg-accent-green', text: 'text-accent-green', chip: 'bg-accent-green/10' },
  { dot: 'bg-accent-orange', text: 'text-accent-orange', chip: 'bg-accent-orange/10' },
] as const;

export type TagColor = (typeof TAG_PALETTE)[number];

export function tagColor(tag: string): TagColor {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

export function readingTime(wordCount: number | null): number | null {
  if (!wordCount || wordCount <= 0) return null;
  return Math.max(1, Math.round(wordCount / 220));
}
