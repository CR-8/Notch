import { useState, useEffect, useRef, useCallback } from 'react';

export interface ScrollProgress {
  progress: number;
  scrollTop: number;
  maxScroll: number;
}

export function useScrollProgress(containerRef: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState<ScrollProgress>({
    progress: 0,
    scrollTop: 0,
    maxScroll: 0,
  });

  const rafRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const el = containerRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = Math.max(1, scrollHeight - clientHeight);
      setProgress({
        progress: Math.min(1, scrollTop / maxScroll),
        scrollTop,
        maxScroll,
      });
    });
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef, handleScroll]);

  return progress;
}
