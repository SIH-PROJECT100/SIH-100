import React from 'react'
import { ShieldCheck, FileCheck2, Cpu, FlaskConical } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrustSourceKey } from '@/types'

export interface TrustBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  source: TrustSourceKey
  confidence?: number
  size?: 'sm' | 'md'
  showTooltip?: boolean
}

const trustConfig: Record<
  TrustSourceKey,
  {
    label: string
    bg: string
    text: string
    border: string
    icon: React.ComponentType<{ className?: string }>
    tooltip: string
  }
> = {
  digilocker: {
    label: 'DigiLocker',
    bg: 'bg-[#EBF1F8]',
    text: 'text-trust-digilocker',
    border: 'border-[#BDD2EB]',
    icon: ShieldCheck,
    tooltip: 'Mock CCA root cert for demo; production integrates live DigiLocker Partner API (sandbox access pending)',
  },
  portal_verified: {
    label: 'Portal Verified',
    bg: 'bg-[#EFF3F8]',
    text: 'text-trust-portal',
    border: 'border-[#C8D6E5]',
    icon: FileCheck2,
    tooltip: 'Simulated portal response; production integrates Udyam / NSIC / Startup India verify APIs',
  },
  ai_extracted: {
    label: 'AI Extracted',
    bg: 'bg-[#F4EFF8]',
    text: 'text-trust-ai',
    border: 'border-[#D9CBE8]',
    icon: Cpu,
    tooltip: 'Extracted via gemini-2.5-flash model with dual confidence scoring',
  },
  simulated: {
    label: 'Simulated',
    bg: 'bg-[#F2F0ED]',
    text: 'text-trust-simulated',
    border: 'border-[#D6D2CC]',
    icon: FlaskConical,
    tooltip: 'Simulated for demo — production requires GSTN / PAN / MCA21 GSP partnership',
  },
}

export function TrustBadge({
  source,
  confidence,
  size = 'sm',
  showTooltip = true,
  className,
  ...props
}: TrustBadgeProps) {
  const config = trustConfig[source] || trustConfig.simulated
  const Icon = config.icon

  const titleText = showTooltip
    ? `${config.label}: ${config.tooltip}${
        confidence !== undefined ? ` (Confidence: ${(confidence * 100).toFixed(0)}%)` : ''
      }`
    : undefined

  return (
    <span
      title={titleText}
      className={cn(
        'inline-flex items-center font-medium rounded border select-none cursor-help',
        config.bg,
        config.text,
        config.border,
        size === 'sm' ? 'px-2 py-0.5 text-micro gap-1' : 'px-2.5 py-1 text-small gap-1.5',
        className
      )}
      {...props}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} aria-hidden="true" />
      <span>{config.label}</span>
      {source === 'ai_extracted' && confidence !== undefined && (
        <span className="font-mono text-micro opacity-90">
          {(confidence * 100).toFixed(0)}%
        </span>
      )}
    </span>
  )
}
