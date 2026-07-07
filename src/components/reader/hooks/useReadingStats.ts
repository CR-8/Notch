import { useEffect, useRef, useState } from 'react';

export interface ReadingStats {
  wordsRead: number;
  wordsLeft: number;
  minutesLeft: number;
  /** Effective words-per-minute derived from real time spent on the page. */
  wpm: number;
}

/**
 * Derives live reading statistics from scroll progress and total word count.
 * Reading speed is measured from actual elapsed time (only accumulated while the
 * tab is visible) rather than a fixed constant, so it reflects the reader.
 */
export function useReadingStats(
  progress: number,
  totalWords: number,
  baselineWpm = 220,
): ReadingStats {
  const elapsedMs = useRef(0);
  // eslint-disable-next-line react-hooks/purity
  const lastTick = useRef<number>(Date.now());
  const [, force] = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      if (document.visibilityState === 'visible') {
        elapsedMs.current += now - lastTick.current;
      }
      lastTick.current = now;
      force((n) => (n + 1) % 1_000_000);
    };
    const interval = window.setInterval(tick, 4000);
    const onVisible = () => {
      lastTick.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const clamped = Math.max(0, Math.min(1, progress));
  const wordsRead = Math.round(totalWords * clamped);
  const wordsLeft = Math.max(0, totalWords - wordsRead);

  const minutesElapsed = elapsedMs.current / 60000;
  const measuredWpm = minutesElapsed > 0.25 && wordsRead > 50 ? wordsRead / minutesElapsed : 0;
  const wpm = measuredWpm > 0 ? Math.round(measuredWpm) : baselineWpm;
  const minutesLeft = Math.ceil(wordsLeft / Math.max(120, wpm));

  return { wordsRead, wordsLeft, minutesLeft, wpm };
}
