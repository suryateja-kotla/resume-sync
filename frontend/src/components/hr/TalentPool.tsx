import { useState, useEffect, useMemo } from 'react'
import api from '../../api/axios'
import { SkillEmployee, getSkillBadgeClass } from '../../types/hr'

const EXP_FILTERS = [
  { value: 0,  label: 'All' },
  { value: 1,  label: '1+ yrs' },
  { value: 2,  label: '2+ yrs' },
  { value: 3,  label: '3+ yrs' },
  { value: 5,  label: '5+ yrs' },
  { value: 8,  label: '8+ yrs' },
]

interface Props {
  onCountChange: (count: number) => void
}

export default function TalentPool({ onCountChange }: Props) {
  const [benchEmployees, setBenchEmployees] = useState<SkillEmployee[]>([])
  const [loading, setLoading] = useState(false)
  const [skillFilter, setSkillFilter] = useState<string>('')
  const [expFilter, setExpFilter] = useState<number>(0)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchBenchEmployees() }, [])

  const fetchBenchEmployees = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/hr/bench-employees')
      if (data.status === 'success') {
        setBenchEmployees(data.data)
        onCountChange(data.data.length)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  // Unique skills from bench employees, sorted alphabetically
  const availableSkills = useMemo(() => {
    const skills = new Set(benchEmployees.map(e => e.current_skill).filter(Boolean))
    return Array.from(skills).sort()
  }, [benchEmployees])

  const filtered = useMemo(() => {
    return benchEmployees.filter(emp => {
      if (skillFilter && emp.current_skill !== skillFilter) return false
      if (expFilter > 0 && (emp.total_exp ?? 0) < expFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          emp.name?.toLowerCase().includes(q) ||
          emp.email?.toLowerCase().includes(q) ||
          emp.employee_id?.toLowerCase().includes(q) ||
          emp.current_skill?.toLowerCase().includes(q) ||
          emp.current_designation?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [benchEmployees, skillFilter, expFilter, search])

  const hasActiveFilter = skillFilter !== '' || expFilter > 0 || search.trim() !== ''

  const clearFilters = () => {
    setSkillFilter('')
    setExpFilter(0)
    setSearch('')
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading talent pool...</p>
        </div>
      </div>
    )
  }

  if (benchEmployees.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No one on bench right now</h3>
          <p className="text-gray-400 text-sm">Employees who mark themselves as available will appear here automatically.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">

      {/* ── Filter bar ── */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-5 space-y-3">

        {/* Top row: search + count + clear */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, skill, ID…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-gray-800 placeholder-gray-400 bg-white"
            />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap">
              {filtered.length}{filtered.length !== benchEmployees.length ? ` of ${benchEmployees.length}` : ''} available
            </span>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition whitespace-nowrap"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Skill filter pills */}
        {availableSkills.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">Skill</span>
            <button
              onClick={() => setSkillFilter('')}
              className={`text-xs font-medium px-3 py-1 rounded-lg border transition ${
                skillFilter === ''
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              All
            </button>
            {availableSkills.map(skill => (
              <button
                key={skill}
                onClick={() => setSkillFilter(prev => prev === skill ? '' : skill)}
                className={`text-xs font-medium px-3 py-1 rounded-lg border transition ${
                  skillFilter === skill
                    ? `${getSkillBadgeClass(skill)} border-current`
                    : 'text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        )}

        {/* Experience filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">Exp</span>
          <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-1 py-1">
            {EXP_FILTERS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setExpFilter(opt.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  expFilter === opt.value
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Employee grid ── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
          <p className="text-gray-400 text-sm">No employees match these filters.</p>
          <button onClick={clearFilters} className="mt-3 text-xs text-amber-600 hover:underline font-medium">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(emp => (
            <div
              key={emp.employee_id}
              className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-150 flex flex-col"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {emp.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-800 text-sm truncate">{emp.name}</p>
                  <a href={`mailto:${emp.email}`} className="text-blue-500 text-xs hover:underline truncate block">{emp.email}</a>
                </div>
                <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0">
                  {emp.employee_id}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 flex-1">
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-gray-400 text-xs mb-0.5">Designation</p>
                  <p className="text-gray-700 font-medium text-xs truncate">{emp.current_designation || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-gray-400 text-xs mb-0.5">Current Skill</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSkillBadgeClass(emp.current_skill)}`}>
                    {emp.current_skill || '—'}
                  </span>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-gray-400 text-xs mb-0.5">Total Exp</p>
                  <p className="text-gray-700 font-medium text-xs">{emp.total_exp ?? '—'} <span className="text-gray-400 font-normal">yrs</span></p>
                </div>
                <div className="bg-gray-50 rounded-xl p-2.5">
                  <p className="text-gray-400 text-xs mb-0.5">Skill Exp</p>
                  <p className="text-gray-700 font-medium text-xs">{emp.current_skill_exp ?? '—'} <span className="text-gray-400 font-normal">yrs</span></p>
                </div>
                {emp.primary_skill && (
                  <div className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-gray-400 text-xs mb-0.5">Primary Skill</p>
                    <p className="text-gray-700 font-medium text-xs truncate">{emp.primary_skill}</p>
                  </div>
                )}
                {emp.secondary_skill && (
                  <div className="bg-gray-50 rounded-xl p-2.5">
                    <p className="text-gray-400 text-xs mb-0.5">Secondary Skill</p>
                    <p className="text-gray-700 font-medium text-xs truncate">{emp.secondary_skill}</p>
                  </div>
                )}
              </div>

              <div className="mt-3 pt-3 border-t border-amber-50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                <span className="text-xs text-amber-600 font-medium">Available for allocation</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
