import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { browser } from 'wxt/browser';
import { cn } from '@/lib/utils';
import { getAppearance, deleteDocument } from '@/lib/storage';
import { applyAppearance, watchAppearance } from '@/lib/theme';
import { openSettings, libraryUrl } from '@/lib/navigation';
import { importNotchPDF } from '@/lib/import';
import type { GenerationMode } from '@/lib/types';
import { modeMeta } from './data';
import { usePageContext, useConnection, useCapture, useRecentTags } from './hooks';
import { PageCard } from './PageCard';
import { ModeSelector } from './ModeSelector';
import { TagInput } from './TagInput';
import { ProcessingScreen } from './ProcessingScreen';

// ── Header ───────────────────────────────────────────────────────────────────

function Header({
  providerLabel,
  hasKey,
  onConnect,
}: {
  providerLabel: string;
  hasKey: boolean;
  onConnect: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 h-14 bg-surface/80 backdrop-blur-[12px] backdrop-saturate-150 border-b border-hairline">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-ink grid place-items-center shrink-0">
          <span className="text-[13px] font-bold text-canvas leading-none">N</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[14px] font-semibold tracking-tight text-ink">Notch</span>
          <span className="text-ink-faint">/</span>
          <span className="text-[12.5px] text-ink-muted truncate">Personal</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={hasKey ? undefined : onConnect}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border transition-colors',
            hasKey
              ? 'border-hairline bg-surface cursor-default'
              : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10',
          )}
        >
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              hasKey ? 'bg-accent-green' : 'bg-destructive',
            )}
          />
          <span
            className={cn(
              'text-[11px] font-medium max-w-[92px] truncate',
              hasKey ? 'text-ink-muted' : 'text-destructive',
            )}
          >
            {hasKey ? providerLabel : 'Connect key'}
          </span>
        </button>
        <div className="w-7 h-7 rounded-full bg-soft-cloud border border-hairline grid place-items-center">
          <span className="text-[11px] font-semibold text-ink-faint">P</span>
        </div>
      </div>
    </header>
  );
}

// ── Primary + secondary actions ──────────────────────────────────────────────

function SecondaryTile({
  label,
  glyph,
  onClick,
  disabled,
  badge,
  busy,
}: {
  label: string;
  glyph: string;
  onClick?: () => void;
  disabled?: boolean;
  badge?: string;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        'relative flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border border-hairline bg-surface transition-all',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:border-ink-faint hover:shadow-level-1 active:scale-[0.97]',
      )}
    >
      {badge && (
        <span className="absolute top-1 right-1.5 text-[8px] font-semibold uppercase tracking-wide text-ink-faint">
          {badge}
        </span>
      )}
      <span className="text-[15px] leading-none">
        {busy ? (
          <motion.span
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }}
            className="block w-3.5 h-3.5 rounded-full border-2 border-ink-faint/30 border-t-ink-muted"
          />
        ) : (
          glyph
        )}
      </span>
      <span className="text-[11px] font-medium text-ink-muted">{busy ? 'Importing' : label}</span>
    </button>
  );
}

// ── Footer ───────────────────────────────────────────────────────────────────

function FooterLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[12px] font-medium text-ink-muted hover:text-ink transition-colors"
    >
      {label}
    </button>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function PopupApp() {
  const [mode, setMode] = useState<GenerationMode>('FAST');
  const [tags, setTags] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const page = usePageContext();
  const conn = useConnection();
  const recentTags = useRecentTags();
  const capture = useCapture(page.tabId, page.url);
  const active = modeMeta(mode);

  useEffect(() => {
    void getAppearance().then(applyAppearance);
    return watchAppearance(applyAppearance);
  }, []);

  // ⌘↵ / Ctrl+↵ captures the page from anywhere in the popup.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && capture.state === 'idle') {
        e.preventDefault();
        void capture.start({ mode, tags, captureMode: 'page' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [capture, mode, tags]);

  const openReader = (id?: string) => {
    const documentId = id ?? capture.documentId;
    if (!documentId) return;
    void browser.tabs.create({
      url: browser.runtime.getURL(`/reader.html?documentId=${documentId}`),
    });
  };

  const openLibrary = () => {
    browser.tabs.create({ url: libraryUrl() }).catch(() => {});
  };

  const handleUndo = () => {
    if (capture.documentId) void deleteDocument(capture.documentId);
    capture.reset();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const docId = await importNotchPDF(file);
      openReader(docId);
    } catch (err) {
      console.error('PDF import failed', err);
    } finally {
      setImporting(false);
    }
  };

  const isOverlay =
    capture.state === 'loading' || capture.state === 'success' || capture.state === 'error';

  return (
    <div className="w-[400px] bg-canvas-soft text-ink flex flex-col overflow-hidden">
      <Header
        providerLabel={conn.providerLabel}
        hasKey={conn.hasKey}
        onConnect={() => {
          void openSettings();
        }}
      />

      <AnimatePresence mode="wait" initial={false}>
        {isOverlay ? (
          <motion.div
            key="overlay"
            initial={{ opacity: 0, filter: 'blur(8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <ProcessingScreen
              state={capture.state as 'loading' | 'success' | 'error'}
              progress={capture.progress}
              domain={page.domain}
              errorMsg={capture.errorMsg}
              onOpen={() => openReader()}
              onReset={capture.state === 'success' ? handleUndo : capture.reset}
              onRetry={() => void capture.start({ mode, tags, captureMode: 'page' })}
            />
          </motion.div>
        ) : (
          <motion.div
            key="main"
            initial={{ opacity: 0, filter: 'blur(8px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex flex-col gap-4 px-4 pt-4 pb-3"
          >
            {capture.paywall === 'detected' && (
              <div className="flex items-start gap-2.5 rounded-xl border-l-2 border-l-accent-orange bg-accent-orange/8 pl-3 pr-2 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-semibold text-accent-orange">Paywall detected</p>
                  <p className="text-[10.5px] text-ink-muted leading-snug mt-0.5">
                    This page may have restricted content — the capture could be incomplete.
                  </p>
                </div>
                <button
                  onClick={capture.dismissPaywall}
                  className="text-ink-faint hover:text-ink leading-none shrink-0"
                >
                  &times;
                </button>
              </div>
            )}

            <PageCard page={page} captureState={capture.state} />
            <ModeSelector mode={mode} onModeChange={setMode} />
            <TagInput tags={tags} onTagsChange={setTags} recent={recentTags} />

            {/* Primary action */}
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => void capture.start({ mode, tags, captureMode: 'page' })}
              className="group relative w-full flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-left shadow-level-1 transition-colors hover:bg-primary-active"
            >
              <span className="w-9 h-9 rounded-xl bg-white/15 grid place-items-center text-[16px] shrink-0">
                {active.glyph}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-primary-foreground leading-tight">
                  Capture page
                </span>
                <span className="block text-[11.5px] text-primary-foreground/75 leading-tight mt-0.5">
                  {active.label} mode · {active.estTime}
                </span>
              </span>
              <span className="text-primary-foreground/60 text-[16px] transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </motion.button>

            {/* Secondary actions */}
            <div className="grid grid-cols-3 gap-2 -mt-1">
              <SecondaryTile
                label="Selection"
                glyph="⌟"
                onClick={() => void capture.start({ mode, tags, captureMode: 'selection' })}
              />
              <SecondaryTile label="Screenshot" glyph="◳" disabled badge="Soon" />
              <SecondaryTile
                label="Import PDF"
                glyph="↧"
                busy={importing}
                onClick={() => fileInputRef.current?.click()}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="flex items-center justify-between px-4 h-11 border-t border-hairline bg-surface/60 backdrop-blur-[12px]">
        <div className="flex items-center gap-4">
          <FooterLink
            label="Library"
            onClick={() => {
              void openLibrary();
            }}
          />
          <FooterLink
            label="Recent"
            onClick={() => {
              void openLibrary();
            }}
          />
          <FooterLink
            label="Settings"
            onClick={() => {
              void openSettings();
            }}
          />
        </div>
        <span className="inline-flex items-center gap-1 text-[10.5px] text-ink-faint">
          <kbd className="px-1 py-0.5 rounded bg-soft-cloud text-ink-muted font-sans text-[10px]">
            ⌘↵
          </kbd>
          capture
        </span>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => void handleImportFile(e)}
      />
    </div>
  );
}
