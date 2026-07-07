import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useOnboarding } from '@/components/ui/onboarding';

export function NavigationFooter() {
  const { currentStep, totalSteps, canGoNext, canGoBack, handleBack, handleNext, handleComplete } =
    useOnboarding();

  const isLastStep = currentStep === totalSteps;

  return (
    <div className="flex items-center justify-between w-full max-w-lg mx-auto">
      <motion.button
        onClick={handleBack}
        disabled={!canGoBack}
        whileHover={canGoBack ? { x: -1 } : {}}
        whileTap={canGoBack ? { scale: 0.97 } : {}}
        className={`flex items-center gap-1 px-3.5 py-2 rounded-lg text-[12px] font-medium transition-all ${
          canGoBack
            ? 'text-ink-muted hover:text-ink border border-hairline bg-card hover:shadow-sm'
            : 'text-ink-faint/30 cursor-not-allowed border border-transparent'
        }`}
        aria-label="Previous step"
      >
        <ChevronLeft size={15} />
        Back
      </motion.button>

      <div className="flex items-center gap-2">
        {!isLastStep && (
          <motion.button
            onClick={handleComplete}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
            className="px-3 py-2 rounded-lg text-[11px] font-medium text-ink-faint hover:text-ink-muted border border-transparent hover:border-hairline transition-all"
            aria-label="Skip onboarding"
          >
            Skip
          </motion.button>
        )}

        {isLastStep ? (
          <motion.button
            onClick={handleComplete}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-[13px] shadow-sm shadow-primary/20 hover:bg-primary-active transition-all"
            aria-label="Complete onboarding"
          >
            Start using Notch
          </motion.button>
        ) : (
          <motion.button
            onClick={handleNext}
            disabled={!canGoNext}
            whileHover={canGoNext ? { scale: 1.01 } : {}}
            whileTap={canGoNext ? { scale: 0.98 } : {}}
            className={`flex items-center gap-1 px-4 py-2.5 rounded-lg font-semibold text-[13px] transition-all ${
              canGoNext
                ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary-active'
                : 'bg-hairline text-ink-faint cursor-not-allowed'
            }`}
            aria-label="Next step"
          >
            Continue
            <ChevronRight size={15} />
          </motion.button>
        )}
      </div>
    </div>
  );
}
