import React from 'react'
import { cn } from '@/lib/utils'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circle' | 'block' | 'tableRow'
}

export function Skeleton({ className, variant = 'block', ...props }: SkeletonProps) {
  if (variant === 'tableRow') {
    return (
      <div className={cn('flex items-center gap-4 py-3 border-b border-line animate-pulse', className)}>
        <div className="h-4 w-1/4 rounded bg-cream-100" />
        <div className="h-4 w-1/6 rounded bg-cream-100" />
        <div className="h-4 w-1/5 rounded bg-cream-100" />
        <div className="h-4 w-1/6 rounded bg-cream-100" />
        <div className="h-4 w-12 rounded bg-cream-100 ml-auto" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'animate-pulse bg-cream-100 border border-line/40 select-none',
        variant === 'circle' && 'rounded-full',
        variant === 'text' && 'h-4 w-full rounded',
        variant === 'block' && 'rounded-md',
        className
      )}
      {...props}
    />
  )
}
