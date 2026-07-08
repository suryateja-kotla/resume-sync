import { useState, FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '../api/axios'

function PasswordInput({
  label, value, onChange, placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 transition"
        />
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
        >
          {show ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

  // If no token in URL, show an error immediately
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <p className="text-red-600 mb-4">Invalid or missing reset link.</p>
          <Link to="/forgot-password" className="text-blue-600 hover:underline text-sm">
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        token:        token,
        new_password: newPassword,
      })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2500)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to reset password. The link may have expired.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500 mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">ResumeSync</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {success ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-4">
                <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Password reset!</h2>
              <p className="text-gray-500 text-sm">
                Your password has been updated. Redirecting to sign in...
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">Set new password</h2>
              <p className="text-gray-500 text-sm mb-6">
                Choose a strong password — at least 8 characters, one uppercase letter, and one digit.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <PasswordInput
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="At least 8 chars, 1 uppercase, 1 digit"
                />
                <PasswordInput
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  placeholder="Re-enter new password"
                />

                {error && (
                  <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl border border-red-100">
                    {error}
                    {error.toLowerCase().includes('expired') && (
                      <div className="mt-2">
                        <Link to="/forgot-password" className="font-medium underline">
                          Request a new reset link
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-4 rounded-xl transition duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Resetting...
                    </>
                  ) : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          <div className="text-center mt-6">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-700 hover:underline">
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
