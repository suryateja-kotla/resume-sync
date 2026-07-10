import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { Sparkles } from 'lucide-react'
import api from '../../api/axios'
import { Candidate, Message } from '../../types/hr'

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
    <div className="relative bg-white rounded-xl p-4 border border-violet-100 shadow-[0_0_16px_4px_rgba(139,92,246,0.12)] hover:shadow-[0_0_24px_6px_rgba(139,92,246,0.22)] transition-shadow duration-300">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-violet-50/60 via-white to-indigo-50/40 pointer-events-none" />
      <div className="relative flex items-start justify-between mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{candidate.name || candidate.employee_id}</h3>
          <a href={`mailto:${candidate.email}`} className="text-violet-600 text-sm hover:underline">
            {candidate.email}
          </a>
          <p className="text-slate-400 text-xs mt-0.5">ID: {candidate.employee_id}</p>
        </div>
        <span className="bg-violet-100 text-violet-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ml-2 shadow-[0_0_8px_2px_rgba(139,92,246,0.3)]">
          {candidate.currentRole}
        </span>
        {candidate.isOnBench && (
          <span className="bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ml-2 shadow-[0_0_8px_2px_rgba(16,185,129,0.3)]">
            On Bench
          </span>
        )}
      </div>
      <div className="relative flex flex-wrap gap-1.5">
        {palettes && null}
      </div>
    </div>
  )
}

export default function CandidateSearch() {
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-6 text-white shadow-[0_25px_70px_-30px_rgba(79,70,229,0.7)]">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
            <Sparkles className="h-4 w-4" />
            AI-powered search
          </div>
          <h2 className="text-2xl font-semibold">Candidate Search</h2>
          <p className="mt-2 text-sm text-violet-100">Find talent using natural language queries.</p>
        </div>
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.type === 'assistant' && (
              <div className="flex items-start gap-3 max-w-3xl w-full">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div className="flex-1">
                  {msg.loading ? (
                    <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100 inline-flex items-center gap-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                        ))}
                      </div>
                      <span className="text-slate-400 text-sm">Thinking...</span>
                    </div>
                  ) : (
                    <>
                      {msg.text && (
                        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-slate-100 mb-3 text-slate-700 text-sm leading-relaxed">
                          {msg.text}
                        </div>
                      )}
                      {msg.candidates && msg.candidates.length > 0 && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {msg.candidates.map((c, i) => <CandidateCard key={i} candidate={c} />)}
                          </div>
                          {msg.excel_filename && (
                            <a
                              href={`http://localhost:8000/api/download-excel?filename=${encodeURIComponent(msg.excel_filename)}`}
                              download={msg.excel_filename}
                              className="inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-medium px-4 py-2 rounded-lg transition"
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
                <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed shadow-sm">
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="bg-white border-t border-slate-100 px-6 py-4 flex-shrink-0">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='e.g. "Find candidates with 2+ years Java experience"'
              rows={1}
              className="w-full resize-none px-4 py-3 pr-12 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-slate-800 placeholder-slate-400 text-sm leading-relaxed transition"
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
            className="flex-shrink-0 w-11 h-11 bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 hover:scale-[1.03] disabled:from-slate-200 disabled:via-slate-200 disabled:to-slate-200 disabled:shadow-none disabled:hover:scale-100 text-white rounded-xl flex items-center justify-center transition-all duration-200 shadow-md shadow-indigo-900/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-slate-400 text-xs text-center mt-2">Press Enter to send · Shift+Enter for new line</p>
      </div>
    </>
  )
}

export function CandidateSearchSidebar({ setInput }: { setInput: (q: string) => void }) {
  return (
    <>
      <div className="mb-6">
        <p className="text-slate-400 text-xs uppercase tracking-wider font-medium mb-3">HR Assistant</p>
        <div className="bg-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
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
  )
}
