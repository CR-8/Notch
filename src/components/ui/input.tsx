import * as React from 'react';

import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex w-full rounded-xs border border-[rgb(221,221,221)] bg-surface px-2 py-1.5 text-[15px] leading-[1.33] text-[var(--color-ink)] outline-none transition-shadow placeholder:text-[var(--color-ink-faint)] focus:border-primary focus:shadow-level-1 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
