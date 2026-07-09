import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '../api/axios'
import AuthLayout from '../components/auth/AuthLayout'

function PwInput({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <svg width={18} height={18} fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m6-6V9a6 6 0 10-12 0v2M5 11h14v9H5z" />
          </svg>
        </span>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '13px 44px 13px 44px',
            borderRadius: 14, border: '1.5px solid #e5e7eb',
            fontSize: 14.5, color: '#1f2937', background: '#f9f8ff',
            outline: 'none', transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.background = '#fff' }}
          onBlur={e  => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9f8ff' }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow(v => !v)}
          style={{
            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8',
          }}
        >
          {show ? (
            <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88L3 3m18 18L3 3" />
            </svg>
          ) : (
            <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState(false)

  const navigate = useNavigate()

  if (!token) {
    return (
      <AuthLayout>
        <div style={{
          background: '#fff', borderRadius: 24, border: '1px solid #ede9fe',
          boxShadow: '0 8px 40px rgba(109,40,217,0.08)', padding: '32px 28px', textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: '50%', background: '#fef2f2', marginBottom: 16,
          }}>
            <svg width={24} height={24} fill="none" stroke="#dc2626" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M5.636 18.364A9 9 0 1118.364 5.636 9 9 0 015.636 18.364z" />
            </svg>
          </div>
          <p style={{ fontSize: 15, color: '#dc2626', fontWeight: 600, margin: '0 0 8px' }}>Invalid reset link</p>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 20px' }}>This link is missing or has expired.</p>
          <Link to="/forgot-password" style={{ fontSize: 14, fontWeight: 600, color: '#7c3aed', textDecoration: 'none' }}>
            Request a new reset link →
          </Link>
        </div>
      </AuthLayout>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: newPassword })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {/* Heading */}
      {!success && (
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, color: '#1e1b4b', margin: 0, letterSpacing: '-0.3px' }}>
            Set New Password
          </h2>
          <p style={{ marginTop: 8, fontSize: 14.5, color: '#64748b', margin: '8px 0 0' }}>
            Choose a strong password — at least 8 characters, one uppercase, one digit.
          </p>
        </div>
      )}

      <div style={{
        background: '#fff', borderRadius: 24,
        border: '1px solid #ede9fe',
        boxShadow: '0 8px 40px rgba(109,40,217,0.08)',
        padding: '32px 28px',
      }}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', marginBottom: 16,
            }}>
              <svg width={28} height={28} fill="none" stroke="#16a34a" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', margin: '0 0 8px' }}>Password reset!</h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Your password has been updated. Redirecting to sign in…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <PwInput label="New password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 chars, 1 uppercase, 1 digit" />
            <PwInput label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" />

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 12, padding: '10px 14px', fontSize: 13.5, color: '#dc2626',
              }}>
                {error}
                {error.toLowerCase().includes('expired') && (
                  <div style={{ marginTop: 8 }}>
                    <Link to="/forgot-password" style={{ fontWeight: 600, color: '#dc2626' }}>
                      Request a new reset link →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: '#fff', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {loading ? (
                <>
                  <svg width={18} height={18} className="animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                    <path fill="currentColor" style={{ opacity: 0.75 }} d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  Resetting…
                </>
              ) : 'Reset Password'}
            </button>
          </form>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Link to="/login" style={{ fontSize: 13.5, color: '#94a3b8', textDecoration: 'none', fontWeight: 500 }}>
          ← Back to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}
