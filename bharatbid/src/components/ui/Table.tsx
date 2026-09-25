import React, { forwardRef, createContext, useContext } from 'react'
import { cn } from '@/lib/utils'

export type TableDensity = 'compact' | 'normal'

interface TableContextValue {
  density: TableDensity
}

const TableContext = createContext<TableContextValue>({ density: 'normal' })

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  density?: TableDensity
  wrapperClassName?: string
  stickyHeader?: boolean
}

export const Table = forwardRef<HTMLTableElement, TableProps>(
  (
    {
      className,
      wrapperClassName,
      density = 'normal',
      stickyHeader: _stickyHeader = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <TableContext.Provider value={{ density }}>
        <div
          className={cn(
            'relative w-full overflow-auto rounded-lg border border-line bg-paper shadow-xs',
            wrapperClassName
          )}
        >
          <table
            ref={ref}
            className={cn('w-full caption-bottom text-small text-left border-collapse', className)}
            {...props}
          >
            {children}
          </table>
        </div>
      </TableContext.Provider>
    )
  }
)
Table.displayName = 'Table'

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement> & { sticky?: boolean }
>(({ className, sticky, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      'bg-cream-100 border-b-2 border-line text-navy-900 font-semibold text-small',
      sticky && 'sticky top-0 z-10',
      className
    )}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('divide-y divide-line/60 bg-paper', className)}
    {...props}
  />
))
TableBody.displayName = 'TableBody'

export const TableRow = forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & { isSelected?: boolean; isInteractive?: boolean }
>(({ className, isSelected, isInteractive, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'transition-colors duration-fast hover:bg-cream-50',
      isInteractive && 'cursor-pointer',
      isSelected && 'bg-cream-100',
      className
    )}
    {...props}
  />
))
TableRow.displayName = 'TableRow'

export const TableHead = forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const { density } = useContext(TableContext)
  return (
    <th
      ref={ref}
      className={cn(
        'px-4 font-semibold text-navy-900 select-none align-middle uppercase tracking-wider',
        density === 'compact' ? 'py-2 text-[11px]' : 'py-3 text-xs',
        className
      )}
      {...props}
    />
  )
})
TableHead.displayName = 'TableHead'

export const TableCell = forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => {
  const { density } = useContext(TableContext)
  return (
    <td
      ref={ref}
      className={cn(
        'px-4 align-middle text-ink-900',
        density === 'compact' ? 'py-1.5 text-micro min-h-[36px]' : 'py-2.5 text-small min-h-[48px]',
        className
      )}
      {...props}
    />
  )
})
TableCell.displayName = 'TableCell'
