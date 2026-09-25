import React, { createContext, useContext, useState } from 'react'
import { cn } from '@/lib/utils'

interface TabsContextValue {
  value: string
  onChange: (value: string) => void
}

const TabsContext = createContext<TabsContextValue | null>(null)

export interface TabsProps {
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  children: React.ReactNode
  className?: string
}

export function Tabs({
  value: controlledValue,
  defaultValue = '',
  onChange,
  children,
  className,
}: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue)

  const isControlled = controlledValue !== undefined
  const activeValue = isControlled ? controlledValue : uncontrolledValue

  const handleTabChange = (val: string) => {
    if (!isControlled) setUncontrolledValue(val)
    onChange?.(val)
  }

  return (
    <TabsContext.Provider value={{ value: activeValue, onChange: handleTabChange }}>
      <div className={cn('w-full flex flex-col', className)}>{children}</div>
    </TabsContext.Provider>
  )
}

export interface TabListProps {
  children: React.ReactNode
  className?: string
  'aria-label'?: string
}

export function TabList({ children, className, 'aria-label': ariaLabel }: TabListProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'flex items-center gap-6 border-b border-line',
        'overflow-x-auto pb-px scroll-smooth',
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]',
        className
      )}
    >
      {children}
    </div>
  )
}

export interface TabTriggerProps {
  value: string
  children: React.ReactNode
  count?: number | string
  badge?: React.ReactNode
  disabled?: boolean
  className?: string
}

export function TabTrigger({
  value,
  children,
  count,
  badge,
  disabled,
  className,
}: TabTriggerProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabTrigger must be used within Tabs')

  const isActive = context.value === value

  return (
    <button
      type="button"
      role="tab"
      disabled={disabled}
      aria-selected={isActive}
      onClick={() => context.onChange(value)}
      className={cn(
        'pb-3 pt-2 text-small font-medium border-b-2 transition-colors duration-fast whitespace-nowrap flex items-center gap-2 select-none',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron-500',
        isActive
          ? 'border-saffron-500 text-ink-900 font-semibold'
          : 'border-transparent text-ink-500 hover:text-ink-700 hover:border-ink-300',
        disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span
          className={cn(
            'px-1.5 py-0.5 rounded text-micro font-mono',
            isActive ? 'bg-saffron-100 text-saffron-600' : 'bg-cream-100 text-ink-500'
          )}
        >
          {count}
        </span>
      )}
      {badge && <span className="inline-flex shrink-0">{badge}</span>}
    </button>
  )
}

export interface TabContentProps {
  value: string
  children: React.ReactNode
  className?: string
}

export function TabContent({ value, children, className }: TabContentProps) {
  const context = useContext(TabsContext)
  if (!context) throw new Error('TabContent must be used within Tabs')

  if (context.value !== value) return null

  return (
    <div role="tabpanel" className={cn('pt-4 focus:outline-none', className)}>
      {children}
    </div>
  )
}
