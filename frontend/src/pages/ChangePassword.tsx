import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
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

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword,     setNewPassword]     = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState(false)

  const { user, clearMustChangePassword, logout } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      await api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password:     newPassword,
      })
      setSuccess(true)
      clearMustChangePassword()
      setTimeout(() => {
        navigate(user?.role === 'HR' ? '/hr-dashboard' : '/employee-dashboard')
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to change password. Please try again.')
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
            {user?.mustChangePassword ? 'Set Your Password' : 'Change Password'}
          </h2>
          <p style={{ marginTop: 8, fontSize: 14.5, color: '#64748b', margin: '8px 0 0' }}>
            Choose a strong password — at least 8 characters, one uppercase, one digit.
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
        {user?.mustChangePassword && !success && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 12, padding: '10px 14px', marginBottom: 18,
            fontSize: 13.5, color: '#92400e', lineHeight: 1.5,
          }}>
            <strong>Action required:</strong> Please set a new password before continuing.
          </div>
        )}

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
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b', margin: '0 0 8px' }}>Password changed!</h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.6, margin: 0 }}>
              Redirecting you to the dashboard…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <PwInput label="Current password" value={currentPassword} onChange={setCurrentPassword} placeholder="Your current password" />
            <PwInput label="New password" value={newPassword} onChange={setNewPassword} placeholder="At least 8 chars, 1 uppercase, 1 digit" />
            <PwInput label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter new password" />

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
                  Saving…
                </>
              ) : 'Change Password'}
            </button>

            {!user?.mustChangePassword && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                style={{
                  width: '100%', padding: '10px', borderRadius: 12, border: 'none',
                  background: 'none', cursor: 'pointer', fontSize: 13.5, color: '#94a3b8', fontWeight: 500,
                }}
              >
                Cancel
              </button>
            )}

            {user?.mustChangePassword && (
              <button
                type="button"
                onClick={() => { logout(); navigate('/login') }}
                style={{
                  width: '100%', padding: '10px', borderRadius: 12, border: 'none',
                  background: 'none', cursor: 'pointer', fontSize: 13.5, color: '#94a3b8', fontWeight: 500,
                }}
              >
                Sign out instead
              </button>
            )}
          </form>
        )}
      </div>
    </AuthLayout>
  )
}
