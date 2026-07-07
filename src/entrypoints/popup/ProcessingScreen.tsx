import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { PROCESSING_STEPS, stepForPct } from './data';

function Spinner() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
      className="block w-3.5 h-3.5 rounded-full border-2 border-primary/25 border-t-primary"
    />
  );
}

function StepRow({ label, status }: { label: string; status: 'done' | 'active' | 'pending' }) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: status === 'pending' ? 0.45 : 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      className="flex items-center gap-3"
    >
      <span className="w-5 h-5 grid place-items-center shrink-0">
        {status === 'done' ? (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 24 }}
            className="w-5 h-5 rounded-full bg-accent-green/15 grid place-items-center text-accent-green text-[11px] font-bold"
          >
            ✓
          </motion.span>
        ) : status === 'active' ? (
          <Spinner />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-ink-faint" />
        )}
      </span>
      <span
        className={cn(
          'text-[13px] transition-colors',
          status === 'active' ? 'text-ink font-medium' : 'text-ink-muted',
        )}
      >
        {label}
      </span>
    </motion.li>
  );
}

export function ProcessingScreen({
  state,
  progress,
  domain,
  errorMsg,
  onOpen,
  onReset,
  onRetry,
}: {
  state: 'loading' | 'success' | 'error';
  progress: { step: string; pct: number };
  domain: string;
  errorMsg?: string;
  onOpen: () => void;
  onReset: () => void;
  onRetry: () => void;
}) {
  if (state === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center text-center px-6 py-10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 18 }}
          className="w-16 h-16 rounded-full bg-accent-green/15 grid place-items-center text-accent-green text-[30px]"
        >
          ✓
        </motion.div>
        <h2 className="text-[18px] font-semibold text-ink mt-4 tracking-tight">Captured</h2>
        <p className="text-[12.5px] text-ink-muted mt-1">
          Your knowledge document is ready to read.
        </p>
        <div className="flex flex-col gap-2 w-full mt-6">
          <button
            onClick={onOpen}
            className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-[14px] font-medium transition-transform active:scale-[0.97] hover:bg-primary-active"
          >
            Open in reader
          </button>
          <button
            onClick={onReset}
            className="w-full py-2 text-[12.5px] font-medium text-ink-muted hover:text-ink transition-colors"
          >
            Capture another
          </button>
        </div>
      </motion.div>
    );
  }

  if (state === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center text-center px-6 py-10"
      >
        <div className="w-16 h-16 rounded-full bg-destructive/12 grid place-items-center text-destructive text-[26px]">
          !
        </div>
        <h2 className="text-[18px] font-semibold text-ink mt-4 tracking-tight">
          Capture didn’t finish
        </h2>
        <p className="text-[12px] text-ink-muted mt-1.5 leading-snug max-w-[280px]">
          {errorMsg?.slice(0, 160) ?? 'Something went wrong. Please try again.'}
        </p>
        <div className="flex flex-col gap-2 w-full mt-6">
          <button
            onClick={onRetry}
            className="w-full py-2.5 rounded-full bg-primary text-primary-foreground text-[14px] font-medium transition-transform active:scale-[0.97] hover:bg-primary-active"
          >
            Try again
          </button>
          <button
            onClick={onReset}
            className="w-full py-2 text-[12.5px] font-medium text-ink-muted hover:text-ink transition-colors"
          >
            Back
          </button>
        </div>
      </motion.div>
    );
  }

  const activeIndex = stepForPct(progress.pct);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-6 py-8">
      <div className="text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Working</p>
        <h2 className="text-[19px] font-semibold text-ink mt-1.5 tracking-tight">
          Understanding this page
        </h2>
        <p className="text-[12px] text-ink-muted mt-1 truncate">{domain}</p>
      </div>

      <ol className="flex flex-col gap-3.5 mt-7 mb-7 pl-1">
        {PROCESSING_STEPS.map((label, i) => (
          <StepRow
            key={label}
            label={label}
            status={i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending'}
          />
        ))}
      </ol>

      <div className="h-1.5 rounded-full bg-soft-cloud overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${Math.max(4, progress.pct)}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 24 }}
        />
      </div>
      <p className="text-[11px] text-ink-muted mt-2 text-center truncate">
        {progress.step || 'Reading the page'}
      </p>
    </motion.div>
  );
}
