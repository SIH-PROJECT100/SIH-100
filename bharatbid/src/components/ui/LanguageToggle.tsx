import { Languages } from 'lucide-react'
import { useI18n } from '@/providers/I18nProvider'
import { cn } from '@/lib/utils'

export interface LanguageToggleProps {
  className?: string
  variant?: 'button' | 'compact'
}

export function LanguageToggle({ className, variant = 'button' }: LanguageToggleProps) {
  const { locale, setLocale } = useI18n()

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'hi' : 'en')
  }

  const nextLabel = locale === 'en' ? 'हिंदी' : 'English'

  if (variant === 'compact') {
    return (
      <button
        id="language-toggle-btn"
        type="button"
        onClick={toggleLanguage}
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded border border-line bg-paper text-ink-700 hover:bg-cream-100 hover:text-ink-900 transition-colors text-micro font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron-500',
          className
        )}
        aria-label={`Switch language to ${nextLabel}`}
        title={`Switch language to ${nextLabel}`}
      >
        <Languages className="w-3.5 h-3.5 text-ink-500" aria-hidden="true" />
        <span>{nextLabel}</span>
      </button>
    )
  }

  return (
    <button
      id="language-toggle-btn"
      type="button"
      onClick={toggleLanguage}
      className={cn(
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line bg-paper text-ink-900 hover:bg-cream-100 hover:border-ink-300 shadow-sm transition-colors text-small font-medium select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500',
        className
      )}
      aria-label={`Switch language to ${nextLabel}`}
    >
      <Languages className="w-4 h-4 text-saffron-600" aria-hidden="true" />
      <span>{nextLabel}</span>
      <span className="text-micro font-mono text-ink-500 uppercase px-1 py-0.2 rounded bg-cream-100">
        {locale}
      </span>
    </button>
  )
}
