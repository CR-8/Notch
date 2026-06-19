import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[16px] font-medium leading-[1.5] transition-[background,box-shadow,transform] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary CTA — the single blue action, fully pill-shaped.
        default: "rounded-full bg-primary text-primary-foreground active:bg-primary-active",
        // Destructive action — keep pill, red fill.
        destructive:
          "rounded-full bg-destructive text-destructive-foreground",
        // Utility button — 8px radius, hairline border, white surface.
        outline:
          "rounded-md border border-[var(--color-hairline)] bg-surface text-[var(--color-ink)] hover:border-primary hover:bg-[var(--color-surface-hover)]",
        // Secondary CTA — white pill carried by the soft Level-1 shadow.
        secondary:
          "rounded-full bg-surface text-[var(--color-ink)] shadow-level-1 hover:shadow-level-2",
        ghost: "text-[var(--color-ink)] hover:bg-[var(--color-surface-hover)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-6 py-2.5",
        sm: "rounded-md px-3 py-1.5 text-[14px]",
        lg: "px-8 py-3",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
