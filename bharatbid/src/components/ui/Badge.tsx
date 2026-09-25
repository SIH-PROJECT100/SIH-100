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
  default: 'bg-cream-100 text-ink-700 border-line',
  success: 'bg-[#EBF3EC] text-risk-low border-[#C7DEC9]',
  warning: 'bg-[#FBF6EA] text-risk-medium border-[#EBDCB4]',
  danger: 'bg-[#FAECEB] text-risk-critical border-[#EFC2BF]',
  info: 'bg-navy-100 text-navy-900 border-[#CCD9E6]',
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
