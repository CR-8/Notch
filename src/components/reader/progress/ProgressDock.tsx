import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';
import type { ReadingStats } from '../hooks/useReadingStats';

interface Chapter {
  id: string;
  text: string;
}

interface ProgressDockProps {
  containerRef: React.RefObject<HTMLElement | null>;
  progress: number;
  chapters: Chapter[];
  activeId: string | null;
  stats: ReadingStats;
  onSeek: (pct: number) => void;
  onNavigate: (id: string) => void;
}

interface Segment extends Chapter {
  start: number;
  end: number;
}

export function ProgressDock({
  containerRef,
  progress,
  chapters,
  activeId,
  stats,
  onSeek,
  onNavigate,
}: ProgressDockProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [resizeTick, setResizeTick] = useState(0);

  const smooth = useSpring(progress, { stiffness: 180, damping: 26, mass: 0.4 });
  useEffect(() => {
    smooth.set(progress);
  }, [progress, smooth]);
  const indicatorLeft = useTransform(smooth, (v) => `${Math.max(0, Math.min(1, v)) * 100}%`);

  // Recompute chapter boundaries when layout changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setResizeTick((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  const segments = useMemo<Segment[]>(() => {
    const el = containerRef.current;
    if (!el || chapters.length === 0) return [];
    const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
    const starts = chapters.map((c) => {
      const node = el.querySelector(`#${CSS.escape(c.id)}`);
      return node ? Math.min(1, node.offsetTop / maxScroll) : 0;
    });
    return chapters.map((c, i) => ({
      ...c,
      start: starts[i],
      end: i < chapters.length - 1 ? starts[i + 1] : 1,
    }));
    // resizeTick + progress intentionally drive recompute as content settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters, containerRef, resizeTick]);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
    },
    [onSeek],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setDragging(true);
      seekFromEvent(e.clientX);
      const move = (ev: PointerEvent) => seekFromEvent(ev.clientX);
      const up = () => {
        setDragging(false);
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    },
    [seekFromEvent],
  );

  const currentChapter =
    segments.find((s) => s.id === activeId)?.text ??
    segments.find((s) => progress >= s.start && progress < s.end)?.text ??
    segments[0]?.text ??
    'Introduction';

  const pct = Math.round(progress * 100);

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30, delay: 0.15 }}
      className="reader-glass pointer-events-auto absolute bottom-4 left-1/2 z-30 w-[min(92%,620px)] -translate-x-1/2 rounded-2xl px-4 pb-3 pt-2.5"
      role="group"
      aria-label="Reading progress"
    >
      {/* Meta row */}
      <div className="mb-2 flex items-center justify-between gap-3 text-[11px]">
        <span className="truncate font-medium text-ink" title={currentChapter}>
          {currentChapter}
        </span>
        <div className="flex shrink-0 items-center gap-2.5 font-mono text-ink-faint">
          <span className="tabular-nums text-ink-muted">{pct}%</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{stats.minutesLeft} min left</span>
          <span className="hidden tabular-nums sm:inline" aria-hidden>
            ·
          </span>
          <span className="hidden tabular-nums sm:inline">{stats.wpm} wpm</span>
        </div>
      </div>

      {/* Segmented track */}
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        className={cn(
          'relative flex h-2 w-full items-stretch gap-[3px] rounded-full',
          dragging ? 'cursor-grabbing' : 'cursor-pointer',
        )}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Seek reading position"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.05));
          if (e.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.05));
        }}
      >
        {segments.length === 0 ? (
          <div className="relative h-full flex-1 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : (
          segments.map((s) => {
            const span = Math.max(0.0001, s.end - s.start);
            const fill = Math.max(0, Math.min(1, (progress - s.start) / span));
            const isActive = progress >= s.start && progress < s.end;
            return (
              <button
                key={s.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onNavigate(s.id)}
                title={s.text}
                aria-label={`Go to ${s.text}`}
                className="group relative h-full min-w-[6px] overflow-hidden rounded-full bg-ink/10 transition-transform hover:scale-y-[1.6]"
                style={{ flexGrow: span }}
              >
                <span
                  className={cn(
                    'absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out',
                    isActive ? 'bg-primary' : 'bg-primary/55',
                  )}
                  style={{ width: `${fill * 100}%` }}
                />
              </button>
            );
          })
        )}

        {/* Smooth global indicator */}
        <motion.span
          className="pointer-events-none absolute top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-ink/70"
          style={{ left: indicatorLeft }}
          aria-hidden
        />
      </div>
    </motion.div>
  );
}
