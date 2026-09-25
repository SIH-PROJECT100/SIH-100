/**
 * BharatBid Logo — monogram + wordmark
 *
 * Renders at three explicit sizes: 24px, 32px, 48px height.
 * Uses Fraunces (--font-display) for wordmark, never a Tailwind gradient or glow.
 */

interface LogoProps {
  /** Height of the logo lockup in pixels. Defaults to 32. */
  size?: 24 | 32 | 48 | 64
  /** Show just the monogram without the wordmark */
  markOnly?: boolean
  className?: string
}

// Monogram dimensions relative to size
const SIZES = {
  24: { monogram: 24, fontSize: '14px', gap: '6px', tracking: '-0.02em' },
  32: { monogram: 32, fontSize: '18px', gap: '8px', tracking: '-0.02em' },
  48: { monogram: 48, fontSize: '26px', gap: '12px', tracking: '-0.02em' },
  64: { monogram: 64, fontSize: '34px', gap: '16px', tracking: '-0.02em' },
} as const

export function Logo({ size = 32, markOnly = false, className = '' }: LogoProps) {
  const { monogram, fontSize, gap, tracking } = SIZES[size]

  return (
    <div
      className={`flex items-center select-none ${className}`}
      style={{ gap, height: size }}
      aria-label="BharatBid"
    >
      {/* Monogram mark */}
      <svg
        width={monogram}
        height={monogram}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="32" height="32" rx="6" fill="#0F2942" />
        <rect x="8" y="6" width="3.5" height="20" rx="1" fill="#F7F4EF" />
        <path d="M11.5 6 H17 Q22 6 22 11.5 Q22 17 17 17 H11.5 Z" fill="#F7F4EF" />
        <path d="M12.5 8 H16.5 Q19.5 8 19.5 11.5 Q19.5 15 16.5 15 H12.5 Z" fill="#0F2942" />
        <path d="M11.5 17 H17.5 Q23 17 23 22 Q23 26 17.5 26 H11.5 Z" fill="#F7F4EF" />
        <path d="M12.5 19 H17 Q20.5 19 20.5 22 Q20.5 24.5 17 24.5 H12.5 Z" fill="#0F2942" />
        <rect x="8" y="28.5" width="16" height="2" rx="1" fill="#C56B2E" />
      </svg>

      {/* Wordmark — Fraunces, never gradient */}
      {!markOnly && (
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize,
            fontWeight: 500,
            letterSpacing: tracking,
            color: 'var(--color-navy-900)',
            lineHeight: 1,
          }}
        >
          BharatBid
        </span>
      )}
    </div>
  )
}
