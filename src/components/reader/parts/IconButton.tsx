import { forwardRef } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  active?: boolean;
  shortcut?: string;
}

/**
 * The single interactive-chrome affordance used across every floating control
 * in the reader (header, panel, dock). Consistent 32px hit target, calm hover,
 * and a Radix tooltip that also announces the keybinding when there is one.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, tooltipSide = 'bottom', active, shortcut, className, children, ...props },
  ref,
) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          aria-pressed={active}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted',
            'transition-colors duration-150 outline-none',
            'hover:bg-surface-hover hover:text-ink',
            'focus-visible:ring-2 focus-visible:ring-primary/50',
            active && 'bg-surface-hover text-ink',
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side={tooltipSide} className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[10px] leading-none text-ink-muted">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
});
