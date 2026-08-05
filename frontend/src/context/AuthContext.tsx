import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import api, { redirectToLogin, setCsrfToken } from '../api/axios'
import { invalidate } from '../hooks/useCachedResource'

// ── Types ─────────────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'HR' | 'EMPLOYEE'

interface User {
  employeeId: string
  email: string
  fullName: string
  role: Role
}

interface AuthContextType {
  user: User | null
  /** True until the initial /auth/me call settles. Routes must wait for this,
   *  otherwise a signed-in user is bounced to /login on every page load. */
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  isHR: boolean
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // The client is no longer the authority on its own identity. Previously the
  // role came from localStorage, where a user could simply edit it to "HR" —
  // harmless on its own, but it meant the UI and the server disagreed about
  // who someone was. Now the session cookie is opaque and unreadable from JS,
  // so the only way to know who you are is to ask the server.
  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me')
      const signedIn = data.status === 'success'
      setUser(signedIn ? data.user : null)
      // The CSRF token rides inside this same response body — see axios.ts
      // for why it can no longer travel as a cookie. Every unsafe request
      // (save, upload, delete, logout) depends on this being set correctly.
      setCsrfToken(signedIn ? data.user.csrf_token : null)
    } catch {
      // 401 here is normal — it just means nobody is signed in. The axios
      // interceptor deliberately skips redirecting on /auth/me so that the
      // login page itself does not loop.
      setUser(null)
      setCsrfToken(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // Even if the call fails, clear local state and leave — the session is
      // server-side, so the worst case is a row that expires on its own.
    }
    // Drop every cached section. Without this, signing in as a different
    // person on the same browser would briefly render the previous user's
    // employee lists from cache before the refetch landed.
    invalidate()
    setUser(null)
    setCsrfToken(null)
    redirectToLogin()
  }, [])

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      refresh,
      logout,
      isAdmin: user?.role === 'ADMIN',
      // ADMIN is a superset of HR everywhere in the UI, mirroring the
      // backend's require_hr, which also accepts ADMIN.
      isHR: user?.role === 'HR' || user?.role === 'ADMIN',
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
