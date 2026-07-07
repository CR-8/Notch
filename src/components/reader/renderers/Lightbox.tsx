import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

interface LightboxProps {
  open: boolean;
  onClose: () => void;
  label?: string;
  children: React.ReactNode;
}

/**
 * Full-screen magnifier for figures (diagrams, images). Click the backdrop or
 * press Escape to dismiss. Tall content (e.g. long timeline diagrams) scrolls
 * inside the panel rather than overflowing the viewport.
 */
export function Lightbox({ open, onClose, label, children }: LightboxProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={label ?? 'Enlarged figure'}
        >
          <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" aria-hidden />

          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="reader-lightbox relative max-h-[90vh] max-w-[95vw] overflow-auto rounded-2xl bg-canvas p-4 shadow-level-2"
          >
            {children}
          </motion.div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close"
            className="fixed right-5 top-5 z-[61] flex h-9 w-9 items-center justify-center rounded-full bg-surface/90 text-[20px] leading-none text-ink-muted shadow-level-1 backdrop-blur-md transition-colors hover:text-ink"
          >
            ×
          </button>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
