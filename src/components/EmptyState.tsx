import { cn } from '@/lib/utils';

type ActionWithClick = { label: string; onClick: () => void };
type ActionWithHref  = { label: string; href: string };

interface EmptyStateProps {
  message: string;
  action?: ActionWithClick | ActionWithHref;
  className?: string;
}

export function EmptyState({ message, action, className }: EmptyStateProps): JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 p-8 text-center', className)}>
      <span className="font-mono font-semibold text-xs uppercase tracking-wider text-muted">
        {message}
      </span>
      {action && (
        'href' in action ? (
          <a
            href={action.href}
            className="font-mono font-semibold text-[11px] uppercase tracking-wider text-primary border border-primary px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            {action.label}
          </a>
        ) : (
          <button
            onClick={action.onClick}
            className="font-mono font-semibold text-[11px] uppercase tracking-wider text-primary border border-primary px-3 py-1.5 hover:bg-primary/10 transition-colors"
          >
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
