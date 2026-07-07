import { useState, useEffect, useCallback } from 'react';

/**
 * Immersive fullscreen for the reader. Uses the native Fullscreen API where
 * available and always mirrors an internal "immersive" flag so the UI can hide
 * chrome even when the browser denies real fullscreen (some extension pages do).
 */
export function useFullscreen(target?: React.RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const enter = useCallback(async () => {
    const el = target?.current ?? document.documentElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen();
    } catch {
      /* fall back to internal immersive flag */
    }
    setIsFullscreen(true);
  }, [target]);

  const exit = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
    } catch {
      /* ignore */
    }
    setIsFullscreen(false);
  }, []);

  const toggle = useCallback(() => {
    if (isFullscreen) void exit();
    else void enter();
  }, [isFullscreen, enter, exit]);

  return { isFullscreen, enter, exit, toggle };
}
