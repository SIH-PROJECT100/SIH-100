import React from 'react'
import { FolderSearch } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'w-full flex flex-col items-center justify-center p-10 text-center rounded-lg border border-dashed border-line bg-paper/50',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-cream-100 flex items-center justify-center text-ink-500 mb-3 border border-line">
        {icon || <FolderSearch className="w-6 h-6 text-ink-500" aria-hidden="true" />}
      </div>

      <h4 className="text-h3 font-semibold text-ink-900">{title}</h4>

      {description && (
        <p className="text-small text-ink-500 max-w-md mt-1 mb-5">
          {description}
        </p>
      )}

      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
