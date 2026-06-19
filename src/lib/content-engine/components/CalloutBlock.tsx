import type { CalloutElement, CalloutKind } from '../types';

interface CalloutBlockProps {
  data: CalloutElement;
}

const CALLOUT_STYLES: Record<CalloutKind, { icon: string; bg: string; border: string; text: string }> = {
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
    bg: 'bg-[#1aae39]/5',
    border: 'border-[#1aae39]/30',
    text: 'text-[#1aae39]',
  },
  danger: {
    icon: '✖',
    bg: 'bg-[#be5b50]/5',
    border: 'border-[#be5b50]/30',
    text: 'text-[#be5b50]',
  },
  info: {
    icon: 'i',
    bg: 'bg-[#62aef0]/5',
    border: 'border-[#62aef0]/30',
    text: 'text-[#62aef0]',
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
        <div className="text-[14px] text-[var(--color-ink)] leading-relaxed [&_p]:my-1 [&_a]:text-[var(--color-primary)] [&_code]:text-[12px] [&_code]:bg-[var(--color-surface)] [&_code]:px-1 [&_code]:rounded">
          {data.content}
        </div>
      </div>
    </div>
  );
}
