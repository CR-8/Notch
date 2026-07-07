import { motion } from 'motion/react';
import { Layers, Sparkles, BrainCircuit } from 'lucide-react';

export function WelcomeHero() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] px-8">
      {/* Brand icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-8"
      >
        <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
          <Layers size={26} className="text-white" />
        </div>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-[36px] sm:text-[48px] font-bold leading-[1.08] tracking-[-0.03em] text-ink mb-4 text-center"
      >
        Your AI-powered
        <br />
        second brain
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="text-[15px] text-ink-muted leading-relaxed text-center max-w-md"
      >
        Notch captures what you read, structures it automatically, and builds a searchable knowledge
        base you can interrogate.
      </motion.p>

      {/* Feature preview chips */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-wrap justify-center gap-2 mt-8"
      >
        {[
          { icon: Sparkles, label: 'AI summaries' },
          { icon: BrainCircuit, label: 'Knowledge graph' },
          { icon: Layers, label: 'Smart collections' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline bg-card text-[12px] font-medium text-ink-muted"
            >
              <Icon size={13} />
              {item.label}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
