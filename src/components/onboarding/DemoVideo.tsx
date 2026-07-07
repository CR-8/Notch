import { useState, useEffect, useCallback, startTransition } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Search, Cpu, Layers, CircleCheck, Loader2 } from 'lucide-react';

interface DemoStage {
  id: string;
  label: string;
  icon: typeof Globe;
  duration: number;
}

const DEMO_STAGES: DemoStage[] = [
  { id: 'capturing', label: 'Capturing page content', icon: Globe, duration: 1200 },
  { id: 'extracting', label: 'Extracting text and structure', icon: Search, duration: 1000 },
  { id: 'processing', label: 'AI analysing content', icon: Cpu, duration: 1400 },
  { id: 'organising', label: 'Building knowledge graph', icon: Layers, duration: 1000 },
  { id: 'done', label: 'Capture complete', icon: CircleCheck, duration: 600 },
];

const WIKI_SNIPPET = `Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to the natural intelligence displayed by humans and animals. Leading AI textbooks define the field as the study of "intelligent agents": any system that perceives its environment and takes actions that maximize its chance of achieving its goals.`;

export function DemoVideo({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<'idle' | 'running' | 'done'>('idle');
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const startDemo = useCallback(() => {
    setStage('running');
    setActiveStep(0);
    setProgress(0);
  }, []);

  useEffect(() => {
    if (stage !== 'running') return;

    const step = DEMO_STAGES[activeStep];
    if (!step) {
      startTransition(() => setStage('done'));
      setTimeout(onComplete, 800);
      return;
    }

    const timer = setTimeout(() => {
      setActiveStep((p) => p + 1);
      setProgress((p) => p + 100 / DEMO_STAGES.length);
    }, step.duration);

    return () => clearTimeout(timer);
  }, [stage, activeStep, onComplete]);

  const currentIcon =
    DEMO_STAGES[Math.min(activeStep, DEMO_STAGES.length - 1)]?.icon || CircleCheck;
  const Icon = currentIcon;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <div className="text-center max-w-md">
        <h2 className="text-[26px] font-bold text-ink mb-2 tracking-[-0.02em]">
          See Notch in action
        </h2>
        <p className="text-[14px] text-ink-muted">
          Watch how Notch captures, analyses, and structures content automatically.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {stage === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md"
          >
            {/* Preview card - Wikipedia */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl border border-hairline bg-card overflow-hidden shadow-sm"
            >
              {/* Mock browser bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-hover border-b border-hairline">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-accent-orange/60" />
                  <div className="w-2.5 h-2.5 rounded-full text-primary" />
                </div>
                <div className="flex-1 flex items-center gap-2 px-3 py-1 rounded-md bg-card border border-hairline text-[11px] text-ink-faint truncate">
                  <Globe size={11} />
                  en.wikipedia.org/wiki/Artificial_intelligence
                </div>
              </div>

              {/* Mock page content */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center shrink-0">
                    <Globe size={19} className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] font-bold text-ink">Artificial intelligence</h3>
                    <p className="text-[11px] text-ink-faint">
                      Wikipedia &middot; 12,400 words &middot; 8 min read
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-surface-hover p-3">
                  <p className="text-[12px] text-ink-muted leading-relaxed line-clamp-4">
                    {WIKI_SNIPPET}
                  </p>
                </div>
                <motion.button
                  onClick={startDemo}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] shadow-sm shadow-primary/20 hover:bg-primary-active transition-all"
                >
                  Watch demo
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {stage === 'running' && (
          <motion.div
            key="running"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-md"
          >
            <div className="rounded-2xl border border-hairline bg-card p-6">
              {/* Animated icon */}
              <div className="flex justify-center mb-5">
                <motion.div
                  key={DEMO_STAGES[activeStep]?.id || 'done'}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-16 h-16 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center"
                >
                  {activeStep < DEMO_STAGES.length - 1 ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 size={26} className="text-primary" />
                    </motion.div>
                  ) : (
                    <Icon size={26} className="text-success" />
                  )}
                </motion.div>
              </div>

              {/* Progress stages */}
              <div className="space-y-1.5 mb-4">
                {DEMO_STAGES.map((s, i) => {
                  const isActive = i === activeStep;
                  const isDone = i < activeStep;
                  const StepIcon = s.icon;

                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{
                        opacity: isActive || isDone ? 1 : 0.3,
                        x: 0,
                      }}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                        isActive
                          ? 'border-primary/20 bg-primary/5'
                          : isDone
                            ? 'border-hairline bg-card'
                            : 'border-transparent'
                      }`}
                    >
                      <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                        {isDone ? (
                          <CircleCheck size={16} className="text-success" />
                        ) : isActive ? (
                          <Loader2 size={14} className="animate-spin text-primary" />
                        ) : (
                          <StepIcon size={14} className="text-ink-faint" />
                        )}
                      </div>
                      <span
                        className={`text-[13px] ${
                          isActive
                            ? 'font-semibold text-ink'
                            : isDone
                              ? 'text-ink-muted'
                              : 'text-ink-faint'
                        }`}
                      >
                        {s.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Progress */}
              <div className="w-full h-1 bg-hairline rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-[11px] text-ink-faint text-center mt-2">{Math.round(progress)}%</p>
            </div>
          </motion.div>
        )}

        {stage === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md text-center"
          >
            <div className="rounded-2xl border border-hairline bg-card p-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 180, damping: 14 }}
                className="w-16 h-16 rounded-2xl bg-success mx-auto mb-4 flex items-center justify-center shadow-sm shadow-success/20"
              >
                <CircleCheck size={28} className="text-white" />
              </motion.div>
              <h3 className="text-[17px] font-bold text-ink mb-1">Capture complete</h3>
              <p className="text-[13px] text-ink-muted mb-4">
                Notch extracted 24 concepts, 5 key points, and built a knowledge graph from this
                page.
              </p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { value: '1.2K', label: 'Words' },
                  { value: '24', label: 'Concepts' },
                  { value: '5', label: 'Key points' },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg bg-surface-hover p-2.5">
                    <p className="text-[17px] font-bold text-ink">{stat.value}</p>
                    <p className="text-[9px] text-ink-faint uppercase tracking-wider">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
              <motion.button
                onClick={onComplete}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] hover:bg-primary-active transition-all"
              >
                Continue
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
