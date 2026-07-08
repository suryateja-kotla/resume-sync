import { useState, useEffect } from 'react'
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
    <div className="flex-1 overflow-y-auto px-6 py-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Manual invite box */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Invite a New Employee</h2>
          <p className="text-gray-400 text-sm mb-4">
            Enter their Outlook email address. They'll receive a notification — once they click it, they can log in with their email and upload their resume.
          </p>
          <textarea
            value={manualEmailInput}
            onChange={e => setManualEmailInput(e.target.value)}
            placeholder={"name@sailssoftware.com\nYou can paste multiple emails — one per line, or comma-separated"}
            rows={3}
            className="w-full resize-none px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 text-sm leading-relaxed transition"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-gray-400 text-xs">{emailCount} email(s) ready to send</p>
            <button
              onClick={sendManualInvites}
              disabled={!manualEmailInput.trim() || manualSending}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition flex items-center gap-2"
            >
              {manualSending ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Send Invite{emailCount > 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
          {manualResults.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-4">
              {manualResults.map((r, i) => (
                <div key={i} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                  r.status === 'sent' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {r.status === 'sent'
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />}
                  </svg>
                  <span className="truncate">{r.email}</span>
                  <span className="text-xs opacity-75 ml-auto flex-shrink-0">
                    {r.status === 'sent' ? 'Invite sent' : (r.message || 'Failed')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending employees list */}
        <div>
          <p className="text-gray-500 text-sm font-medium mb-3">Pending in System (no resume yet)</p>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : newEmployees.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
              <p className="text-gray-400 text-sm">
                Everyone already in the system has uploaded a resume. Employees added to HR records without a resume will show up here automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {newEmployees.map(emp => {
                const status = inviteStatus[emp.email]
                return (
                  <div key={emp.employee_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {emp.name?.[0]?.toUpperCase() || 'E'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{emp.name}</p>
                        <p className="text-gray-500 text-xs truncate">{emp.email}</p>
                        <p className="text-gray-400 text-xs mt-0.5">
                          ID: {emp.employee_id}{emp.department ? ` · ${emp.department}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {status === 'sent' ? (
                        <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-100 text-sm font-medium px-4 py-2 rounded-xl">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Invite Sent
                        </span>
                      ) : (
                        <button
                          onClick={() => sendInvite(emp.email)}
                          disabled={sendingInvite === emp.email}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium px-4 py-2 rounded-xl transition flex items-center gap-2"
                        >
                          {sendingInvite === emp.email ? (
                            <>
                              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Sending...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              Send Invite
                            </>
                          )}
                        </button>
                      )}
                      {status === 'error' && (
                        <p className="text-red-500 text-xs mt-1.5 text-right">Failed — try again</p>
                      )}
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
