import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-[calc(var(--radius)-0.15rem)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_10px_24px_rgba(249,115,22,0.16)] hover:brightness-110',
        secondary:
          'border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-[color-mix(in_srgb,var(--secondary)_88%,transparent)] text-[var(--secondary-foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_92%,transparent)]',
        ghost:
          'text-[var(--muted-foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_72%,transparent)] hover:text-[var(--foreground)]',
        outline:
          'border border-[color-mix(in_srgb,var(--border)_90%,transparent)] bg-transparent text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--accent)_72%,transparent)]'
      },
      size: {
        default: 'h-8 px-3 py-1.5',
        sm: 'h-7 px-2.5 text-xs',
        icon: 'h-8 w-8'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
