import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

function qs(el: HTMLElement, sel: string): HTMLElement | null {
  return el.querySelector(sel);
}

/* ── Public API ───────────────────────────────────────────────────────── */

export interface ReadingProgressAPI {
  progress: number;
  scrollTop: number;
  maxScroll: number;
  scrollToPercent: (pct: number) => void;
  scrollToHeading: (id: string) => void;
  scrollToNextHeading: () => void;
  scrollToPreviousHeading: () => void;
  registerHeading: (id: string, text: string, level: number) => void;
  unregisterHeading: (id: string) => void;
  headingPositions: HeadingPosition[];
}

export interface HeadingPosition {
  id: string;
  text: string;
  level: number;
  top: number;
  height: number;
}

/* ── Hook ─────────────────────────────────────────────────────────────── */

export function useReadingProgress(
  containerRef: React.RefObject<HTMLElement | null>,
): ReadingProgressAPI {
  const [scrollState, setScrollState] = useState({ progress: 0, scrollTop: 0, maxScroll: 0 });
  const rafRef = useRef(0);
  const headingsMap = useRef(new Map<string, HeadingPosition>());
  const [headingVersion, setHeadingVersion] = useState(0);

  /* ── Scroll tracking (passive + rAF) ──────────────────────────────────── */

  const handleScroll = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      const el = containerRef.current;
      if (!el) return;
      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = Math.max(1, scrollHeight - clientHeight);
      setScrollState({
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

  /* ── Heading position tracking ────────────────────────────────────────── */

  const updateHeadingPositions = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    for (const [, entry] of headingsMap.current) {
      const dom = qs(el, `#${CSS.escape(entry.id)}`);
      if (dom) {
        entry.top = dom.offsetTop;
        entry.height = dom.offsetHeight;
      }
    }
  }, [containerRef]);

  useEffect(() => {
    updateHeadingPositions();
    const ro = new ResizeObserver(() => updateHeadingPositions());
    const el = containerRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [updateHeadingPositions, containerRef]);

  const headingPositions = useMemo(
    () => Array.from(headingsMap.current.values()).sort((a, b) => a.top - b.top),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [headingVersion, scrollState.scrollTop],
  );

  /* ── Public API ───────────────────────────────────────────────────────── */

  const scrollToPercent = useCallback(
    (pct: number) => {
      const el = containerRef.current;
      if (!el) return;
      const maxScroll = Math.max(1, el.scrollHeight - el.clientHeight);
      el.scrollTo({ top: maxScroll * Math.max(0, Math.min(1, pct)), behavior: 'smooth' });
    },
    [containerRef],
  );

  const scrollToHeading = useCallback(
    (id: string) => {
      const el = containerRef.current;
      if (!el) return;
      const heading = qs(el, `#${CSS.escape(id)}`);
      if (heading) {
        heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    },
    [containerRef],
  );

  const scrollToNextHeading = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const scrollBottom = el.scrollTop + el.clientHeight + 50;
    for (const h of headingPositions) {
      if (h.top > scrollBottom) {
        scrollToHeading(h.id);
        return;
      }
    }
  }, [containerRef, headingPositions, scrollToHeading]);

  const scrollToPreviousHeading = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const scrollMid = el.scrollTop + 50;
    let prev = headingPositions.length > 0 ? headingPositions[0].id : null;
    for (const h of headingPositions) {
      if (h.top < scrollMid) prev = h.id;
      else break;
    }
    if (prev) scrollToHeading(prev);
  }, [containerRef, headingPositions, scrollToHeading]);

  const registerHeading = useCallback(
    (id: string, text: string, level: number) => {
      if (headingsMap.current.has(id)) return;
      const el = containerRef.current;
      const dom = el ? qs(el, `#${CSS.escape(id)}`) : null;
      headingsMap.current.set(id, {
        id,
        text,
        level,
        top: dom?.offsetTop ?? 0,
        height: dom?.offsetHeight ?? 0,
      });
      setHeadingVersion((v) => v + 1);
    },
    [containerRef],
  );

  const unregisterHeading = useCallback((id: string) => {
    headingsMap.current.delete(id);
  }, []);

  return {
    ...scrollState,
    scrollToPercent,
    scrollToHeading,
    scrollToNextHeading,
    scrollToPreviousHeading,
    registerHeading,
    unregisterHeading,
    headingPositions: headingPositions,
  };
}
