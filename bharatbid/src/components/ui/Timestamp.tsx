import { format, formatDistanceToNow, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'

export interface TimestampProps {
  date: string | Date | number
  mode?: 'absolute' | 'relative' | 'both'
  className?: string
}

export function Timestamp({ date, mode = 'absolute', className }: TimestampProps) {
  const parsedDate = typeof date === 'string' ? parseISO(date) : new Date(date)
  const isValid = !isNaN(parsedDate.getTime())

  if (!isValid) {
    return <span className={cn('font-mono text-ink-300 text-small', className)}>—</span>
  }

  const iso = parsedDate.toISOString()
  const absoluteStr = format(parsedDate, 'dd MMM yyyy, HH:mm')
  const relativeStr = formatDistanceToNow(parsedDate, { addSuffix: true })

  let text: string
  if (mode === 'relative') {
    text = relativeStr
  } else if (mode === 'both') {
    text = `${absoluteStr} (${relativeStr})`
  } else {
    text = absoluteStr
  }

  return (
    <time
      dateTime={iso}
      title={`${absoluteStr} (UTC: ${iso})`}
      className={cn('font-mono text-small text-ink-700 tracking-tight select-all', className)}
    >
      {text}
    </time>
  )
}
