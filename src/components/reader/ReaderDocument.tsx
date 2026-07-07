import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import type { Document } from '@/lib/types';

interface ReaderDocumentProps {
  doc: Document;
  children: React.ReactNode;
  className?: string;
}

export const ReaderDocument = forwardRef<HTMLDivElement, ReaderDocumentProps>(
  function ReaderDocument({ doc, children, className }, ref) {
    return (
      <div
        ref={ref}
        id="reader-document"
        className={cn('flex-1 overflow-y-auto bg-canvas', className)}
        role="main"
        aria-label="Document content"
      >
        <article className="mx-auto max-w-[760px] px-6 py-10 lg:px-8 lg:py-12 xl:px-10 xl:py-14">
          <header className="mb-10">
            <h1 className="text-[32px] font-bold leading-[1.15] tracking-[-0.025em] text-ink">
              {doc.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-faint">
              {doc.domain && (
                <span className="flex items-center gap-1.5">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-[3px] bg-soft-cloud text-[9px] font-semibold uppercase text-ink-faint">
                    {doc.domain.charAt(0)}
                  </span>
                  {doc.domain}
                </span>
              )}
              <span>{doc.wordCount.toLocaleString()} words</span>
              <span>
                {doc.readingTimeMinutes ?? Math.max(1, Math.round((doc.wordCount ?? 0) / 220))} min
                read
              </span>
              {doc.capturedAt && (
                <time dateTime={doc.capturedAt}>
                  {new Date(doc.capturedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              )}
              {doc.documentType && (
                <span className="rounded-full bg-soft-cloud px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                  {doc.documentType}
                </span>
              )}
            </div>

            {doc.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {doc.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-soft-cloud px-2.5 py-0.5 text-[11px] font-medium text-ink-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 border-t border-hairline" />
          </header>

          <div>{children}</div>
        </article>
      </div>
    );
  },
);
