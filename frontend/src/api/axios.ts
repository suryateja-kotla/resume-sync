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
// by default. The backend hands us a token inside the JSON body of /auth/me —
// an authenticated response only our own JS ever sees — and we hold it here in
// memory, echoing it back in a header on every state-changing request.
//
// This used to be a second, JS-readable cookie instead (the classic
// double-submit pattern), which silently never worked: a cookie set by the
// backend's origin is invisible to `document.cookie` running on the
// frontend's different *.run.app origin, regardless of SameSite — that's a
// same-origin-policy rule about script access to cookies, a completely
// separate boundary from the one SameSite governs. Every unsafe request was
// missing the header as a result, which is why this exists now: a JSON
// response body, unlike a cookie, does cross that boundary correctly.
//
// setCsrfToken is called from AuthContext after each /auth/me — on load, and
// implicitly whenever the session is confirmed fresh.
let csrfToken: string | null = null
const UNSAFE_METHODS = ['post', 'put', 'patch', 'delete']

export function setCsrfToken(token: string | null) {
  csrfToken = token
}

api.interceptors.request.use(config => {
  if (UNSAFE_METHODS.includes((config.method ?? '').toLowerCase()) && csrfToken) {
    config.headers['X-CSRF-Token'] = csrfToken
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
      setCsrfToken(null)
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
