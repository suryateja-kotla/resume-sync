import { useState, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import AuthLayout from '../components/auth/AuthLayout'

export default function ForgotPassword() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() })
      setSent(true)
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Too many requests. Please wait an hour before trying again.')
      } else {
        setSent(true)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {/* Heading */}
      {!sent && (
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, color: '#1e1b4b', margin: 0, letterSpacing: '-0.3px' }}>
            Forgot Password?
          </h2>
          <p style={{ marginTop: 8, fontSize: 14.5, color: '#64748b', margin: '8px 0 0' }}>
            Enter your work email and we'll send you a reset link.
          </p>
        </div>
      )}

      {/* Card */}
      <div style={{
        background: '#fff', borderRadius: 24,
        border: '1px solid #ede9fe',
        boxShadow: '0 8px 40px rgba(109,40,217,0.08)',
        padding: '32px 28px',
      }}>
        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: '50%',
              background: '#f0fdf4', marginBottom: 16,
            }}>
              <svg width={28} height={28} fill="none" stroke="#16a34a" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', margin: '0 0 8px' }}>Check your inbox</h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: '0 0 6px' }}>
              If <strong>{email}</strong> is registered, a reset link has been sent.
              The link expires in 30 minutes.
            </p>
            <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 20px' }}>
              Didn't receive it? Check your spam folder or try again.
            </p>
            <button
              onClick={() => { setSent(false); setEmail('') }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13.5, fontWeight: 600, color: '#7c3aed',
              }}
            >
              Try a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <svg width={18} height={18} fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@sailssoftware.com"
                  required
                  autoFocus
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '13px 16px 13px 44px',
                    borderRadius: 14, border: '1.5px solid #e5e7eb',
                    fontSize: 14.5, color: '#1f2937', background: '#f9f8ff',
                    outline: 'none', transition: 'border-color 0.15s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.background = '#fff' }}
                  onBlur={e  => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9f8ff' }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 12, padding: '10px 14px', fontSize: 13.5, color: '#dc2626',
              }}>
                {error}
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
                  Sending…
                </>
              ) : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>

      {/* Back link */}
      <div style={{ textAlign: 'center', marginTop: 20 }}>
        <Link to="/login" style={{ fontSize: 13.5, color: '#94a3b8', textDecoration: 'none', fontWeight: 500 }}>
          ← Back to sign in
        </Link>
      </div>
    </AuthLayout>
  )
}
