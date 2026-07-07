import { useEffect } from 'react';

export interface ReaderShortcutHandlers {
  onSearch?: () => void;
  onToggleFullscreen?: () => void;
  onEscape?: () => void;
  onToggleSidebar?: () => void;
  onTogglePanel?: () => void;
  onNextSection?: () => void;
  onPrevSection?: () => void;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

/**
 * Global reader keybindings. Bindings that would collide with normal text entry
 * are suppressed while an input/textarea is focused. Cmd/Ctrl+K and Escape are
 * always live because they drive the search overlay itself.
 */
export function useReaderShortcuts(handlers: ReaderShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Search — always available.
      if (mod && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        handlers.onSearch?.();
        return;
      }
      if (e.key === 'Escape') {
        handlers.onEscape?.();
        return;
      }

      if (isTypingTarget(e.target) || mod) return;

      switch (e.key) {
        case '/':
          e.preventDefault();
          handlers.onSearch?.();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          handlers.onToggleFullscreen?.();
          break;
        case '[':
          e.preventDefault();
          handlers.onToggleSidebar?.();
          break;
        case ']':
          e.preventDefault();
          handlers.onTogglePanel?.();
          break;
        case 'j':
        case 'ArrowDown':
          if (e.key === 'j') {
            e.preventDefault();
            handlers.onNextSection?.();
          }
          break;
        case 'k':
          e.preventDefault();
          handlers.onPrevSection?.();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handlers]);
}
