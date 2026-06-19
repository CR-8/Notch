import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ActionWithClick = { label: string; onClick: () => void };
type ActionWithHref  = { label: string; href: string };

interface EmptyStateProps {
  message: string;
  action?: ActionWithClick | ActionWithHref;
  className?: string;
}

export function EmptyState({ message, action, className }: EmptyStateProps): ReactNode {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 p-8 text-center', className)}>
      <span className="text-[13px] font-medium text-[var(--color-ink-muted)]">
        {message}
      </span>
      {action && (
        'href' in action ? (
          <a
            href={action.href}
            className="inline-flex items-center text-[12px] font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-full px-4 py-1.5 hover:bg-[var(--color-primary)]/5 transition-all"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center text-[12px] font-medium text-[var(--color-primary)] border border-[var(--color-primary)] rounded-full px-4 py-1.5 hover:bg-[var(--color-primary)]/5 transition-all"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
