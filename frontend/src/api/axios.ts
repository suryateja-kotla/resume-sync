import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// AuthProvider registers its updateTokens callback here so this plain module
// (outside the React tree) can keep AuthContext's accessToken state in sync
// after a silent refresh, instead of only writing to localStorage.
let onTokenRefreshed: ((accessToken: string) => void) | null = null
export function setTokenRefreshedHandler(handler: (accessToken: string) => void) {
  onTokenRefreshed = handler
}

// ── Request interceptor — attach Bearer token ─────────────────────────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('rs_access')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor — handle 401 with silent refresh ────────────────────
let isRefreshing = false
let pendingRequests: Array<(token: string) => void> = []

api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config

    // Only intercept 401s that haven't been retried yet
    // Skip auth endpoints themselves to avoid infinite loops
    const isAuthEndpoint = original?.url?.includes('/auth/')
    if (error.response?.status !== 401 || original._retry || isAuthEndpoint) {
      return Promise.reject(error)
    }

    original._retry = true

    const refreshToken = localStorage.getItem('rs_refresh')
    if (!refreshToken) {
      _forceLogout()
      return Promise.reject(error)
    }

    // If a refresh is already in flight, queue this request until it resolves
    if (isRefreshing) {
      return new Promise(resolve => {
        pendingRequests.push((newToken: string) => {
          original.headers.Authorization = `Bearer ${newToken}`
          resolve(api(original))
        })
      })
    }

    isRefreshing = true
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken }
      )
      const newAccess = data.access_token
      localStorage.setItem('rs_access', newAccess)
      onTokenRefreshed?.(newAccess)

      // Flush queued requests with the new token
      pendingRequests.forEach(cb => cb(newAccess))
      pendingRequests = []

      original.headers.Authorization = `Bearer ${newAccess}`
      return api(original)
    } catch {
      // Refresh failed — force logout
      pendingRequests = []
      _forceLogout()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

function _forceLogout() {
  localStorage.removeItem('rs_user')
  localStorage.removeItem('rs_access')
  localStorage.removeItem('rs_refresh')
  window.location.href = '/login'
}

export default api
