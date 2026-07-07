import { useState, FormEvent, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

const highlights = [
  {
    title: 'AI Resume Intelligence',
    description: 'Extract key skills and experience from every profile in seconds.',
  },
  {
    title: 'Smart Talent Search',
    description: 'Find qualified candidates with faster, more precise filters.',
  },
  {
    title: 'Secure Employee Journeys',
    description: 'Keep onboarding and updates centralized for every team member.',
  },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/login', { email: email.trim() })
      login({
        email: data.email,
        role: data.role,
        employeeId: data.employeeId ?? null,
        fullName: data.fullName ?? null,
      })
      navigate(data.role === 'HR' ? '/hr-dashboard' : '/employee-dashboard')
    } catch {
      setError('Login failed. Please check your email and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(167,139,250,0.2),_transparent_35%),linear-gradient(135deg,_#f8f5ff_0%,_#f5f3ff_45%,_#eef2ff_100%)] px-2 py-2 sm:px-2.5 sm:py-2.5 lg:px-3 lg:py-3">
      <div
        className={`mx-auto flex min-h-[calc(100vh-0.75rem)] w-full overflow-hidden rounded-[1.9rem] border border-violet-200/70 bg-white/70 shadow-[0_40px_140px_rgba(109,40,217,0.18)] backdrop-blur-2xl transition-all duration-700 lg:grid lg:grid-cols-[1.15fr_0.85fr] ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        <div className="relative h-full min-h-[420px] overflow-hidden bg-[linear-gradient(135deg,_rgba(109,40,217,0.98),_rgba(129,140,248,0.95),_rgba(168,85,247,0.95))] px-7 py-8 text-white sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          <div className="absolute left-[-6rem] top-[-6rem] h-56 w-56 rounded-full bg-violet-300/30 blur-3xl"></div>
          <div className="absolute bottom-[-3rem] right-[-2rem] h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
          <div className="absolute bottom-14 left-12 h-28 w-28 rounded-full border border-white/10 bg-white/10 blur-2xl"></div>
          <div className="absolute right-8 top-14 h-36 w-36 rounded-full border border-white/10 bg-indigo-300/10 blur-2xl"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.16),_transparent_32%)]"></div>

          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-sm font-medium text-violet-50 shadow-lg shadow-violet-950/20 backdrop-blur-md">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                ResumeSync Platform
              </div>

              <h1 className="mt-8 max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                Modern hiring, simplified for every team.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-violet-100/90 sm:text-lg">
                Bring resumes, employee updates, and talent discovery into a single calm workspace.
              </p>
            </div>

            <div className="mt-8 grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="auth-float space-y-4 rounded-[1.5rem] border border-white/20 bg-white/12 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:scale-[1.01]">
                {highlights.map((item) => (
                  <div key={item.title} className="flex items-start gap-3 rounded-[1.1rem] border border-white/10 bg-white/10 p-3">
                    <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold">{item.title}</h2>
                      <p className="mt-1 text-sm text-violet-100/80">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="auth-drift rounded-[1.5rem] border border-white/20 bg-white/12 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:scale-[1.01]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold">Built for HR teams</p>
                      <p className="text-sm text-violet-100/80">Faster hiring decisions with a polished, secure experience.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-white/20 bg-gradient-to-br from-white/15 to-white/5 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:scale-[1.01]">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Resume insights</p>
                      <p className="text-sm text-violet-100/80">Live talent pipeline</p>
                    </div>
                    <div className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">+24%</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-400/25 text-sm font-semibold">AR</div>
                      <div>
                        <p className="text-sm font-medium">Alicia Ross</p>
                        <p className="text-xs text-violet-100/75">Senior Frontend Developer</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-400/25 text-sm font-semibold">MJ</div>
                      <div>
                        <p className="text-sm font-medium">Mina Jain</p>
                        <p className="text-xs text-violet-100/75">Product Designer</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex min-h-full items-center bg-[linear-gradient(135deg,_#fcfbff_0%,_#f7f4ff_45%,_#f3f0ff_100%)] px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
          <div className="mx-auto w-full max-w-[36rem]">
            <div className="mb-8 animate-[fadeInUp_0.8s_ease-out]">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-500 text-white shadow-[0_16px_40px_rgba(139,92,246,0.28)]">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c1.657 0 3-1.343 3-3S13.657 5 12 5 9 6.343 9 8s1.343 3 3 3zm0 2c-3.314 0-6 2.686-6 6v1h12v-1c0-3.314-2.686-6-6-6z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Welcome back</h2>
              <p className="mt-3 text-base leading-7 text-slate-500">
                Sign in with your work email to continue to ResumeSync.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 rounded-[1.75rem] border border-violet-100/80 bg-white/75 p-7 shadow-[0_25px_70px_rgba(139,92,246,0.12)] backdrop-blur-xl animate-[fadeInUp_1s_ease-out] sm:p-8 lg:p-9">
              <div className="group">
                <label className="mb-2 block text-sm font-medium text-slate-700 transition-colors group-focus-within:text-violet-600">
                  Work Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center pl-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 shadow-sm">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    className="w-full rounded-[1.15rem] border border-violet-200 bg-white/90 py-4 pl-16 pr-4 text-slate-700 shadow-[0_12px_35px_rgba(139,92,246,0.08)] outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-violet-500 focus:shadow-[0_0_0_4px_rgba(139,92,246,0.16),0_14px_40px_rgba(139,92,246,0.16)]"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-3 rounded-[1.1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-[1.15rem] bg-gradient-to-r from-violet-600 to-indigo-500 px-4 py-4 font-semibold text-white shadow-[0_20px_55px_rgba(109,40,217,0.28)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_24px_65px_rgba(109,40,217,0.32)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  <>
                    Continue
                    <span className="transition group-hover:translate-x-0.5">→</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 flex items-start gap-3 rounded-[1.4rem] border border-violet-100 bg-white/85 p-4 text-sm text-slate-500 shadow-sm backdrop-blur-md animate-[fadeInUp_1.1s_ease-out]">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m0-10V5m7 7h-2m-10 0H3m14.657 8.657l-1.414-1.414M8.757 8.757L7.343 7.343m8.314 0l-1.414 1.414M8.757 15.243l-1.414 1.414" />
                </svg>
              </div>
              <p className="leading-6">Use your company email to securely access your dashboard, talent pool, and employee updates.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}