import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface User {
  email: string
  role: string
  employeeId: string | null
  fullName: string | null
  mustChangePassword: boolean
}

interface AuthContextType {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  updateTokens: (accessToken: string) => void
  clearMustChangePassword: () => void
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const KEYS = {
  user:         'rs_user',
  accessToken:  'rs_access',
  refreshToken: 'rs_refresh',
}

function readStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    // exp is in seconds; Date.now() is in ms
    return payload.exp * 1000 < Date.now()
  } catch {
    return true
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // Restore from localStorage but reject expired access tokens
  const [user, setUser] = useState<User | null>(() => {
    const stored = readStorage<User>(KEYS.user)
    const token  = readStorage<string>(KEYS.accessToken)
    // If the stored access token is expired and there's no refresh token,
    // treat the session as logged out so the user is sent to /login.
    const refresh = localStorage.getItem(KEYS.refreshToken)
    if (stored && token && isTokenExpired(token) && !refresh) {
      localStorage.removeItem(KEYS.user)
      localStorage.removeItem(KEYS.accessToken)
      return null
    }
    return stored
  })

  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(KEYS.accessToken)
  )

  const [refreshToken, setRefreshToken] = useState<string | null>(() =>
    localStorage.getItem(KEYS.refreshToken)
  )

  const login = useCallback((userData: User, access: string, refresh: string) => {
    setUser(userData)
    setAccessToken(access)
    setRefreshToken(refresh)
    localStorage.setItem(KEYS.user,         JSON.stringify(userData))
    localStorage.setItem(KEYS.accessToken,  access)
    localStorage.setItem(KEYS.refreshToken, refresh)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setAccessToken(null)
    setRefreshToken(null)
    localStorage.removeItem(KEYS.user)
    localStorage.removeItem(KEYS.accessToken)
    localStorage.removeItem(KEYS.refreshToken)
  }, [])

  // Called by the axios interceptor after a successful token refresh
  const updateTokens = useCallback((newAccess: string) => {
    setAccessToken(newAccess)
    localStorage.setItem(KEYS.accessToken, newAccess)
  }, [])

  // Called after the user completes their forced password change
  const clearMustChangePassword = useCallback(() => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, mustChangePassword: false }
      localStorage.setItem(KEYS.user, JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{
      user, accessToken, refreshToken,
      login, logout, updateTokens, clearMustChangePassword,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
