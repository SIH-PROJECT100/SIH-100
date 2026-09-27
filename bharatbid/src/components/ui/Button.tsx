import React, { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  isLoading?: boolean
  loadingText?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-navy-900 text-cream-50 hover:bg-navy-800 active:bg-navy-950 shadow-sm border border-transparent dark:bg-saffron-500 dark:text-navy-950 dark:hover:bg-saffron-400 dark:active:bg-saffron-600 font-semibold',
  secondary:
    'bg-paper text-ink-900 border border-line hover:bg-cream-100 hover:border-ink-300 active:bg-cream-50 shadow-sm dark:bg-navy-900 dark:text-cream-50 dark:border-navy-700 dark:hover:bg-navy-800 dark:hover:border-navy-600',
  tertiary:
    'bg-transparent text-ink-700 hover:bg-cream-100 hover:text-ink-900 border border-transparent dark:text-cream-300 dark:hover:bg-navy-800 dark:hover:text-cream-50',
  destructive:
    'bg-risk-critical text-cream-50 hover:bg-risk-critical/90 active:bg-risk-critical/80 shadow-sm border border-transparent dark:bg-red-600 dark:text-white dark:hover:bg-red-500',
}

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-small min-h-[32px] gap-1.5',
  md: 'px-4 py-2 text-small min-h-[40px] gap-2',
  lg: 'px-5 py-2.5 text-body min-h-[48px] gap-2.5',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium rounded-md transition-colors duration-fast ease-ease select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 focus-visible:ring-offset-1',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-current" aria-hidden="true" />
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="inline-flex shrink-0 items-center">{rightIcon}</span>}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'
