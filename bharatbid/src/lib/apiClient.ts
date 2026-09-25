import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { ApiEnvelope } from '@/types'

// ─── Axios instance ───────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
})

// ─── Request interceptor: attach JWT ─────────────────────────────────────────

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Skip auth header for login and health endpoints
  const url = config.url ?? ''
  if (url.includes('/auth/login') || url.includes('/health')) {
    return config
  }

  const token = getStoredToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── Response interceptor: unwrap envelope + handle errors ───────────────────

apiClient.interceptors.response.use(
  (response) => {
    // Unwrap the { data, error } envelope transparently
    const envelope = response.data as ApiEnvelope<unknown>
    if (envelope && 'data' in envelope && 'error' in envelope) {
      if (envelope.error) {
        return Promise.reject(
          Object.assign(new Error(envelope.error.message), {
            issues: envelope.error.issues,
            isApiError: true,
          }),
        )
      }
      // Return a clone of the response with .data = envelope.data
      return { ...response, data: envelope.data }
    }
    return response
  },
  (error: AxiosError) => {
    const status = error.response?.status
    const envelope = error.response?.data as ApiEnvelope<unknown> | undefined
    const message = envelope?.error?.message ?? error.message

    switch (status) {
      case 401: {
        clearStoredToken()
        // Emit a custom event so the auth store can react
        window.dispatchEvent(new CustomEvent('bb:session-expired'))
        break
      }
      case 403: {
        window.dispatchEvent(
          new CustomEvent('bb:toast', {
            detail: { type: 'error', message: 'Access denied: insufficient privileges.' },
          }),
        )
        break
      }
      case 429: {
        const retryAfter = error.response?.headers?.['retry-after']
        const seconds = retryAfter ? parseInt(retryAfter, 10) : 60
        window.dispatchEvent(
          new CustomEvent('bb:toast', {
            detail: {
              type: 'error',
              message: `Too many requests. Please try again in ${seconds}s.`,
            },
          }),
        )
        // Attach retry-after to the error for useRateLimitedAction
        return Promise.reject(
          Object.assign(error, { retryAfterSeconds: seconds, isRateLimited: true }),
        )
      }
      case 402: {
        window.dispatchEvent(new CustomEvent('bb:payment-required'))
        break
      }
      default:
        break
    }

    return Promise.reject(
      Object.assign(new Error(message), {
        status,
        issues: envelope?.error?.issues,
        isApiError: true,
      }),
    )
  },
)

// ─── Token helpers (memory + sessionStorage — no PII in localStorage) ─────────

let _memoryToken: string | null = null

export function getStoredToken(): string | null {
  return _memoryToken ?? sessionStorage.getItem('bb_token')
}

export function setStoredToken(token: string): void {
  _memoryToken = token
  sessionStorage.setItem('bb_token', token)
}

export function clearStoredToken(): void {
  _memoryToken = null
  sessionStorage.removeItem('bb_token')
}

export default apiClient
