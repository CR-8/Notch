import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/utils';
import type { GenerationMode } from '@/lib/types';
import { MODES, modeMeta } from './data';

export function ModeSelector({
  mode,
  onModeChange,
}: {
  mode: GenerationMode;
  onModeChange: (m: GenerationMode) => void;
}) {
  const active = modeMeta(mode);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">
          Processing mode
        </span>
      </div>

      {/* Segmented control with a shared-layout sliding highlight. */}
      <div className="relative flex p-1 rounded-xl bg-soft-cloud">
        {MODES.map((m) => {
          const selected = m.mode === mode;
          return (
            <button
              key={m.mode}
              onClick={() => onModeChange(m.mode)}
              className="relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg z-10 transition-colors"
            >
              {selected && (
                <motion.span
                  layoutId="mode-pill"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  className="absolute inset-0 rounded-lg bg-surface shadow-level-1"
                />
              )}
              <span className="relative text-[13px] leading-none">{m.glyph}</span>
              <span
                className={cn(
                  'relative text-[12.5px] font-medium transition-colors',
                  selected ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explanation of the selected mode — animated so switching feels alive. */}
      <div className="rounded-xl bg-surface border border-hairline px-3.5 py-3 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.mode}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-medium text-ink">{active.tagline}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted tabular-nums">
                <span className="w-1 h-1 rounded-full bg-accent-green" />
                {active.estTime}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
              {active.features.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted"
                >
                  <span className="text-accent-green text-[10px] leading-none">✓</span>
                  {f}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
