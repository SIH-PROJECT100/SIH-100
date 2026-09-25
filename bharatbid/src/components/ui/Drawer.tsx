import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  badge?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string
  className?: string
}

export function Drawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footer,
  maxWidth = 'max-w-[720px]',
  className,
}: DrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      ref={overlayRef}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      className="fixed inset-0 z-50 flex justify-end bg-ink-900/40 backdrop-blur-[2px] transition-opacity"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'drawer-title' : undefined}
    >
      <div
        className={cn(
          'w-full h-full bg-paper border-l border-line shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-fast',
          maxWidth,
          className
        )}
      >
        <div className="flex items-start justify-between p-5 border-b border-line bg-paper sticky top-0 z-10">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {title && (
                <h2 id="drawer-title" className="text-h3 font-semibold text-ink-900">
                  {title}
                </h2>
              )}
              {badge && <div className="inline-flex items-center">{badge}</div>}
            </div>
            {subtitle && <p className="text-small text-ink-500 mt-0.5">{subtitle}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-ink-500 hover:text-ink-900 hover:bg-cream-100 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron-500"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-between p-4 border-t border-line bg-cream-50/50 sticky bottom-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
