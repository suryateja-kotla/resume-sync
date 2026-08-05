import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

// `withCredentials` is what makes the session work: the backend sets an
// httpOnly cookie the browser attaches automatically. Nothing here reads or
// stores a token, because there is no longer a token to read — that is the
// point of the change. An XSS on this page cannot exfiltrate the session.
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── CSRF ─────────────────────────────────────────────────────────────────────
// Cookies are sent automatically, so a cookie-authenticated API is CSRF-exposed
// by default. The backend issues a second, deliberately JS-readable cookie; we
// echo its value in a header on every state-changing request. An attacker's
// page can cause the request to be sent but cannot read our cookie to populate
// the header, so the backend's comparison fails.
//
// This matters more than usual here: frontend and backend sit on different
// *.run.app hosts, which forces SameSite=None and removes the partial
// protection SameSite would otherwise provide.
const CSRF_COOKIE = 'sf_csrf'
const UNSAFE_METHODS = ['post', 'put', 'patch', 'delete']

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

api.interceptors.request.use(config => {
  if (UNSAFE_METHODS.includes((config.method ?? '').toLowerCase())) {
    const token = readCookie(CSRF_COOKIE)
    if (token) config.headers['X-CSRF-Token'] = token
  }
  return config
})

// ── 401 handling ─────────────────────────────────────────────────────────────
// There is no silent refresh any more. The backend slides the session's idle
// window forward on every request, so an active user never expires; a 401 means
// the session is genuinely gone (idle timeout, absolute cap, revoked, or the
// account was disabled in Entra). The only correct response is to sign in again.
api.interceptors.response.use(
  response => response,
  error => {
    const isAuthProbe = error.config?.url?.includes('/auth/me')
    if (error.response?.status === 401 && !isAuthProbe) {
      redirectToLogin()
    }
    return Promise.reject(error)
  }
)

/** Full page navigation, not a router push — the backend owns the OIDC
 *  redirect and we want any stale in-memory state discarded. */
export function redirectToLogin() {
  window.location.href = '/login'
}

/** Sends the browser to the backend, which redirects on to Microsoft.
 *  The frontend never talks to Entra directly and holds no client secret. */
export function startSignIn() {
  window.location.href = `${API_BASE_URL}/auth/login`
}

export default api
