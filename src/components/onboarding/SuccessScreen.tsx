import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Library, BookOpen, CircleCheck } from 'lucide-react';
import { browser } from 'wxt/browser';

export function SuccessScreen({
  captureInfo,
}: {
  captureInfo: { title: string; url: string } | null;
}) {
  const [confettiVisible, setConfettiVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setConfettiVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const confetti = useRef(
    Array.from({ length: 30 }).map((_, i) => ({
      key: i,
      color: ['#0a84ff', '#9065b0', '#30d158', '#ff9f40', '#ff6b6b'][i % 5],
      // eslint-disable-next-line react-hooks/purity
      initialX: `${40 + Math.random() * 20}%`,
      // eslint-disable-next-line react-hooks/purity
      initialY: `${20 + Math.random() * 20}%`,
      // eslint-disable-next-line react-hooks/purity
      initialScale: 0.4 + Math.random() * 0.6,
      // eslint-disable-next-line react-hooks/purity
      animateY: `${80 + Math.random() * 20}%`,
      // eslint-disable-next-line react-hooks/purity
      animateX: `${30 + Math.random() * 40}%`,
      // eslint-disable-next-line react-hooks/purity
      animateRotate: Math.random() * 720,
      // eslint-disable-next-line react-hooks/purity
      duration: 1.5 + Math.random() * 1.5,
    })),
  ).current;

  function openLibrary() {
    browser.tabs.create({ url: browser.runtime.getURL('/newtab.html') }).catch(() => {});
  }

  function openReader() {
    browser.tabs.create({ url: browser.runtime.getURL('/reader.html') }).catch(() => {});
  }

  return (
    <div className="relative flex flex-col items-center justify-center gap-6 py-4 min-h-[420px]">
      {/* Confetti particles */}
      {confettiVisible &&
        confetti.map((p) => (
          // eslint-disable-line react-hooks/refs
          <motion.div
            key={p.key}
            className="absolute w-1.5 h-1.5 rounded-sm"
            style={{ backgroundColor: p.color }}
            initial={{
              x: p.initialX,
              y: p.initialY,
              scale: p.initialScale,
              opacity: 1,
            }}
            animate={{
              y: p.animateY,
              x: p.animateX,
              rotate: p.animateRotate,
              opacity: 0,
            }}
            transition={{
              duration: p.duration,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          />
        ))}

      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 14 }}
        className="w-16 h-16 rounded-2xl bg-success flex items-center justify-center shadow-md shadow-success/20"
      >
        <CircleCheck size={30} className="text-white" />
      </motion.div>

      <div className="text-center max-w-md">
        <motion.h2
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-[28px] font-bold text-ink mb-2 tracking-[-0.025em]"
        >
          You're ready
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-[14px] text-ink-muted"
        >
          Notch is set up and ready to capture, structure, and organise your knowledge.
        </motion.p>
      </div>

      {captureInfo && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="w-full max-w-sm rounded-lg bg-surface-hover border border-hairline p-3 flex items-center gap-3"
        >
          <CircleCheck size={15} className="shrink-0 text-success" />
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ink truncate">{captureInfo.title}</p>
            <p className="text-[10px] text-ink-faint truncate">{captureInfo.url}</p>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="flex flex-col sm:flex-row gap-3 w-full max-w-sm"
      >
        <motion.button
          onClick={openLibrary}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-[14px] shadow-sm shadow-primary/20 hover:bg-primary-active transition-all"
        >
          <Library size={16} />
          Open library
        </motion.button>
        <motion.button
          onClick={openReader}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-hairline bg-card text-ink font-medium text-[14px] hover:shadow-sm transition-all"
        >
          <BookOpen size={16} />
          Open reader
        </motion.button>
      </motion.div>
    </div>
  );
}
