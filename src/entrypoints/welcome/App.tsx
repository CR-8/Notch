import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { browser } from 'wxt/browser';
import { Layers } from 'lucide-react';

export default function WelcomeApp() {
  const [onboarded, setOnboarded] = useState(false);

  const handleComplete = () => setOnboarded(true);

  const openLibrary = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') }).catch(() => {});
  };

  const openReader = () => {
    browser.tabs.create({ url: browser.runtime.getURL('/reader.html') }).catch(() => {});
  };

  return (
    <AnimatePresence mode="wait">
      {onboarded ? (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="min-h-screen bg-canvas-soft text-ink flex items-center justify-center p-6 relative overflow-hidden"
        >
          <div
            className="fixed inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '32px 32px',
            }}
          />
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="relative z-10 max-w-md w-full text-center flex flex-col items-center gap-5"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 180, damping: 14, delay: 0.1 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20"
            >
              <Layers size={28} className="text-white" />
            </motion.div>

            <div className="space-y-1.5">
              <h1 className="text-[28px] font-bold text-ink tracking-[-0.025em] leading-tight">
                You're ready to use Notch
              </h1>
              <p className="text-[14px] text-ink-muted leading-relaxed">
                Your knowledge base is initialised. Open any webpage and capture it using the
                extension icon or keyboard shortcut.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
              <motion.button
                onClick={openLibrary}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] shadow-sm shadow-primary/20 hover:bg-primary-active transition-all"
              >
                Open library
              </motion.button>
              <motion.button
                onClick={openReader}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 py-3 rounded-xl border border-hairline bg-card text-ink font-medium text-[14px] hover:shadow-sm transition-all"
              >
                Open reader
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <OnboardingFlow onComplete={handleComplete} />
      )}
    </AnimatePresence>
  );
}
