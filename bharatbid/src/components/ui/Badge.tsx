import React from 'react'
import {
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  CircleDot,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: React.ReactNode
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-cream-100 text-ink-800 border-line dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 font-semibold',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/70 dark:text-emerald-200 dark:border-emerald-600 font-semibold',
  warning: 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-600 font-semibold',
  danger: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/70 dark:text-rose-200 dark:border-rose-600 font-semibold',
  info: 'bg-sky-50 text-sky-900 border-sky-300 dark:bg-sky-950/70 dark:text-sky-200 dark:border-sky-600 font-semibold',
}

const defaultIcons: Record<BadgeVariant, React.ReactNode> = {
  default: <CircleDot className="w-3 h-3 shrink-0" aria-hidden="true" />,
  success: <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />,
  warning: <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />,
  danger: <AlertOctagon className="w-3 h-3 shrink-0" aria-hidden="true" />,
  info: <Info className="w-3 h-3 shrink-0" aria-hidden="true" />,
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-micro gap-1',
  md: 'px-2.5 py-1 text-small gap-1.5',
}

export function Badge({
  className,
  variant = 'default',
  size = 'sm',
  icon,
  children,
  ...props
}: BadgeProps) {
  const renderedIcon = icon !== undefined ? icon : defaultIcons[variant]

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {renderedIcon && <span className="inline-flex shrink-0">{renderedIcon}</span>}
      <span>{children}</span>
    </span>
  )
}
