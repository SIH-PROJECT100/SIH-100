import { useState, useCallback, useRef, useEffect } from 'react'
import { useMutation, type UseMutationOptions } from '@tanstack/react-query'

interface RateLimitedActionOptions<TData, TError, TVariables> extends UseMutationOptions<TData, TError, TVariables> {
  /** Default cooldown in seconds if no Retry-After header is returned. Default: 60 */
  defaultCooldown?: number
  /**
   * Key used to persist the cooldown expiry timestamp in sessionStorage.
   * If provided, the cooldown survives page refreshes within the same tab.
   * Format: 'bb_cooldown_<action>_expires_at'
   */
  storageKey?: string
}

interface RateLimitedActionResult<TData, TError, TVariables> {
  mutate: (variables: TVariables) => void
  mutateAsync: (variables: TVariables) => Promise<TData>
  isPending: boolean
  isError: boolean
  isSuccess: boolean
  error: TError | null
  data: TData | undefined
  /** Seconds remaining in the rate-limit cooldown. 0 means not rate-limited. */
  cooldownSeconds: number
  /** True when button should be disabled due to rate limiting */
  isRateLimited: boolean
}

/**
 * Wraps TanStack Query's useMutation with automatic 429 rate-limit handling.
 *
 * On a 429 response:
 *  - Reads the Retry-After seconds from the error (set by apiClient interceptor)
 *  - Disables the action and counts down
 *  - Re-enables automatically when countdown reaches 0
 *  - Persists expiry timestamp in sessionStorage (survives same-tab page refresh)
 *
 * Applied to: Detect Collusion, Verify/Re-Verify, Login, Vault Report Download.
 */
export function useRateLimitedAction<TData = unknown, TError = Error, TVariables = void>(
  options: RateLimitedActionOptions<TData, TError, TVariables>,
): RateLimitedActionResult<TData, TError, TVariables> {
  const { defaultCooldown = 60, storageKey, onError, ...mutationOptions } = options

  // On mount, check if there's a stored expiry for this action
  const getInitialCooldown = (): number => {
    if (!storageKey) return 0
    try {
      const stored = sessionStorage.getItem(storageKey)
      if (stored) {
        const expiresAt = parseInt(stored, 10)
        const remaining = Math.ceil((expiresAt - Date.now()) / 1000)
        if (remaining > 0) return remaining
        sessionStorage.removeItem(storageKey)
      }
    } catch {
      // sessionStorage not available (private mode, etc.)
    }
    return 0
  }

  const [cooldownSeconds, setCooldownSeconds] = useState(() => getInitialCooldown())
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(
    (seconds: number) => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
      }
      // Persist expiry in sessionStorage
      if (storageKey) {
        try {
          sessionStorage.setItem(storageKey, String(Date.now() + seconds * 1000))
        } catch {
          // ignore
        }
      }
      setCooldownSeconds(seconds)
      countdownRef.current = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!)
            countdownRef.current = null
            if (storageKey) {
              try { sessionStorage.removeItem(storageKey) } catch { /* ignore */ }
            }
            return 0
          }
          return prev - 1
        })
      }, 1_000)
    },
    [storageKey],
  )

  // On mount: if a cooldown was restored from storage, start the interval
  useEffect(() => {
    const initial = getInitialCooldown()
    if (initial > 0) {
      startCooldown(initial)
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mutation = useMutation<TData, TError, TVariables>({
    ...mutationOptions,
    onError: (error, variables, context) => {
      // Check if this is a rate limit error (set by apiClient interceptor)
      const rateLimitError = error as TError & { isRateLimited?: boolean; retryAfterSeconds?: number }
      if (rateLimitError?.isRateLimited) {
        const seconds = rateLimitError.retryAfterSeconds ?? defaultCooldown
        startCooldown(seconds)
      }
      onError?.(error, variables, context)
    },
  })

  return {
    ...mutation,
    cooldownSeconds,
    isRateLimited: cooldownSeconds > 0,
  }
}
