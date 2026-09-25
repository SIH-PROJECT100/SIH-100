import React, { forwardRef, useId } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id: explicitId,
      leftIcon,
      rightIcon,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = explicitId || generatedId
    const helperId = `${id}-helper`
    const errorId = `${id}-error`

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-small font-medium text-ink-700 flex items-center gap-1">
            {label}
            {required && <span className="text-risk-critical" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 text-ink-500 pointer-events-none flex items-center">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full rounded-md border bg-paper px-3 py-2 text-small text-ink-900 placeholder:text-ink-300 shadow-sm transition-colors duration-fast',
              'border-line hover:border-ink-300 focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500',
              'disabled:bg-cream-100 disabled:text-ink-500 disabled:cursor-not-allowed',
              error && 'border-risk-critical focus:border-risk-critical focus:ring-risk-critical',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3 text-ink-500 pointer-events-none flex items-center">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p id={errorId} className="text-micro text-risk-critical flex items-center gap-1 mt-0.5" role="alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-micro text-ink-500 mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'
