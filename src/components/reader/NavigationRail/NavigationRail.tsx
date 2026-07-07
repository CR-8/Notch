import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { motion, useSpring } from 'motion/react';
import { cn } from '@/lib/utils';
import type { TOCItem } from '@/lib/content-engine/hierarchy';

interface NavigationRailProps {
  toc: TOCItem[];
  activeId: string | null;
  progress: number;
  containerRef: React.RefObject<HTMLElement | null>;
  onNavigate: (id: string) => void;
  readingTime?: number;
}

function RailSection({
  item,
  activeId,
  depth = 0,
  onNavigate,
}: {
  item: TOCItem;
  activeId: string | null;
  depth?: number;
  onNavigate: (id: string) => void;
}) {
  const isActive = activeId === item.id;
  const isExpanded = isActive || depth < 1;

  return (
    <div className="select-none">
      <button
        onClick={() => onNavigate(item.id)}
        className={cn(
          'group relative flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-left text-[13px] font-normal transition-all duration-150',
          isActive ? 'text-ink font-medium' : 'text-ink-faint hover:text-ink-muted',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        aria-current={isActive ? 'true' : undefined}
      >
        {isActive && (
          <motion.span
            layoutId="rail-active-indicator"
            className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary"
            transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          />
        )}
        <span
          className={cn(
            'shrink-0 font-mono text-[10px] leading-none transition-colors duration-150',
            isActive ? 'text-primary' : 'text-ink-faint',
          )}
          style={{ minWidth: '20px' }}
        >
          {item.number}
        </span>
        <span className="truncate leading-snug">{item.text}</span>
      </button>
      {item.children.length > 0 && isExpanded && (
        <div>
          {item.children.map((child, i) => (
            <RailSection
              key={`${child.id}-${i}`}
              item={child}
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

function flattenTOC(items: TOCItem[]): TOCItem[] {
  const result: TOCItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children.length > 0) {
      result.push(...flattenTOC(item.children));
    }
  }
  return result;
}

export function NavigationRail({
  toc,
  activeId,
  progress,
  containerRef,
  onNavigate,
  readingTime,
}: NavigationRailProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);
  const flatTOC = useMemo(() => flattenTOC(toc), [toc]);

  const smoothProgress = useSpring(progress, {
    stiffness: 100,
    damping: 20,
  });

  useEffect(() => {
    smoothProgress.set(progress);
  }, [progress, smoothProgress]);

  const handleRailClick = useCallback(
    (e: React.MouseEvent) => {
      const rail = railRef.current;
      if (!rail || !containerRef.current) return;
      const rect = rail.getBoundingClientRect();
      const y = (e.clientY - rect.top) / rect.height;
      const el = containerRef.current;
      const maxScroll = el.scrollHeight - el.clientHeight;
      el.scrollTo({ top: maxScroll * y, behavior: 'smooth' });
    },
    [containerRef],
  );

  const handleThumbPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const rail = railRef.current;
      if (!rail || !containerRef.current) return;

      const onPointerMove = (ev: PointerEvent) => {
        const rect = rail.getBoundingClientRect();
        const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
        const el = containerRef.current;
        if (!el) return;
        const maxScroll = el.scrollHeight - el.clientHeight;
        el.scrollTop = maxScroll * y;
      };

      const onPointerUp = () => {
        setIsDragging(false);
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
      };

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
    },
    [containerRef],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = flatTOC.findIndex((item) => item.id === activeId);
      if (currentIndex === -1) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = e.key === 'ArrowDown' ? currentIndex + 1 : currentIndex - 1;
        if (next >= 0 && next < flatTOC.length) {
          onNavigate(flatTOC[next].id);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        if (flatTOC.length > 0) onNavigate(flatTOC[0].id);
      } else if (e.key === 'End') {
        e.preventDefault();
        if (flatTOC.length > 0) onNavigate(flatTOC[flatTOC.length - 1].id);
      }
    },
    [flatTOC, activeId, onNavigate],
  );

  const headerCount = toc.length;
  const thumbHeight = Math.max(24, 100 / Math.max(1, headerCount));
  const thumbTop = progress * (100 - thumbHeight);

  return (
    <nav
      ref={railRef}
      className={cn(
        'group/rail relative flex h-full w-full flex-col',
        'transition-all duration-300 ease-out',
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      role="navigation"
      aria-label="Document sections"
    >
      <div className="flex items-center gap-2 px-3 pb-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          On this page
        </span>
        {readingTime && (
          <span className="text-[10px] text-ink-faint/60">{readingTime} min read</span>
        )}
      </div>

      <div className="relative flex flex-1 gap-3 overflow-hidden">
        <div
          className="absolute right-0 top-0 h-full w-px cursor-pointer bg-hairline transition-colors duration-200 hover:bg-hairline-soft"
          onClick={handleRailClick}
          role="scrollbar"
          aria-controls="reader-document"
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Scroll progress"
          tabIndex={0}
        >
          <motion.div
            className={cn(
              'absolute right-0 w-full rounded-full bg-ink-faint transition-all duration-200',
              (isHovered || isDragging) && 'bg-ink-muted',
            )}
            style={{
              height: `${thumbHeight}%`,
              top: `${thumbTop}%`,
              width: isHovered || isDragging ? '3px' : '1px',
              right: isHovered || isDragging ? '-1px' : '0',
            }}
            onPointerDown={handleThumbPointerDown}
          />

          {flatTOC.map((item, i) => {
            const el = containerRef.current;
            const maxScroll = el ? Math.max(1, el.scrollHeight - el.clientHeight) : 1;
            const headingEl = el?.querySelector(`#${CSS.escape(item.id)}`) as HTMLElement | null;
            const headingPct = headingEl
              ? headingEl.offsetTop / maxScroll
              : i / Math.max(1, flatTOC.length - 1);
            const markerTop = headingPct * 100;
            const isItemActive = activeId === item.id;
            return (
              <div
                key={item.id}
                className={cn(
                  'absolute right-0 h-1 w-1 -translate-y-1/2 rounded-full transition-all duration-200',
                  isItemActive
                    ? 'bg-primary'
                    : progress > headingPct
                      ? 'bg-ink-faint/50'
                      : 'bg-hairline',
                )}
                style={{ top: `${markerTop}%` }}
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(item.id);
                }}
                role="button"
                aria-label={`Go to ${item.text}`}
                tabIndex={-1}
              />
            );
          })}
        </div>

        <div
          className={cn(
            'flex-1 overflow-y-auto pr-4 transition-all duration-300',
            !isHovered && 'opacity-0',
          )}
        >
          {toc.map((item) => (
            <RailSection key={item.id} item={item} activeId={activeId} onNavigate={onNavigate} />
          ))}

          {toc.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-[12px] text-ink-faint">No headings found</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pt-3">
        <div className="h-px w-full bg-hairline" />
        <div className="mt-2 flex items-center justify-between text-[10px] text-ink-faint/60">
          <span>{Math.round(progress * 100)}%</span>
          <span>{Math.round((1 - progress) * 100)}% left</span>
        </div>
      </div>
    </nav>
  );
}
