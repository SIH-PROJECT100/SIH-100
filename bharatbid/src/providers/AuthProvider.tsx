import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient, { setStoredToken, clearStoredToken, getStoredToken } from '@/lib/apiClient'
import type { User, AuthResponse } from '@/types'

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── JWT helpers ──────────────────────────────────────────────────────────────

function decodeTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  // Schedule a token refresh 5 minutes before expiry
  const scheduleRefresh = useCallback(
    (currentToken: string) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      const expiry = decodeTokenExpiry(currentToken)
      if (!expiry) return

      const refreshAt = expiry - Date.now() - 5 * 60 * 1000 // 5 min before
      if (refreshAt <= 0) return

      refreshTimerRef.current = setTimeout(async () => {
        try {
          const response = await apiClient.post<AuthResponse>('/auth/refresh')
          const { token: newToken, user: newUser } = response.data as unknown as AuthResponse
          setStoredToken(newToken)
          setToken(newToken)
          setUser(newUser)
          scheduleRefresh(newToken)
        } catch {
          // Refresh failed — force logout
          clearStoredToken()
          setToken(null)
          setUser(null)
          navigate('/login')
        }
      }, refreshAt)
    },
    [navigate],
  )

  // Listen for session-expired event from apiClient interceptor
  useEffect(() => {
    const handler = () => {
      clearStoredToken()
      setToken(null)
      setUser(null)
      navigate('/login', { state: { sessionExpired: true } })
    }
    window.addEventListener('bb:session-expired', handler)
    return () => window.removeEventListener('bb:session-expired', handler)
  }, [navigate])

  // Restore session on mount
  useEffect(() => {
    const stored = getStoredToken()
    if (!stored) {
      setIsLoading(false)
      return
    }

    // Validate the token by fetching current user
    apiClient
      .get<User>('/auth/me')
      .then((res) => {
        const userData = res.data as unknown as User
        setUser(userData)
        setToken(stored)
        scheduleRefresh(stored)
      })
      .catch(() => {
        clearStoredToken()
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [scheduleRefresh])

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.post<AuthResponse>('/auth/login', { email, password })
      const { token: newToken, user: newUser } = response.data as unknown as AuthResponse
      setStoredToken(newToken)
      setToken(newToken)
      setUser(newUser)
      scheduleRefresh(newToken)
    },
    [scheduleRefresh],
  )

  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    clearStoredToken()
    setToken(null)
    setUser(null)
    navigate('/login')
  }, [navigate])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
