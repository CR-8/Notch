import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { getDocument, findRelatedNotes, type RelatedNote } from '@/lib/storage';
import type { Document, DocumentMeta, Folder, TagColorMap } from '@/lib/types';
import {
  TypeGlyph,
  docTypeColor,
  computeDensity,
  relativeTime,
  readingTimeOf,
} from './doc-visuals';

/* ── Small building blocks ──────────────────────────────────────────────── */

function StarToggle({
  on,
  onToggle,
  size = 'sm',
}: {
  on: boolean;
  onToggle: () => void;
  size?: 'sm' | 'lg';
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={on ? 'Unstar' : 'Star'}
      className={cn(
        'shrink-0 rounded-lg leading-none transition-colors',
        size === 'lg' ? 'p-2 text-[19px]' : 'p-1.5 text-[16px]',
        on ? 'text-amber-400' : 'text-ink-faint opacity-0 hover:text-ink group-hover:opacity-100',
      )}
    >
      {on ? '★' : '☆'}
    </button>
  );
}

function Confidence({ score }: { score?: number }) {
  if (score == null) return null;
  const pct = Math.round(score);
  const tone =
    pct >= 75
      ? 'var(--color-success)'
      : pct >= 50
        ? 'var(--color-accent-orange)'
        : 'var(--color-ink-faint)';
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium tabular-nums text-ink-muted"
      title="AI confidence"
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
      {pct}%
    </span>
  );
}

/* ── Collapsed grid tile ────────────────────────────────────────────────── */

export interface IntelligenceCardProps {
  meta: DocumentMeta;
  folder?: Folder;
  tagColors: TagColorMap;
  keyboardActive?: boolean;
  bulkMode?: boolean;
  bulkSelected?: boolean;
  dimmed?: boolean;
  onExpand: () => void;
  onStar: (v: boolean) => void;
  onToggleBulk?: () => void;
}

export function IntelligenceCard({
  meta,
  folder,
  tagColors,
  keyboardActive,
  bulkMode,
  bulkSelected,
  dimmed,
  onExpand,
  onStar,
  onToggleBulk,
}: IntelligenceCardProps) {
  const typeColor = docTypeColor(meta.documentType);
  const counts = [
    (meta.conceptCount ?? 0) > 0 ? `${meta.conceptCount} concepts` : null,
    (meta.entityCount ?? 0) > 0 ? `${meta.entityCount} entities` : null,
    (meta.diagramCount ?? 0) > 0 ? `${meta.diagramCount} diagrams` : null,
    (meta.imageCount ?? 0) > 0 ? `${meta.imageCount} images` : null,
  ].filter(Boolean) as string[];

  return (
    <motion.div
      layout
      onClick={() => (bulkMode ? onToggleBulk?.() : onExpand())}
      animate={{ opacity: dimmed ? 0.45 : 1, scale: dimmed ? 0.98 : 1 }}
      whileHover={dimmed ? undefined : { y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn(
        'group relative flex h-full cursor-pointer flex-col gap-3 rounded-2xl border border-hairline bg-card p-4',
        'transition-shadow duration-200 hover:shadow-level-1',
        keyboardActive && 'ring-2 ring-primary',
        bulkSelected && 'ring-2 ring-primary',
      )}
    >
      {!meta.isRead && (
        <span
          className="absolute left-0 top-4 h-6 w-[3px] rounded-r-full bg-primary"
          aria-hidden
          title="Unread"
        />
      )}

      <div className="flex items-start justify-between gap-2">
        {bulkMode ? (
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-md border-2 text-[11px] leading-none transition-colors',
              bulkSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-hairline',
            )}
          >
            {bulkSelected && '✓'}
          </span>
        ) : (
          <TypeGlyph type={meta.documentType} label={meta.title} />
        )}
        <StarToggle on={meta.isStarred} onToggle={() => onStar(!meta.isStarred)} />
      </div>

      <div>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">
          {meta.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span className="truncate">{meta.domain}</span>
          {meta.documentType && (
            <>
              <span aria-hidden>·</span>
              <span style={{ color: typeColor }} className="font-medium">
                {meta.documentType}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Metadata — typography only */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-muted">
        <span className="tabular-nums">{readingTimeOf(meta)} min read</span>
        {counts.slice(0, 2).map((c) => (
          <span
            key={c}
            className="tabular-nums before:mr-2.5 before:text-ink-faint before:content-['·']"
          >
            {c}
          </span>
        ))}
        {meta.qualityScore != null && (
          <span className="before:mr-2.5 before:text-ink-faint before:content-['·']">
            <Confidence score={meta.qualityScore} />
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {folder ? (
            <span
              className="inline-flex items-center gap-1.5 truncate text-[11px] font-medium"
              style={{ color: folder.color }}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: folder.color }}
              />
              {folder.name}
            </span>
          ) : (
            <span className="text-[11px] text-ink-faint">{relativeTime(meta.capturedAt)}</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {meta.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="max-w-[80px] truncate rounded-full border border-hairline px-1.5 py-0.5 text-[10px] font-medium text-ink-muted"
              style={
                tagColors[tag] ? { borderColor: tagColors[tag], color: tagColors[tag] } : undefined
              }
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ── Expanded inline dashboard ──────────────────────────────────────────── */

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-hairline bg-canvas-soft/60 p-4', className)}>
      <h4 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-ink-faint">
        {title}
      </h4>
      {children}
    </section>
  );
}

function ActionButton({
  label,
  onClick,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'primary' | 'danger';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
        tone === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary-active',
        tone === 'danger' && 'text-sale hover:bg-sale/10',
        tone === 'default' && 'text-ink-muted hover:bg-surface-hover hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-[0.04em] text-ink-faint">
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

export interface ExpandedCardProps {
  meta: DocumentMeta;
  folder?: Folder;
  folders: Folder[];
  tagColors: TagColorMap;
  onClose: () => void;
  onOpen: () => void;
  onStar: (v: boolean) => void;
  onArchive: (v: boolean) => void;
  onDelete: () => void;
  onMove: (folderId?: string) => void;
  onRename: (title: string) => void;
  onOpenDoc: (id: string) => void;
}

export function ExpandedCard({
  meta,
  folder,
  folders,
  tagColors,
  onClose,
  onOpen,
  onStar,
  onArchive,
  onDelete,
  onMove,
  onRename,
  onOpenDoc,
}: ExpandedCardProps) {
  const [doc, setDoc] = useState<Document | null>(null);
  const [related, setRelated] = useState<RelatedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);
  const titleInput = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const density = computeDensity(meta);

  useEffect(() => {
    let alive = true;
    void Promise.all([getDocument(meta.id), findRelatedNotes(meta.id, 4)]).then(([d, r]) => {
      if (!alive) return;
      setDoc(d ?? null);
      setRelated(r);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [meta.id]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editing && !moving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing, moving]);

  const summary = doc?.summary || meta.summary;
  const concepts = doc?.concepts?.map((c) => c.term) ?? meta.topConcepts ?? [];
  const entities = doc?.entities?.map((e) => e.name) ?? meta.topEntities ?? [];
  const images = (doc?.images ?? []).filter((i) => i.url).slice(0, 6);
  const timeline = doc?.timeline ?? [];
  const keyPoints = doc?.keyPoints ?? [];

  const commitRename = () => {
    const val = titleInput.current?.value.trim();
    if (val && val !== meta.title) onRename(val);
    setEditing(false);
  };

  return (
    <motion.div
      ref={rootRef}
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="mx-auto w-full max-w-[1080px]"
    >
      <div className="overflow-hidden rounded-3xl border border-hairline bg-card shadow-level-2">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-hairline p-5">
          <TypeGlyph type={meta.documentType} label={meta.title} size="lg" />
          <div className="min-w-0 flex-1">
            {editing ? (
              <input
                ref={titleInput}
                autoFocus
                defaultValue={meta.title}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-full rounded-lg border border-primary/40 bg-surface px-2 py-1 text-[18px] font-semibold text-ink outline-none"
              />
            ) : (
              <h2 className="text-[18px] font-semibold leading-snug text-ink">{meta.title}</h2>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
              <a
                href={meta.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hover:text-ink"
              >
                {meta.domain} ↗
              </a>
              <span aria-hidden>·</span>
              <span>{readingTimeOf(meta)} min read</span>
              <span aria-hidden>·</span>
              <span>Added {relativeTime(meta.capturedAt)}</span>
              {doc?.status && doc.status !== 'ready' && (
                <>
                  <span aria-hidden>·</span>
                  <span className="capitalize text-accent-orange">{doc.status}</span>
                </>
              )}
            </div>
          </div>
          <StarToggle on={meta.isStarred} onToggle={() => onStar(!meta.isStarred)} size="lg" />
          <button
            onClick={onClose}
            aria-label="Collapse"
            className="rounded-lg px-2 text-[20px] leading-none text-ink-faint hover:bg-surface-hover hover:text-ink"
          >
            ×
          </button>
        </div>

        {/* Actions — text-forward */}
        <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-4 py-2">
          <ActionButton
            label={meta.isRead ? 'Continue reading' : 'Open Reader'}
            tone="primary"
            onClick={onOpen}
          />
          <ActionButton label="Ask AI" onClick={onOpen} />
          <ActionButton
            label="Export"
            onClick={() => {
              if (doc) void import('@/lib/export').then((m) => m.downloadMarkdown(doc));
            }}
          />
          <ActionButton label="Rename" onClick={() => setEditing(true)} />
          <div className="relative">
            <ActionButton label="Move" onClick={() => setMoving((v) => !v)} />
            {moving && (
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-hairline bg-popover p-1 shadow-level-2">
                <button
                  onClick={() => {
                    onMove(undefined);
                    setMoving(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink-muted hover:bg-surface-hover"
                >
                  No collection
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      onMove(f.id);
                      setMoving(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink-muted hover:bg-surface-hover"
                  >
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: f.color }} />
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ActionButton
            label={meta.isArchived ? 'Unarchive' : 'Archive'}
            onClick={() => onArchive(!meta.isArchived)}
          />
          <ActionButton label="Delete" tone="danger" onClick={onDelete} />
        </div>

        {/* Dashboard body — grows naturally, no nested scroll */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.3 }}
          className="p-4"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Panel title="Summary" className="md:col-span-2">
              {loading ? (
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-soft-cloud" />
                  <div className="h-3 w-[92%] animate-pulse rounded bg-soft-cloud" />
                  <div className="h-3 w-[78%] animate-pulse rounded bg-soft-cloud" />
                </div>
              ) : summary ? (
                <p className="text-[13.5px] leading-relaxed text-ink-secondary">{summary}</p>
              ) : (
                <p className="text-[13px] text-ink-faint">
                  No summary generated for this document.
                </p>
              )}
            </Panel>

            <Panel title="Reading intelligence">
              <div className="grid grid-cols-2 gap-2">
                <Stat label="Words" value={(meta.wordCount ?? 0).toLocaleString()} />
                <Stat label="Read time" value={`${readingTimeOf(meta)}m`} />
                <Stat label="Density" value={density.level} />
                {meta.qualityScore != null && (
                  <Stat label="AI confidence" value={`${Math.round(meta.qualityScore)}%`} />
                )}
              </div>
            </Panel>

            <Panel title="Organization">
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Collection</span>
                  {folder ? (
                    <span
                      className="inline-flex items-center gap-1.5 font-medium"
                      style={{ color: folder.color }}
                    >
                      <span
                        className="h-2 w-2 rounded-sm"
                        style={{ backgroundColor: folder.color }}
                      />
                      {folder.name}
                    </span>
                  ) : (
                    <span className="text-ink-muted">None</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-faint">Status</span>
                  <span className="font-medium text-ink">{meta.isRead ? 'Read' : 'Unread'}</span>
                </div>
              </div>
            </Panel>

            {keyPoints.length > 0 && (
              <Panel title="Key points" className="md:col-span-2">
                <ul className="space-y-1.5">
                  {keyPoints.slice(0, 5).map((k, i) => (
                    <li
                      key={i}
                      className="flex gap-2 text-[13px] leading-relaxed text-ink-secondary"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      {k}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {concepts.length > 0 && (
              <Panel title="Key concepts">
                <div className="flex flex-wrap gap-1.5">
                  {concepts.slice(0, 12).map((c) => (
                    <span
                      key={c}
                      className="rounded-md bg-accent-purple/10 px-2 py-0.5 text-[12px] font-medium text-accent-purple"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </Panel>
            )}

            {entities.length > 0 && (
              <Panel title="Entities">
                <div className="flex flex-wrap gap-1.5">
                  {entities.slice(0, 12).map((e) => (
                    <span
                      key={e}
                      className="rounded-md bg-primary/[0.07] px-2 py-0.5 text-[12px] font-medium text-primary"
                    >
                      {e}
                    </span>
                  ))}
                </div>
              </Panel>
            )}

            {images.length > 0 && (
              <Panel title="Images" className="md:col-span-2">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {images.map((img, i) => (
                    <img
                      key={i}
                      src={img.url}
                      alt={img.alt || ''}
                      loading="lazy"
                      className="aspect-video w-full rounded-lg border border-hairline object-cover"
                    />
                  ))}
                </div>
              </Panel>
            )}

            {timeline.length > 0 && (
              <Panel title="Timeline" className="md:col-span-2">
                <ol className="space-y-2 border-l border-hairline pl-4">
                  {timeline.slice(0, 5).map((t, i) => (
                    <li key={i} className="relative text-[13px]">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent-sky" />
                      <span className="font-medium text-ink">{t.date}</span>
                      <span className="text-ink-muted"> — {t.description}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            )}

            {related.length > 0 && (
              <Panel title="Related documents" className="md:col-span-2">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {related.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => onOpenDoc(r.id)}
                      className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-2.5 py-2 text-left transition-colors hover:border-primary/40"
                    >
                      <TypeGlyph label={r.title} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">
                          {r.title}
                        </span>
                        {r.sharedConcepts.length + r.sharedTags.length > 0 && (
                          <span className="block truncate text-[11px] text-ink-faint">
                            {[...r.sharedConcepts, ...r.sharedTags].slice(0, 3).join(' · ')}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            {meta.tags.length > 0 && (
              <Panel title="Tags" className="md:col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {meta.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-hairline px-2.5 py-0.5 text-[12px] font-medium text-ink-muted"
                      style={
                        tagColors[tag]
                          ? { borderColor: tagColors[tag], color: tagColors[tag] }
                          : undefined
                      }
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
