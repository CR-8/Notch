import { cn } from '@/lib/utils';
import type { CalloutKind } from '@/lib/content-engine/types';

interface CalloutRendererProps {
  kind: CalloutKind;
  content: string;
  title?: string;
}

/** Label + accent color per kind. No icons — a colored label and left accent
 * carry the identity (GitBook / Notion style), which also matches the project's
 * typography-first, icon-light direction. */
const META: Record<CalloutKind, { label: string; color: string }> = {
  note: { label: 'Note', color: 'var(--color-info)' },
  info: { label: 'Info', color: 'var(--color-info)' },
  tip: { label: 'Tip', color: 'var(--color-success)' },
  success: { label: 'Success', color: 'var(--color-success)' },
  warning: { label: 'Warning', color: '#c99a2e' },
  caution: { label: 'Caution', color: 'var(--color-accent-orange)' },
  danger: { label: 'Danger', color: 'var(--color-sale)' },
  important: { label: 'Important', color: 'var(--color-accent-purple)' },
  question: { label: 'Question', color: 'var(--color-accent-purple)' },
};

export function CalloutRenderer({ kind, content, title }: CalloutRendererProps) {
  const meta = META[kind] ?? META.note;

  return (
    <div
      className="reader-callout overflow-hidden rounded-xl border border-hairline"
      style={{
        background: `color-mix(in srgb, ${meta.color} 6%, transparent)`,
        borderLeft: `3px solid ${meta.color}`,
      }}
      data-callout-kind={kind}
      role="note"
    >
      <div className="px-4 py-3">
        <div
          className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
          style={{ color: meta.color }}
        >
          {title ? `${meta.label} · ${title}` : meta.label}
        </div>
        <div
          className={cn(
            'reader-callout-body text-[14px] leading-relaxed text-ink-secondary',
            '[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_a]:text-primary',
          )}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
}
