import { useState, useCallback } from 'react';
import { useIsBreakpoint } from '@/hooks/use-is-breakpoint';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { List } from 'lucide-react';
import { NavigationRail } from './NavigationRail/NavigationRail';
import { useActiveSection } from './NavigationRail/useActiveSection';
import { useReadingProgress } from './ReadingProgress/useReadingProgress';
import { ReadingProgress } from './ReadingProgress/ReadingProgress';
import type { ParsedDocument } from './renderers/MarkdownRenderer';

interface ReaderShellProps {
  children: React.ReactNode;
  documentRef: React.RefObject<HTMLDivElement | null>;
  parsed: ParsedDocument | null;
  readingTimeMinutes?: number;
}

export function ReaderShell({
  children,
  documentRef,
  parsed,
  readingTimeMinutes,
}: ReaderShellProps) {
  const { progress: scrollProgress } = useReadingProgress(documentRef);
  const headingIds = parsed?.headingIds ?? [];
  const { activeId } = useActiveSection(documentRef, headingIds);
  const isMobile = useIsBreakpoint('max', 768);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleNavigate = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
      window.history.replaceState(null, '', `#${id}`);
    }
    setSheetOpen(false);
  }, []);

  const headings = (parsed?.toc ?? []).flatMap((item) => {
    const result: { id: string; text: string; level: number }[] = [item];
    function walk(children: typeof item.children) {
      for (const c of children) {
        result.push(c);
        walk(c.children);
      }
    }
    walk(item.children);
    return result;
  });

  const rail = parsed?.toc ? (
    <NavigationRail
      toc={parsed.toc}
      activeId={activeId}
      progress={scrollProgress}
      containerRef={documentRef}
      onNavigate={handleNavigate}
      readingTime={readingTimeMinutes ?? 0}
    />
  ) : null;

  return (
    <div className="reader-shell flex h-screen w-full bg-canvas-soft">
      <div className="flex flex-1 flex-col overflow-hidden">{children}</div>

      {isMobile ? (
        <>
          <div
            className="fixed bottom-0 left-0 right-0 z-40 h-0.5 bg-hairline"
            role="progressbar"
            aria-valuenow={Math.round(scrollProgress * 100)}
            aria-label="Reading progress"
          >
            <div
              className="h-full bg-primary transition-[width] duration-100 ease-out"
              style={{ width: `${scrollProgress * 100}%` }}
            />
          </div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-level-2 border border-hairline text-ink-muted hover:text-ink transition-colors"
                aria-label="Table of contents"
              >
                <List className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[60vh] p-0 pt-2">
              {rail}
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <ReadingProgress
          containerRef={documentRef}
          headingIds={parsed?.headingIds ?? []}
          headings={headings}
        />
      )}
    </div>
  );
}
