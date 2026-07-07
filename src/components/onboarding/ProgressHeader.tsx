import { motion } from 'motion/react';
import { Onboarding } from '@/components/ui/onboarding';

const STEP_LABELS = [
  'Welcome',
  'Capabilities',
  'Workflow',
  'Privacy',
  'Capture',
  'Processing',
  'Ready',
];

export function ProgressHeader() {
  return (
    <Onboarding.StepIndicator
      variant="pills"
      className="w-full max-w-lg mx-auto"
      dotClassName="h-1"
    />
  );
}

export function StepLabel({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <motion.span
        key={currentStep}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-[11px] font-medium text-ink-faint"
      >
        {currentStep}. {STEP_LABELS[currentStep - 1] || ''}
      </motion.span>
    </div>
  );
}
