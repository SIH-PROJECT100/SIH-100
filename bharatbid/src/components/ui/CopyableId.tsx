import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface CopyableIdProps {
  id: string
  label?: string
  truncate?: boolean
  truncateChars?: number
  className?: string
  showToast?: boolean
}

export function CopyableId({
  id,
  label,
  truncate = false,
  truncateChars = 8,
  className,
  showToast = true,
}: CopyableIdProps) {
  const [copied, setCopied] = useState(false)

  const displayText = truncate
    ? `${id.slice(0, truncateChars)}…${id.slice(-truncateChars)}`
    : id

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
      if (showToast) {
        toast.success(`Copied ${label || 'ID'} to clipboard`, {
          description: id,
          duration: 2000,
        })
      }
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Click to copy: ${id}`}
      className={cn(
        'group inline-flex items-center gap-1.5 font-mono text-small text-ink-900 bg-cream-50 hover:bg-cream-100 border border-line hover:border-ink-300 rounded px-1.5 py-0.5 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron-500',
        className
      )}
    >
      <span>{displayText}</span>
      {copied ? (
        <Check className="w-3.5 h-3.5 text-risk-low shrink-0" aria-label="Copied" />
      ) : (
        <Copy
          className="w-3.5 h-3.5 text-ink-500 group-hover:text-ink-900 shrink-0 transition-colors"
          aria-label="Copy"
        />
      )}
    </button>
  )
}
