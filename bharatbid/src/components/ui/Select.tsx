import React, { forwardRef, useId } from 'react'
import { AlertCircle, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  helperText?: string
  error?: string
  options?: SelectOption[]
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id: explicitId,
      required,
      disabled,
      options,
      children,
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
          <select
            ref={ref}
            id={id}
            required={required}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full appearance-none rounded-md border bg-paper px-3 py-2 pr-9 text-small text-ink-900 shadow-sm transition-colors duration-fast',
              'border-line hover:border-ink-300 focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500',
              'disabled:bg-cream-100 disabled:text-ink-500 disabled:cursor-not-allowed',
              error && 'border-risk-critical focus:border-risk-critical focus:ring-risk-critical',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <ChevronDown
            className="absolute right-3 w-4 h-4 text-ink-500 pointer-events-none"
            aria-hidden="true"
          />
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

Select.displayName = 'Select'
