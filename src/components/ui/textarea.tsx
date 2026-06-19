import * as React from "react"

import { cn } from "@/lib/utils"

// Notion text-input (multi-line): same chrome as the single-line field —
// white surface, 4px radius, body-sm, hairline border, soft Level-1 focus.
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-xs border border-[rgb(221,221,221)] bg-surface px-2 py-1.5 text-[15px] leading-[1.5] text-[var(--color-ink)] outline-none transition-shadow placeholder:text-[var(--color-ink-faint)] focus:border-primary focus:shadow-level-1 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
