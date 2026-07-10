import { useState, useEffect } from 'react'
import { Mail, Send, ArrowRight, Sparkles, UserPlus, CheckCircle2, AlertCircle, Clock3 } from 'lucide-react'
import api from '../../api/axios'
import { NewEmployee } from '../../types/hr'

interface Props {
  actorEmail?: string
  onCountChange: (count: number) => void
}

export default function NewEmployeesSection({ actorEmail, onCountChange }: Props) {
  const [newEmployees, setNewEmployees] = useState<NewEmployee[]>([])
  const [loading, setLoading] = useState(false)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [inviteStatus, setInviteStatus] = useState<Record<string, 'sent' | 'error'>>({})
  const [manualEmailInput, setManualEmailInput] = useState('')
  const [manualSending, setManualSending] = useState(false)
  const [manualResults, setManualResults] = useState<{ email: string; status: 'sent' | 'error'; message?: string }[]>([])

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  useEffect(() => {
    fetchNewEmployees()
  }, [])

  const fetchNewEmployees = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/hr/new-employees')
      if (data.status === 'success') {
        setNewEmployees(data.data)
        onCountChange(data.data.length)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const sendInvite = async (email: string) => {
    setSendingInvite(email)
    try {
      const { data } = await api.post('/hr/send-resume-invite', { email, actor_email: actorEmail })
      setInviteStatus(prev => ({ ...prev, [email]: data.status === 'success' ? 'sent' : 'error' }))
    } catch {
      setInviteStatus(prev => ({ ...prev, [email]: 'error' }))
    } finally {
      setSendingInvite(null)
    }
  }

  const sendManualInvites = async () => {
    const emails = Array.from(
      new Set(
        manualEmailInput
          .split(/[\n,;]+/)
          .map(e => e.trim())
          .filter(Boolean)
      )
    )
    if (emails.length === 0 || manualSending) return

    setManualSending(true)
    const results: { email: string; status: 'sent' | 'error'; message?: string }[] = []

    for (const email of emails) {
      if (!emailRegex.test(email)) {
        results.push({ email, status: 'error', message: 'Invalid email format' })
        continue
      }
      try {
        const { data } = await api.post('/hr/send-resume-invite', { email, actor_email: actorEmail })
        results.push({
          email,
          status: data.status === 'success' ? 'sent' : 'error',
          message: data.status !== 'success' ? data.message : undefined,
        })
      } catch {
        results.push({ email, status: 'error', message: 'Request failed' })
      }
    }

    setManualResults(results)
    setManualSending(false)
    if (results.every(r => r.status === 'sent')) setManualEmailInput('')
  }

  const emailCount = manualEmailInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean).length

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-6 text-white shadow-[0_25px_70px_-30px_rgba(79,70,229,0.7)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Welcome new joiners
              </div>
              <h2 className="text-2xl font-semibold">Invite employees to start their resume journey</h2>
              <p className="mt-2 max-w-2xl text-sm text-violet-100">
                Send onboarding invitations by email and keep track of who is still pending their first resume upload.
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-sm text-violet-100">Pending now</p>
              <p className="text-2xl font-semibold">{newEmployees.length}</p>
            </div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-xl shadow-indigo-950/5 hover:shadow-2xl transition-all duration-200">
          <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600" />
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-violet-600" />
            <h3 className="text-lg font-semibold text-slate-800">Send a new invite</h3>
          </div>
          <p className="mb-4 text-sm text-slate-500">
            Enter their work email address. A notification will be sent and they can log in to upload their resume.
          </p>
          <textarea
            value={manualEmailInput}
            onChange={e => setManualEmailInput(e.target.value)}
            placeholder={"name@sailssoftware.com\nPaste multiple addresses — one per line or comma separated"}
            rows={4}
            className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
          />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">{emailCount} email{emailCount === 1 ? '' : 's'} ready to send</p>
            <button
              onClick={sendManualInvites}
              disabled={!manualEmailInput.trim() || manualSending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/20 transition-all duration-200 hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {manualSending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Invite{emailCount > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
          {manualResults.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              {manualResults.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ${r.status === 'sent' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {r.status === 'sent' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <span className="truncate">{r.email}</span>
                  <span className="ml-auto text-xs opacity-80">{r.status === 'sent' ? 'Invite sent' : r.message || 'Failed'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-6 shadow-xl shadow-indigo-950/5 hover:shadow-2xl transition-all duration-200">
          <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600" />
          <div className="mb-4 flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-800">Still waiting for a resume</h3>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            </div>
          ) : newEmployees.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              Everyone already in the system has uploaded a resume. New onboarding entries without a resume will show here automatically.
            </div>
          ) : (
            <div className="space-y-3">
              {newEmployees.map(emp => {
                const status = inviteStatus[emp.email]
                return (
                  <div key={emp.employee_id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 text-base font-semibold text-white">
                        {emp.name?.[0]?.toUpperCase() || 'E'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">{emp.name}</p>
                        <p className="truncate text-sm text-slate-500">{emp.email}</p>
                        <p className="mt-0.5 text-xs text-slate-400">ID: {emp.employee_id}{emp.department ? ` · ${emp.department}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      {status === 'sent' ? (
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4" />
                          Invite sent
                        </span>
                      ) : (
                        <button
                          onClick={() => sendInvite(emp.email)}
                          disabled={sendingInvite === emp.email}
                          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-900/20 transition-all duration-200 hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                        >
                          {sendingInvite === emp.email ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                          Send invite
                        </button>
                      )}
                      {status === 'error' && <p className="text-sm text-rose-500">Failed — try again</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
