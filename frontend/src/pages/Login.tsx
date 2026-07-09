import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import AuthLayout from '../components/auth/AuthLayout'

export default function Login() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const { login } = useAuth()
  const navigate  = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/auth/login', {
        email:    email.trim().toLowerCase(),
        password,
      })
      login(
        {
          email:               data.email,
          role:                data.role,
          employeeId:          data.employee_id ?? null,
          fullName:            data.full_name ?? null,
          mustChangePassword:  data.must_change_password ?? false,
        },
        data.access_token,
        data.refresh_token,
      )
      if (data.must_change_password) { navigate('/change-password'); return }
      navigate(data.role === 'HR' ? '/hr-dashboard' : '/employee-dashboard')
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError('Too many login attempts. Please wait 15 minutes and try again.')
      } else if (err.response?.status === 403) {
        setError(err.response?.data?.detail || 'Your account is inactive. Contact HR.')
      } else {
        setError('Invalid email or password.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      {/* heading — always centered */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, color: '#1e1b4b', margin: 0, letterSpacing: '-0.3px' }}>
          Welcome Back
        </h2>
        <p style={{ marginTop: 8, fontSize: 14.5, color: '#64748b', margin: '8px 0 0' }}>
          Sign in to continue to SyncFolio.
        </p>
      </div>

      {/* form card */}
      <div style={{
        background: '#fff',
        borderRadius: 24,
        border: '1px solid #ede9fe',
        boxShadow: '0 8px 40px rgba(109,40,217,0.08)',
        padding: '32px 28px',
      }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
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
                  padding: '13px 16px 13px 46px',
                  borderRadius: 14, border: '1.5px solid #e5e7eb',
                  fontSize: 14.5, color: '#1f2937', background: '#f9f8ff',
                  outline: 'none', transition: 'border-color 0.15s',
                }}
                onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.background = '#fff' }}
                onBlur={e  => { e.target.style.borderColor = '#e5e7eb'; e.target.style.background = '#f9f8ff' }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                <svg width={18} height={18} fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m6-6V9a6 6 0 10-12 0v2M5 11h14v9H5z" />
                </svg>
              </span>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '13px 46px 13px 46px',
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
                onClick={() => setShowPass(v => !v)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#94a3b8',
                }}
              >
                {showPass ? (
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

            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <Link to="/forgot-password" style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', textDecoration: 'none' }}>
                Forgot Password?
              </Link>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 12, padding: '10px 14px',
              fontSize: 13.5, color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              borderRadius: 14, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              background: loading ? '#a78bfa' : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: '#fff', fontWeight: 700, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? (
              <>
                <svg width={18} height={18} className="animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
                  <path fill="currentColor" style={{ opacity: 0.75 }} d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                </svg>
                Signing In…
              </>
            ) : 'Sign In'}
          </button>
        </form>
      </div>

      {/* footer note */}
      <div style={{
        marginTop: 20,
        background: '#fff', border: '1px solid #ede9fe',
        borderRadius: 18, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 2px 12px rgba(109,40,217,0.05)',
      }}>
        <div style={{
          flexShrink: 0, width: 40, height: 40, borderRadius: 12,
          background: '#f3f0ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width={20} height={20} fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M5.636 18.364A9 9 0 1118.364 5.636 9 9 0 015.636 18.364z" />
          </svg>
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5, color: '#374151' }}>Secure Login</p>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#94a3b8', lineHeight: 1.5 }}>
            Use your company credentials to securely access your SyncFolio dashboard.
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}
