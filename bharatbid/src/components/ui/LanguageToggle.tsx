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
          'inline-flex items-center gap-1.5 px-2 py-1 rounded border border-line dark:border-navy-700 bg-paper dark:bg-navy-900 text-ink-700 dark:text-cream-100 hover:bg-cream-100 dark:hover:bg-navy-800 hover:text-ink-900 dark:hover:text-cream-50 transition-colors text-micro font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-saffron-500',
          className
        )}
        aria-label={`Switch language to ${nextLabel}`}
        title={`Switch language to ${nextLabel}`}
      >
        <Languages className="w-3.5 h-3.5 text-ink-500 dark:text-saffron-400" aria-hidden="true" />
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
        'inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line dark:border-navy-700 bg-paper dark:bg-navy-900 text-ink-900 dark:text-cream-50 hover:bg-cream-100 dark:hover:bg-navy-800 hover:border-ink-300 dark:hover:border-navy-600 shadow-sm transition-colors text-small font-semibold select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500',
        className
      )}
      aria-label={`Switch language to ${nextLabel}`}
    >
      <Languages className="w-4 h-4 text-saffron-600 dark:text-saffron-400" aria-hidden="true" />
      <span>{nextLabel}</span>
      <span className="text-micro font-mono text-ink-500 dark:text-saffron-300 uppercase px-1 py-0.2 rounded bg-cream-100 dark:bg-navy-800">
        {locale}
      </span>
    </button>
  )
}
