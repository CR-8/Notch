import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { LucideProvider } from 'lucide-react';
import { useIsBreakpoint } from '@/hooks/use-is-breakpoint';
import { openSettings } from '@/lib/navigation';
import { saveHighlight, getHighlightsByDocument, deleteHighlight } from '@/lib/idb';
import type { Document, DocumentHighlight, AppearanceSettings } from '@/lib/types';
import { ReaderDocument } from './ReaderDocument';
import { ReaderHeader } from './ReaderHeader';
import { ReaderSidebar } from './sidebar/ReaderSidebar';
import { UtilityPanel } from './panel/UtilityPanel';
import { ProgressDock } from './progress/ProgressDock';
import { SelectionToolbar } from './selection/SelectionToolbar';
import { SearchOverlay } from './search/SearchOverlay';
import { useReadingProgress } from './ReadingProgress/useReadingProgress';
import { useActiveSection } from './NavigationRail/useActiveSection';
import { useReadingStats } from './hooks/useReadingStats';
import { useTextSelection } from './hooks/useTextSelection';
import { useFullscreen } from './hooks/useFullscreen';
import { useReaderShortcuts } from './hooks/useReaderShortcuts';
import type { ParsedDocument } from './renderers/MarkdownRenderer';

interface ReaderLayoutProps {
  doc: Document;
  parsed: ParsedDocument | null;
  appearance: AppearanceSettings;
  aiReady: boolean;
  folderName?: string;
  folderColor?: string;
  onToggleTheme: () => void;
  onExport: () => void;
  onCopy: () => void;
  children: React.ReactNode;
}

/** Smooth-scroll a heading into view within the reader scroll container. */
function scrollToId(container: HTMLElement | null, id: string) {
  if (!container) return;
  if (!id) {
    container.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const el = container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
}

/** Find the first text run matching a snippet and reveal it with a brief flash. */
function scrollToText(container: HTMLElement | null, text: string) {
  if (!container || !text) return;
  const needle = text.slice(0, 48).toLowerCase();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node.textContent && node.textContent.toLowerCase().includes(needle)) {
      const parent = node.parentElement;
      if (parent) {
        parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
        parent.classList.add('reader-flash');
        window.setTimeout(() => parent.classList.remove('reader-flash'), 1400);
      }
      return;
    }
  }
}

export function ReaderLayout({
  doc,
  parsed,
  appearance,
  aiReady,
  folderName,
  folderColor,
  onToggleTheme,
  onExport,
  onCopy,
  children,
}: ReaderLayoutProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const isCompact = useIsBreakpoint('max', 1024);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlights, setHighlights] = useState<DocumentHighlight[]>([]);
  const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreen(rootRef);
  const immersive = isFullscreen;

  // Sync the rails to the available width: this effect only runs when the
  // breakpoint actually crosses 1024px (deps: [isCompact]), collapsing the rails
  // on narrow viewports and restoring them on wide ones.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional viewport→UI sync
    setSidebarOpen(!isCompact);
    setPanelOpen(!isCompact);
  }, [isCompact]);

  const { progress } = useReadingProgress(documentRef);
  const headingIds = useMemo(() => parsed?.headingIds ?? [], [parsed?.headingIds]);
  const { activeId } = useActiveSection(documentRef, headingIds);
  const stats = useReadingStats(progress, doc.wordCount ?? 0);
  const { selection, clear: clearSelection } = useTextSelection(documentRef, !searchOpen);

  useEffect(() => {
    let alive = true;
    void getHighlightsByDocument(doc.id).then((h) => {
      if (alive) setHighlights(h);
    });
    return () => {
      alive = false;
    };
  }, [doc.id]);

  const chapters = useMemo(
    () => (parsed?.toc ?? []).map((t) => ({ id: t.id, text: t.text })),
    [parsed?.toc],
  );

  const navigate = useCallback((id: string) => scrollToId(documentRef.current, id), []);

  const addHighlight = useCallback(
    async (text: string) => {
      const h: DocumentHighlight = {
        id: crypto.randomUUID(),
        documentId: doc.id,
        text,
        paragraphIndex: 0,
        createdAt: new Date().toISOString(),
      };
      await saveHighlight(h);
      setHighlights((prev) => [h, ...prev]);
    },
    [doc.id],
  );

  const removeHighlight = useCallback(async (id: string) => {
    await deleteHighlight(id);
    setHighlights((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const handleEscape = useCallback(() => {
    if (searchOpen) setSearchOpen(false);
    else if (selection.rect) clearSelection();
    else if (isFullscreen) void exitFullscreen();
  }, [searchOpen, selection.rect, clearSelection, isFullscreen, exitFullscreen]);

  const shortcutHandlers = useMemo(
    () => ({
      onSearch: () => setSearchOpen(true),
      onEscape: handleEscape,
      onToggleFullscreen: toggleFullscreen,
      onToggleSidebar: () => setSidebarOpen((v) => !v),
      onTogglePanel: () => setPanelOpen((v) => !v),
      onNextSection: () => {
        const ids = headingIds;
        const i = ids.indexOf(activeId ?? '');
        if (i < ids.length - 1) navigate(ids[i + 1]);
      },
      onPrevSection: () => {
        const ids = headingIds;
        const i = ids.indexOf(activeId ?? '');
        if (i > 0) navigate(ids[i - 1]);
      },
    }),
    [handleEscape, toggleFullscreen, headingIds, activeId, navigate],
  );
  useReaderShortcuts(shortcutHandlers);

  const showSidebarOverlay = isCompact && sidebarOpen;
  const showPanelOverlay = isCompact && panelOpen;

  return (
    <MotionConfig reducedMotion="user">
      <LucideProvider strokeWidth={1.75}>
        <div
          ref={rootRef}
          className="reader-root relative flex h-screen w-full overflow-hidden bg-canvas-soft"
        >
          {!immersive && (
            <ReaderSidebar
              open={sidebarOpen}
              overlay={isCompact}
              currentDocId={doc.id}
              onOpenSearch={() => setSearchOpen(true)}
            />
          )}

          <main className="relative flex min-w-0 flex-1 flex-col">
            <ReaderHeader
              title={doc.title}
              folderName={folderName}
              folderColor={folderColor}
              appearance={appearance}
              aiReady={aiReady}
              sidebarOpen={sidebarOpen}
              panelOpen={panelOpen}
              isFullscreen={isFullscreen}
              immersive={immersive}
              onToggleSidebar={() => setSidebarOpen((v) => !v)}
              onTogglePanel={() => setPanelOpen((v) => !v)}
              onToggleTheme={onToggleTheme}
              onOpenSearch={() => setSearchOpen(true)}
              onToggleFullscreen={toggleFullscreen}
              onExport={onExport}
              onCopy={onCopy}
              onOpenSettings={() => void openSettings()}
            />

            <ReaderDocument ref={documentRef} doc={doc} className="reader-scroll pt-16">
              {children}
            </ReaderDocument>

            <ProgressDock
              containerRef={documentRef}
              progress={progress}
              chapters={chapters}
              activeId={activeId}
              stats={stats}
              onSeek={(pct) => {
                const el = documentRef.current;
                if (el) {
                  const max = Math.max(1, el.scrollHeight - el.clientHeight);
                  el.scrollTo({ top: max * pct, behavior: 'auto' });
                }
              }}
              onNavigate={navigate}
            />

            {selection.rect && (
              <SelectionToolbar
                selection={selection}
                documentId={doc.id}
                onHighlight={addHighlight}
                onDismiss={clearSelection}
              />
            )}
          </main>

          {!immersive && (
            <UtilityPanel
              open={panelOpen}
              overlay={isCompact}
              toc={parsed?.toc ?? []}
              activeId={activeId}
              progress={progress}
              stats={stats}
              totalWords={doc.wordCount ?? 0}
              readingTimeMinutes={
                doc.readingTimeMinutes ?? Math.max(1, Math.round((doc.wordCount ?? 0) / 220))
              }
              sectionCount={headingIds.length}
              highlights={highlights}
              onNavigate={navigate}
              onJumpHighlight={(h) => scrollToText(documentRef.current, h.text)}
              onDeleteHighlight={(id) => void removeHighlight(id)}
            />
          )}

          {/* Scrim behind mobile drawers */}
          <AnimatePresence>
            {(showSidebarOverlay || showPanelOverlay) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 bg-ink/30 backdrop-blur-[2px]"
                onClick={() => {
                  setSidebarOpen(false);
                  setPanelOpen(false);
                }}
              />
            )}
          </AnimatePresence>

          <SearchOverlay
            open={searchOpen}
            blocks={parsed?.blocks ?? []}
            onClose={() => setSearchOpen(false)}
            onNavigate={navigate}
          />
        </div>
      </LucideProvider>
    </MotionConfig>
  );
}
