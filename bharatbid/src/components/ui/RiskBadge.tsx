import React from 'react'
import { AlertOctagon, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { RiskLevel } from '@/types'

export interface RiskBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: RiskLevel
  score?: number
  size?: 'sm' | 'md'
  showLabel?: boolean
}

const riskConfig: Record<
  RiskLevel,
  {
    label: string
    bg: string
    text: string
    border: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  critical: {
    label: 'Critical',
    bg: 'bg-[#FAECEB]',
    text: 'text-risk-critical',
    border: 'border-[#EFC2BF]',
    icon: AlertOctagon,
  },
  high: {
    label: 'High',
    bg: 'bg-[#FDF0E9]',
    text: 'text-risk-high',
    border: 'border-[#F8D0BD]',
    icon: AlertTriangle,
  },
  medium: {
    label: 'Medium',
    bg: 'bg-[#FBF6EA]',
    text: 'text-risk-medium',
    border: 'border-[#EBDCB4]',
    icon: AlertCircle,
  },
  low: {
    label: 'Low',
    bg: 'bg-[#EBF3EC]',
    text: 'text-risk-low',
    border: 'border-[#C7DEC9]',
    icon: CheckCircle2,
  },
}

import { useI18n } from '@/providers/I18nProvider'

export function RiskBadge({
  level,
  score,
  size = 'sm',
  showLabel = true,
  className,
  ...props
}: RiskBadgeProps) {
  let t = (_k: string, fb: string) => fb
  try {
    const i18n = useI18n()
    if (i18n?.t) t = i18n.t
  } catch {
    // outside provider
  }

  const config = riskConfig[level] || riskConfig.low
  const Icon = config.icon
  const label = t('risk.' + level, config.label)

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border select-none',
        config.bg,
        config.text,
        config.border,
        size === 'sm' ? 'px-2 py-0.5 text-micro gap-1' : 'px-2.5 py-1 text-small gap-1.5',
        className
      )}
      {...props}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} aria-hidden="true" />
      {showLabel && <span>{label}</span>}
      {score !== undefined && (
        <span className="font-mono text-micro opacity-90">
          ({score <= 1 ? (score * 100).toFixed(0) + '%' : score.toFixed(1)})
        </span>
      )}
    </span>
  )
}
