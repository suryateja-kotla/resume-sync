import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

type Section = 'search' | 'new-employees' | 'skill-dashboard' | 'employee-list'

interface Candidate {
  employee_id: string
  name: string
  email: string
  currentRole: string
  skills: string[]
  experience: number
  resume_path?: string
  isOnBench?: boolean
}

interface Message {
  id: number
  type: 'user' | 'assistant'
  text?: string
  candidates?: Candidate[]
  excel_filename?: string
  loading?: boolean
}

interface NewEmployee {
  employee_id: string
  name: string
  email: string
  department?: string
}

interface SkillRack {
  skill: string
  employee_count: number
}

interface SkillEmployee {
  employee_id: string
  name: string
  email: string
  current_designation: string
  current_skill: string
  total_exp: number
  current_skill_exp: number
}

interface EmployeeDirectoryRow {
  employee_id: string
  name: string
  email: string
  department?: string
  current_role?: string
  current_designation?: string
  current_skill?: string
  total_exp?: number | string
  current_skill_exp?: number | string
  bench_status?: string
  resume_status?: string
}

function CandidateCard({ candidate }: { candidate: Candidate }) {
  const palettes: { tag: string; glow: string }[] = [
    { tag: 'bg-blue-100 text-blue-700',    glow: 'shadow-[0_0_8px_2px_rgba(59,130,246,0.35)]'  },
    { tag: 'bg-violet-100 text-violet-700', glow: 'shadow-[0_0_8px_2px_rgba(139,92,246,0.35)]' },
    { tag: 'bg-emerald-100 text-emerald-700', glow: 'shadow-[0_0_8px_2px_rgba(16,185,129,0.35)]' },
    { tag: 'bg-amber-100 text-amber-700',   glow: 'shadow-[0_0_8px_2px_rgba(245,158,11,0.35)]'  },
    { tag: 'bg-rose-100 text-rose-700',     glow: 'shadow-[0_0_8px_2px_rgba(244,63,94,0.35)]'   },
    { tag: 'bg-teal-100 text-teal-700',     glow: 'shadow-[0_0_8px_2px_rgba(20,184,166,0.35)]'  },
  ]

  return (
    <div className="relative bg-white rounded-xl p-4 border border-blue-100 shadow-[0_0_16px_4px_rgba(59,130,246,0.12)] hover:shadow-[0_0_24px_6px_rgba(59,130,246,0.22)] transition-shadow duration-300">
      {/* subtle gradient background */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-50/60 via-white to-violet-50/40 pointer-events-none" />

      <div className="relative flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-800 truncate">{candidate.name || candidate.employee_id}</h3>
          <a href={`mailto:${candidate.email}`} className="text-blue-500 text-sm hover:underline">
            {candidate.email}
          </a>
          <p className="text-gray-400 text-xs mt-0.5">ID: {candidate.employee_id}</p>
        </div>
        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ml-2 shadow-[0_0_8px_2px_rgba(59,130,246,0.3)]">
          {candidate.currentRole}
        </span>
        {candidate.isOnBench && (
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ml-2 shadow-[0_0_8px_2px_rgba(16,185,129,0.3)]">
              On Bench
            </span>
          )}
      </div>

      {/* <div className="relative flex flex-wrap gap-1.5">
        {candidate.skills.slice(0, 6).map((skill, i) => {
          const p = palettes[i % palettes.length]
          return (
            <span key={i} className={`${p.tag} ${p.glow} text-xs px-2.5 py-0.5 rounded-full font-medium`}>
              {skill}
            </span>
          )
        })}
        {candidate.skills.length > 6 && (
          <span className="text-gray-400 text-xs px-1 py-0.5">+{candidate.skills.length - 6} more</span>
        )}
      </div> */}
    </div>
  )
}

export default function HRDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('search')

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      type: 'assistant',
      text: "Hi! I'm your HR assistant. Ask me to find candidates — e.g. \"Find candidates with 2+ years Java experience\"",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const msgId = useRef(1)

  // New Employees section
  const [newEmployees, setNewEmployees] = useState<NewEmployee[]>([])
  const [newEmployeesLoading, setNewEmployeesLoading] = useState(false)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [inviteStatus, setInviteStatus] = useState<Record<string, 'sent' | 'error'>>({})

  // Manual invite form — type any Outlook email(s) and send onboarding invites,
  // independent of whether the person already exists in the system.
  const [manualEmailInput, setManualEmailInput] = useState('')
  const [manualSending, setManualSending] = useState(false)
  const [manualResults, setManualResults] = useState<{ email: string; status: 'sent' | 'error'; message?: string }[]>([])

  // Skill Dashboard section
  const [skillRacks, setSkillRacks] = useState<SkillRack[]>([])
  const [skillRacksLoading, setSkillRacksLoading] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [skillEmployees, setSkillEmployees] = useState<SkillEmployee[]>([])
  const [skillEmployeesLoading, setSkillEmployeesLoading] = useState(false)
  const [skillExcelGenerating, setSkillExcelGenerating] = useState(false)

  // Employee List section
  const [allEmployees, setAllEmployees] = useState<EmployeeDirectoryRow[]>([])
  const [allEmployeesLoading, setAllEmployeesLoading] = useState(false)
  const [allEmployeesCount, setAllEmployeesCount] = useState(0)
  const [allExcelGenerating, setAllExcelGenerating] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (section === 'new-employees') fetchNewEmployees()
    if (section === 'skill-dashboard') fetchSkillRacks()
    if (section === 'employee-list') fetchAllEmployees()
  }, [section])

  const fetchNewEmployees = async () => {
    setNewEmployeesLoading(true)
    try {
      const { data } = await api.get('/hr/new-employees')
      if (data.status === 'success') setNewEmployees(data.data)
    } catch { /* ignore */ }
    finally { setNewEmployeesLoading(false) }
  }

  const sendInvite = async (email: string) => {
    setSendingInvite(email)
    try {
      const { data } = await api.post('/hr/send-resume-invite', { email })
      setInviteStatus(prev => ({ ...prev, [email]: data.status === 'success' ? 'sent' : 'error' }))
    } catch {
      setInviteStatus(prev => ({ ...prev, [email]: 'error' }))
    } finally {
      setSendingInvite(null)
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
        const { data } = await api.post('/hr/send-resume-invite', { email })
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
    if (results.every(r => r.status === 'sent')) {
      setManualEmailInput('')
    }
  }

  const fetchSkillRacks = async () => {
    setSkillRacksLoading(true)
    try {
      const { data } = await api.get('/hr/skill-summary')
      if (data.status === 'success') setSkillRacks(data.data)
    } catch { /* ignore */ }
    finally { setSkillRacksLoading(false) }
  }

  const openSkillRack = async (skill: string) => {
    setSelectedSkill(skill)
    setSkillEmployeesLoading(true)
    try {
      const { data } = await api.get('/hr/skill-employees', { params: { skill } })
      if (data.status === 'success') setSkillEmployees(data.data)
    } catch { /* ignore */ }
    finally { setSkillEmployeesLoading(false) }
  }

  const closeSkillRack = () => {
    setSelectedSkill(null)
    setSkillEmployees([])
  }

  const downloadExcel = (filename: string) => {
    window.open(`http://localhost:8000/api/download-excel?filename=${encodeURIComponent(filename)}`, '_blank')
  }

  const generateSkillExcel = async () => {
    if (!selectedSkill || skillExcelGenerating) return
    setSkillExcelGenerating(true)
    try {
      const { data } = await api.get('/hr/skill-employees-excel', { params: { skill: selectedSkill } })
      if (data.status === 'success' && data.excel_filename) {
        downloadExcel(data.excel_filename)
      }
    } catch { /* ignore */ }
    finally { setSkillExcelGenerating(false) }
  }

  const fetchAllEmployees = async () => {
    setAllEmployeesLoading(true)
    try {
      const { data } = await api.get('/hr/all-employees')
      if (data.status === 'success') {
        setAllEmployees(data.data)
        setAllEmployeesCount(data.count)
      }
    } catch { /* ignore */ }
    finally { setAllEmployeesLoading(false) }
  }

  const generateAllEmployeesExcel = async () => {
    if (allExcelGenerating) return
    setAllExcelGenerating(true)
    try {
      const { data } = await api.get('/hr/all-employees-excel')
      if (data.status === 'success' && data.excel_filename) {
        downloadExcel(data.excel_filename)
      }
    } catch { /* ignore */ }
    finally { setAllExcelGenerating(false) }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sendMessage = async () => {
    const query = input.trim()
    if (!query || loading) return
    setInput('')

    const userMsg: Message = { id: msgId.current++, type: 'user', text: query }
    const loadingMsg: Message = { id: msgId.current++, type: 'assistant', loading: true }
    setMessages(prev => [...prev, userMsg, loadingMsg])
    setLoading(true)

    try {
      const { data } = await api.post('/search-candidates', { query })
      const status: string = data.status || 'error'
      const candidates: Candidate[] = data.candidates || []
      const excel_filename: string | undefined = data.excel_filename || undefined
      const agent_message: string | undefined = data.message

      // For text/greeting/pending_confirmation replies, show the message directly
      const isTextReply = status === 'text' || status === 'pending_confirmation'

      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? {
                ...m,
                loading: false,
                text: isTextReply || agent_message
                  ? agent_message
                  : (candidates.length === 0
                      ? 'No candidates found matching your query. Try different skills or experience range.'
                      : `Found ${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}:`),
                candidates: !isTextReply && candidates.length > 0 ? candidates : undefined,
                excel_filename: !isTextReply && candidates.length > 0 ? excel_filename : undefined,
              }
            : m
        )
      )
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === loadingMsg.id
            ? { ...m, loading: false, text: 'Something went wrong. Please try again.' }
            : m
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-white font-bold text-lg">ResumeSync</span>
          </div>
        </div>

        <div className="p-4 border-b border-slate-700">
          <div className="space-y-1">
            {[
              { key: 'search' as Section, label: 'Candidate Search', icon: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z' },
              { key: 'new-employees' as Section, label: 'New Employees', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
              { key: 'skill-dashboard' as Section, label: 'Skill Dashboard', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2h0' },
              { key: 'employee-list' as Section, label: 'Employee List', icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setSection(s.key)}
                className={`w-full flex items-center gap-3 text-left text-sm px-3 py-2.5 rounded-lg transition ${
                  section === s.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                </svg>
                {s.label}
                {s.key === 'new-employees' && newEmployees.length > 0 && (
                  <span className="ml-auto bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {newEmployees.length}
                  </span>
                )}
                {s.key === 'employee-list' && allEmployeesCount > 0 && (
                  <span className="ml-auto bg-slate-700 text-slate-200 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {allEmployeesCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 flex-1">
          {section === 'search' && (
            <>
              <div className="mb-6">
                <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-3">HR Assistant</p>
                <div className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                    <span className="text-slate-300 text-sm font-medium">Active</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    Search candidates by skills, experience, or job requirements using natural language.
                  </p>
                </div>
              </div>

              <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-3">Quick Searches</p>
                <div className="space-y-1">
                  {[
                    'Python developers 3+ years',
                    'React frontend engineers',
                    'Java Spring Boot 2+ years',
                    'AWS cloud architects',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="w-full text-left text-slate-400 hover:text-white hover:bg-slate-800 text-xs px-3 py-2 rounded-lg transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {(user?.fullName || user?.email || 'H')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.fullName || 'HR User'}</p>
              <p className="text-slate-400 text-xs truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-slate-400 hover:text-white hover:bg-slate-800 text-sm px-3 py-2 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-lg font-semibold text-gray-800">
              {section === 'search' && 'Candidate Search'}
              {section === 'new-employees' && 'New Employees'}
              {section === 'skill-dashboard' && 'Skill Dashboard'}
              {section === 'employee-list' && 'Employee List'}
            </h1>
            <p className="text-gray-400 text-sm">
              {section === 'search' && 'Find talent using natural language queries'}
              {section === 'new-employees' && 'Send onboarding invites so new hires can upload their resume'}
              {section === 'skill-dashboard' && 'Click a skill rack to see which employees currently work in that stack'}
              {section === 'employee-list' && `${allEmployeesCount} employee${allEmployeesCount !== 1 ? 's' : ''} across the organization`}
            </p>
          </div>
          {section === 'employee-list' && (
            <button
              onClick={generateAllEmployeesExcel}
              disabled={allEmployees.length === 0 || allExcelGenerating}
              className="bg-green-50 hover:bg-green-100 disabled:bg-gray-50 disabled:text-gray-300 text-green-700 border border-green-200 disabled:border-gray-200 text-sm font-medium px-4 py-2.5 rounded-xl transition flex items-center gap-2 flex-shrink-0"
            >
              {allExcelGenerating ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Generate Excel Report
                </>
              )}
            </button>
          )}
        </header>

        {section === 'search' && (
        <>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.type === 'assistant' && (
                <div className="flex items-start gap-3 max-w-3xl w-full">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    {msg.loading ? (
                      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 inline-flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div
                              key={i}
                              className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                        <span className="text-gray-400 text-sm">Thinking...</span>
                      </div>
                    ) : (
                      <>
                        {msg.text && (
                          <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 mb-3 text-gray-700 text-sm leading-relaxed">
                            {msg.text}
                          </div>
                        )}
                        {msg.candidates && msg.candidates.length > 0 && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {msg.candidates.map((c, i) => (
                                <CandidateCard key={i} candidate={c} />
                              ))}
                            </div>
                            {msg.excel_filename && (
                              <a
                                href={`http://localhost:8000/api/download-excel?filename=${encodeURIComponent(msg.excel_filename)}`}
                                download={msg.excel_filename}
                                className="inline-flex items-center gap-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-sm font-medium px-4 py-2 rounded-lg transition"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Download Excel Report
                              </a>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {msg.type === 'user' && (
                <div className="max-w-lg">
                  <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                    {msg.text}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-gray-100 px-6 py-4 flex-shrink-0">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='e.g. "Find candidates with 2+ years Java experience"'
                rows={1}
                className="w-full resize-none px-4 py-3 pr-12 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 text-sm leading-relaxed transition"
                style={{ maxHeight: '120px' }}
                onInput={e => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-11 h-11 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white rounded-xl flex items-center justify-center transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-gray-400 text-xs text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
        </>
        )}

        {/* New Employees Section */}
        {section === 'new-employees' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Manual invite — type any Outlook email and send an onboarding invite */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-base font-semibold text-gray-800 mb-1">Invite a New Employee</h2>
                <p className="text-gray-400 text-sm mb-4">
                  Enter their Outlook email address. They'll receive a notification — once they click it, they can log in with their email and upload their resume.
                </p>
                <textarea
                  value={manualEmailInput}
                  onChange={e => setManualEmailInput(e.target.value)}
                  placeholder="name@sailssoftware.com&#10;You can paste multiple emails — one per line, or comma-separated"
                  rows={3}
                  className="w-full resize-none px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 text-sm leading-relaxed transition"
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-gray-400 text-xs">
                    {manualEmailInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean).length} email(s) ready to send
                  </p>
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
                        Send Invite{manualEmailInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean).length > 1 ? 's' : ''}
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

              {/* Auto-detected — employees already in the system with no resume yet */}
              <div>
                <p className="text-gray-500 text-sm font-medium mb-3">Pending in System (no resume yet)</p>
                {newEmployeesLoading ? (
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
        )}

        {/* Skill Dashboard Section */}
        {section === 'skill-dashboard' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {skillRacksLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading skill racks...</p>
                </div>
              </div>
            ) : skillRacks.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No skill data yet</h3>
                <p className="text-gray-400 text-sm">Skill racks populate once employees have a Skill Profile filled in.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
                {skillRacks.map(rack => (
                  <button
                    key={rack.skill}
                    onClick={() => openSkillRack(rack.skill)}
                    className="relative bg-white rounded-2xl p-5 border border-blue-100 shadow-[0_0_16px_4px_rgba(59,130,246,0.10)] hover:shadow-[0_0_24px_6px_rgba(59,130,246,0.22)] hover:border-blue-300 transition-all text-left"
                  >
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-50/60 via-white to-violet-50/40 pointer-events-none" />
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-3">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2h0" />
                        </svg>
                      </div>
                      <p className="font-semibold text-gray-800 text-sm truncate" title={rack.skill}>{rack.skill}</p>
                      <p className="text-gray-400 text-xs mt-1">
                        {rack.employee_count} employee{rack.employee_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Employee List Section */}
        {section === 'employee-list' && (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {allEmployeesLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading employee list...</p>
                </div>
              </div>
            ) : allEmployees.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-xl mx-auto">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No employees found</h3>
                <p className="text-gray-400 text-sm">Employee records will show up here once they're added to the system.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-left">
                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">ID</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Email</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Department</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Current Skill</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Total Exp</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Bench Status</th>
                        <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Resume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {allEmployees.map(emp => (
                        <tr key={emp.employee_id} className="hover:bg-gray-50/60 transition">
                          <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{emp.employee_id}</td>
                          <td className="px-4 py-3 text-gray-800 font-medium whitespace-nowrap">{emp.name}</td>
                          <td className="px-4 py-3 text-blue-500 whitespace-nowrap">
                            <a href={`mailto:${emp.email}`} className="hover:underline">{emp.email}</a>
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp.department || '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {emp.current_skill ? (
                              <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">{emp.current_skill}</span>
                            ) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{emp.total_exp !== '' ? `${emp.total_exp} yrs` : '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                              emp.bench_status === 'On Bench' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                            }`}>
                              {emp.bench_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                              emp.resume_status === 'Uploaded' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {emp.resume_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Skill Rack drill-down panel */}
      {selectedSkill && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={closeSkillRack} />
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedSkill}</h2>
                  <p className="text-gray-400 text-sm">
                    {skillEmployees.length} employee{skillEmployees.length !== 1 ? 's' : ''} currently in this skill
                  </p>
                </div>
                <button onClick={closeSkillRack} className="text-gray-400 hover:text-gray-600 transition p-2 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <button
                onClick={generateSkillExcel}
                disabled={skillEmployees.length === 0 || skillExcelGenerating}
                className="w-full bg-green-50 hover:bg-green-100 disabled:bg-gray-50 disabled:text-gray-300 text-green-700 border border-green-200 disabled:border-gray-200 text-sm font-medium px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                {skillExcelGenerating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Generating Excel...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Generate Excel Report
                  </>
                )}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {skillEmployeesLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : skillEmployees.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-12">No employees found for this skill.</p>
              ) : (
                <div className="space-y-3">
                  {skillEmployees.map(emp => (
                    <div key={emp.employee_id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                          <a href={`mailto:${emp.email}`} className="text-blue-500 text-xs hover:underline">{emp.email}</a>
                        </div>
                        <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                          ID: {emp.employee_id}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <p className="text-gray-400 mb-0.5">Current Designation</p>
                          <p className="text-gray-700 font-medium">{emp.current_designation || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Current Skill</p>
                          <p className="text-gray-700 font-medium">{emp.current_skill || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Total Experience</p>
                          <p className="text-gray-700 font-medium">{emp.total_exp} yrs</p>
                        </div>
                        <div>
                          <p className="text-gray-400 mb-0.5">Current Skill Experience</p>
                          <p className="text-gray-700 font-medium">{emp.current_skill_exp} yrs</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
