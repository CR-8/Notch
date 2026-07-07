'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useReadingProgress } from './useReadingProgress';

/* ── Constants ────────────────────────────────────────────────────────── */

const TRACK_W = 4;
const THUMB_MIN_H = 28;
const HIT_AREA = 36;
const MARKER_SIZES = { 1: 10, 2: 7, 3: 4 } as const;

/* ── Props ────────────────────────────────────────────────────────────── */

export interface ReadingProgressProps {
  containerRef: React.RefObject<HTMLElement | null>;
  headingIds: string[];
  headings: { id: string; text: string; level: number }[];
  theme?: 'light' | 'dark';
}

/* ── Sub: Tooltip ─────────────────────────────────────────────────────── */

function SectionTooltip({ text, show }: { text: string; show: boolean }) {
  return (
    <motion.div
      className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/10 bg-black/80 px-2.5 py-1 text-[11px] font-medium text-white shadow-xl backdrop-blur-md"
      initial={{ opacity: 0, x: 4 }}
      animate={{ opacity: show ? 1 : 0, x: show ? 0 : 4 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
    >
      {text}
    </motion.div>
  );
}

/* ── Sub: SectionMarker ───────────────────────────────────────────────── */

function SectionMarker({
  position,
  size,
  isActive,
  label,
  onClick,
}: {
  position: number;
  size: number;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const margin = size / 2;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2"
      style={{ top: position, marginTop: -margin }}
    >
      <motion.button
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
        className="relative flex items-center justify-center"
        style={{ width: HIT_AREA, height: HIT_AREA, marginLeft: -HIT_AREA / 2 }}
        animate={{ scale: isActive ? 1.4 : hovered ? 1.2 : 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        <motion.span
          className="block rounded-full"
          style={{ width: size, height: size }}
          animate={{
            backgroundColor: isActive
              ? 'var(--color-primary, #6366f1)'
              : hovered
                ? 'var(--color-ink-muted, #888)'
                : 'var(--color-hairline, rgba(128,128,128,0.3))',
            boxShadow: isActive ? '0 0 8px 2px var(--color-primary, #6366f1)' : 'none',
          }}
          transition={{ duration: 0.2 }}
        />
        <SectionTooltip text={label} show={hovered} />
      </motion.button>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────── */

export function ReadingProgress({
  containerRef,
  headingIds: _headingIds,
  headings: headingData,
  theme = 'dark',
}: ReadingProgressProps) {
  const { progress, scrollToPercent, scrollToHeading, registerHeading, headingPositions } =
    useReadingProgress(containerRef);

  const trackRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [trackH, setTrackH] = useState(0);
  const isLight = theme === 'light';

  /* ── Register headings ───────────────────────────────────────────────── */

  useEffect(() => {
    for (const h of headingData) {
      registerHeading(h.id, h.text, h.level);
    }
  }, [headingData, registerHeading]);

  /* ── Track track dimensions ─────────────────────────────────────────── */

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setTrackH(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── Thumb geometry ─────────────────────────────────────────────────── */

  const thumbH = Math.max(THUMB_MIN_H, trackH * 0.05);
  const thumbRange = Math.max(1, trackH - thumbH);
  const thumbTopPx = progress * thumbRange;

  /* ── Drag ────────────────────────────────────────────────────────────── */

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) return;
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      scrollToPercent((e.clientY - rect.top) / rect.height);
    },
    [dragging, scrollToPercent],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);

      const startY = e.clientY;
      const startPct = progress;

      const onMove = (ev: PointerEvent) => {
        const rect = trackRef.current?.getBoundingClientRect();
        if (!rect) return;
        const dy = (ev.clientY - startY) / rect.height;
        scrollToPercent(Math.max(0, Math.min(1, startPct + dy)));
      };

      const onUp = () => {
        setDragging(false);
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [progress, scrollToPercent],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToPercent(progress + 0.05);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToPercent(progress - 0.05);
      }
    },
    [progress, scrollToPercent],
  );

  const thick = hovered || dragging ? TRACK_W + 3 : TRACK_W;

  return (
    <div
      className={cn(
        'fixed right-3 top-0 z-50 flex h-full select-none items-center transition-opacity duration-300',
        !hovered && !dragging && 'opacity-60 hover:opacity-100',
      )}
      style={{ width: HIT_AREA }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={handleKeyDown}
      role="scrollbar"
      aria-controls="reader-document"
      aria-valuenow={Math.round(progress * 100)}
      aria-label="Reading progress"
      tabIndex={0}
    >
      <div
        ref={trackRef}
        className="relative cursor-pointer"
        onClick={handleTrackClick}
        style={{
          width: HIT_AREA,
          height: 'calc(100vh - 80px)',
          marginTop: 40,
          marginBottom: 40,
        }}
      >
        {/* Glass track */}
        <div
          className={cn(
            'absolute left-1/2 top-0 h-full -translate-x-1/2 rounded-full transition-[width] duration-200',
            isLight ? 'bg-black/[0.06]' : 'bg-white/[0.06]',
          )}
          style={{
            width: thick,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            border: `1px solid ${isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'}`,
          }}
        />

        {/* Section markers */}
        {headingPositions.map((h) => {
          const el = containerRef.current;
          const maxScroll = el ? Math.max(1, el.scrollHeight - el.clientHeight) : 1;
          const headingPct = h.top / maxScroll;
          const pos = headingPct * trackH;
          const size = MARKER_SIZES[h.level as keyof typeof MARKER_SIZES] ?? 4;
          const isActive = Math.abs(h.top - (containerRef.current?.scrollTop ?? 0)) < 100;
          return (
            <SectionMarker
              key={h.id}
              position={Math.max(size / 2, Math.min(trackH - size / 2, pos))}
              size={size}
              isActive={isActive}
              label={h.text}
              onClick={() => scrollToHeading(h.id)}
            />
          );
        })}

        {/* Thumb */}
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 rounded-full transition-colors duration-150',
            dragging ? 'cursor-grabbing' : 'cursor-grab',
            isLight ? 'bg-black/40 hover:bg-black/50' : 'bg-white/40 hover:bg-white/50',
          )}
          style={{
            width: thick + 2,
            height: thumbH,
            top: thumbTopPx,
            transition: dragging ? 'none' : 'top 80ms ease-out, box-shadow 150ms',
            boxShadow:
              hovered || dragging
                ? isLight
                  ? '0 0 8px rgba(0,0,0,0.12)'
                  : '0 0 8px rgba(255,255,255,0.12)'
                : 'none',
          }}
          onPointerDown={handlePointerDown}
        />

        {/* Glow overlay on hover */}
        {(hovered || dragging) && (
          <div
            className={cn(
              'pointer-events-none absolute left-1/2 top-0 h-full -translate-x-1/2 rounded-full',
              isLight
                ? 'bg-gradient-to-b from-black/[0.02] via-transparent to-black/[0.02]'
                : 'bg-gradient-to-b from-white/[0.04] via-transparent to-white/[0.04]',
            )}
            style={{ width: thick + 4 }}
          />
        )}
      </div>
    </div>
  );
}
