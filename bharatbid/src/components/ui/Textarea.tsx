import React, { forwardRef, useId } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  helperText?: string
  error?: string
  showCharCount?: boolean
  maxLength?: number
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      id: explicitId,
      required,
      disabled,
      showCharCount,
      maxLength,
      value,
      defaultValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = explicitId || generatedId
    const helperId = `${id}-helper`
    const errorId = `${id}-error`

    const [currentLength, setCurrentLength] = React.useState<number>(() => {
      if (typeof value === 'string') return value.length
      if (typeof defaultValue === 'string') return defaultValue.length
      return 0
    })

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setCurrentLength(e.target.value.length)
      onChange?.(e)
    }

    return (
      <div className="w-full flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          {label && (
            <label htmlFor={id} className="text-small font-medium text-ink-700 flex items-center gap-1">
              {label}
              {required && <span className="text-risk-critical" aria-hidden="true">*</span>}
            </label>
          )}
          {showCharCount && maxLength && (
            <span className="text-micro font-mono text-ink-500">
              {currentLength} / {maxLength}
            </span>
          )}
        </div>

        <textarea
          ref={ref}
          id={id}
          required={required}
          disabled={disabled}
          maxLength={maxLength}
          onChange={handleChange}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : helperText ? helperId : undefined}
          className={cn(
            'w-full min-h-[96px] rounded-md border bg-paper p-3 text-small text-ink-900 placeholder:text-ink-300 shadow-sm transition-colors duration-fast',
            'border-line hover:border-ink-300 focus:border-saffron-500 focus:outline-none focus:ring-1 focus:ring-saffron-500',
            'disabled:bg-cream-100 disabled:text-ink-500 disabled:cursor-not-allowed',
            error && 'border-risk-critical focus:border-risk-critical focus:ring-risk-critical',
            className
          )}
          {...props}
        />

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

Textarea.displayName = 'Textarea'
