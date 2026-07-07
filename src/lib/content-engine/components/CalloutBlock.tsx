import { marked } from 'marked';
import { sanitizeHtml } from '@/lib/sanitize';
import { renderMath } from '@/lib/markdown/math';
import type { CalloutElement, CalloutKind } from '../types';

interface CalloutBlockProps {
  data: CalloutElement;
}

const CALLOUT_STYLES: Record<
  CalloutKind,
  { icon: string; bg: string; border: string; text: string }
> = {
  note: {
    icon: 'ℹ',
    bg: 'bg-[var(--color-primary)]/5',
    border: 'border-[var(--color-primary)]/30',
    text: 'text-[var(--color-primary)]',
  },
  warning: {
    icon: '⚠',
    bg: 'bg-[#dd5b00]/5',
    border: 'border-[#dd5b00]/30',
    text: 'text-[#dd5b00]',
  },
  tip: {
    icon: '💡',
    bg: 'bg-[var(--color-success)]/5',
    border: 'border-[var(--color-success)]/30',
    text: 'text-[var(--color-success)]',
  },
  danger: {
    icon: '✖',
    bg: 'bg-[var(--color-sale)]/5',
    border: 'border-[var(--color-sale)]/30',
    text: 'text-[var(--color-sale)]',
  },
  info: {
    icon: 'i',
    bg: 'bg-[var(--color-info)]/5',
    border: 'border-[var(--color-info)]/30',
    text: 'text-[var(--color-info)]',
  },
  important: {
    icon: '❗',
    bg: 'bg-[#e11d48]/5',
    border: 'border-[#e11d48]/30',
    text: 'text-[#e11d48]',
  },
  caution: {
    icon: '🚧',
    bg: 'bg-[#f59e0b]/5',
    border: 'border-[#f59e0b]/30',
    text: 'text-[#f59e0b]',
  },
  success: {
    icon: '✅',
    bg: 'bg-[#22c55e]/5',
    border: 'border-[#22c55e]/30',
    text: 'text-[#22c55e]',
  },
  question: {
    icon: '❓',
    bg: 'bg-[#8b5cf6]/5',
    border: 'border-[#8b5cf6]/30',
    text: 'text-[#8b5cf6]',
  },
};

export function CalloutBlock({ data }: CalloutBlockProps) {
  const styles = CALLOUT_STYLES[data.kind] ?? CALLOUT_STYLES.note;

  return (
    <div
      className={`my-4 rounded-lg border ${styles.border} ${styles.bg} p-4 flex gap-3`}
      data-callout-kind={data.kind}
    >
      <span className={`text-[16px] font-bold leading-none mt-0.5 shrink-0 ${styles.text}`}>
        {styles.icon}
      </span>
      <div className="flex-1 min-w-0">
        {data.title && (
          <p className={`text-[13px] font-semibold mb-1 uppercase tracking-wide ${styles.text}`}>
            {data.title}
          </p>
        )}
        <div
          className="text-[14px] text-[var(--color-ink)] leading-relaxed [&_p]:my-1 [&_a]:text-[var(--color-primary)] [&_code]:text-[12px] [&_code]:bg-[var(--color-surface)] [&_code]:px-1 [&_code]:rounded [&_strong]:font-semibold [&_em]:italic"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(marked.parse(renderMath(data.content), { async: false })),
          }}
        />
      </div>
    </div>
  );
}
