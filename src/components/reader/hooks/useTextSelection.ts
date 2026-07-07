import { useState, useEffect, useCallback, useRef } from 'react';

export interface SelectionState {
  text: string;
  /** Anchor rect (viewport coords) for positioning the floating toolbar. */
  rect: { top: number; bottom: number; left: number; right: number; width: number } | null;
}

const EMPTY: SelectionState = { text: '', rect: null };

/**
 * Tracks the current text selection *inside* a container element and exposes an
 * anchor rectangle for floating UI. Debounced to selection-settle so the toolbar
 * does not flicker mid-drag, and dismissed on scroll/collapse.
 */
export function useTextSelection(
  containerRef: React.RefObject<HTMLElement | null>,
  enabled = true,
): { selection: SelectionState; clear: () => void } {
  const [selection, setSelection] = useState<SelectionState>(EMPTY);
  const settleTimer = useRef<number | undefined>(undefined);

  const clear = useCallback(() => {
    setSelection(EMPTY);
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) sel.removeAllRanges();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const evaluate = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(EMPTY);
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 2) {
        setSelection(EMPTY);
        return;
      }
      const range = sel.getRangeAt(0);
      // Only surface the toolbar for selections that live inside the reader.
      if (!container.contains(range.commonAncestorContainer)) {
        setSelection(EMPTY);
        return;
      }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setSelection(EMPTY);
        return;
      }
      setSelection({
        text,
        rect: {
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          right: rect.right,
          width: rect.width,
        },
      });
    };

    const onSelectionChange = () => {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(evaluate, 120);
    };

    const onScroll = () => setSelection(EMPTY);

    document.addEventListener('selectionchange', onSelectionChange);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.clearTimeout(settleTimer.current);
      document.removeEventListener('selectionchange', onSelectionChange);
      container.removeEventListener('scroll', onScroll);
    };
  }, [containerRef, enabled]);

  return { selection, clear };
}
