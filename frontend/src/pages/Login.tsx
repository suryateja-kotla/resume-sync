import { useState, useEffect } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { startSignIn } from '../api/axios'
import AuthLayout from '../components/auth/AuthLayout'
import { homeFor } from '../components/ProtectedRoute'

/** Messages for the error codes /auth/callback can redirect back with.
 *  Kept deliberately non-specific about *why* someone is not permitted —
 *  the detail is in the server log, and a sign-in page is not the place to
 *  disclose who does or does not have an account. */
const ERROR_MESSAGES: Record<string, string> = {
  intern_not_permanent:
    'Your account is not enabled for sign-in yet. HR will invite you once your employment is confirmed.',
  no_employee_id:
    'Your directory record is missing an Employee ID. Please contact HR to get this added.',
  guest_account: 'Guest accounts cannot access SyncFolio.',
  account_disabled: 'Your account has been disabled. Please contact IT.',
  auth_failed: 'Sign-in could not be completed. Please try again.',
}

export default function Login() {
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const [signingIn, setSigningIn] = useState(false)

  const errorCode = params.get('error')
  const errorMessage = errorCode
    ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.auth_failed
    : ''

  // Reset the button if the user comes back via the browser's back button —
  // otherwise it stays stuck in its "Redirecting…" state.
  useEffect(() => {
    const onPageShow = () => setSigningIn(false)
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#64748b', fontSize: 14,
      }}>
        Loading…
      </div>
    )
  }

  // Already signed in — skip the page entirely.
  if (user) return <Navigate to={homeFor(user.role)} replace />

  const handleSignIn = () => {
    setSigningIn(true)
    // Full navigation to the backend, which builds the PKCE challenge and
    // redirects on to Microsoft. No client secret or token ever reaches here.
    startSignIn()
  }

  return (
    <AuthLayout>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{
          fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800,
          color: '#1e1b4b', margin: 0, letterSpacing: '-0.3px',
        }}>
          Welcome Back
        </h2>
        <p style={{ marginTop: 8, fontSize: 14.5, color: '#64748b', margin: '8px 0 0' }}>
          Sign in with your Sails Software account.
        </p>
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 24,
        border: '1px solid #ede9fe',
        boxShadow: '0 8px 40px rgba(109,40,217,0.08)',
        padding: '32px 28px',
      }}>
        {errorMessage && (
          <div
            role="alert"
            style={{
              marginBottom: 22, padding: '14px 16px',
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 12, color: '#b91c1c', fontSize: 13.5, lineHeight: 1.55,
            }}
          >
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={handleSignIn}
          disabled={signingIn}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12, padding: '14px 20px', borderRadius: 14,
            border: '1px solid #e2e8f0', background: signingIn ? '#f1f5f9' : '#fff',
            color: '#1e1b4b', fontSize: 15, fontWeight: 600,
            cursor: signingIn ? 'default' : 'pointer',
            transition: 'background 120ms, box-shadow 120ms',
            boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
          }}
        >
          {/* Microsoft's four-square mark, inlined to avoid a network fetch */}
          <svg width={20} height={20} viewBox="0 0 21 21" aria-hidden="true">
            <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
            <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
            <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
            <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
          </svg>
          {signingIn ? 'Redirecting…' : 'Sign in with Microsoft'}
        </button>

        <p style={{
          marginTop: 22, marginBottom: 0, fontSize: 12.5,
          color: '#94a3b8', textAlign: 'center', lineHeight: 1.6,
        }}>
          SyncFolio uses your organisation account.<br />
          No separate password is needed.
        </p>
      </div>
    </AuthLayout>
  )
}
