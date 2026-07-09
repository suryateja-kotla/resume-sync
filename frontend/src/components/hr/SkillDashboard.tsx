import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { SkillRack, SkillEmployee, getSkillBadgeClass } from '../../types/hr'
import { getSkillMeta } from './skillMeta'

const EXP_FILTER_OPTIONS = [
  { value: '',  label: 'All Experience' },
  { value: '0', label: '0+ yrs' },
  { value: '1', label: '1+ yrs' },
  { value: '2', label: '2+ yrs' },
  { value: '3', label: '3+ yrs' },
  { value: '5', label: '5+ yrs' },
  { value: '8', label: '8+ yrs' },
]

interface Props {
  actorEmail?: string
}

function fmt(date?: string) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
}

export default function SkillDashboard({ actorEmail }: Props) {
  const [skillRacks, setSkillRacks] = useState<SkillRack[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [skillEmployees, setSkillEmployees] = useState<SkillEmployee[]>([])
  const [skillEmployeesLoading, setSkillEmployeesLoading] = useState(false)
  const [excelGenerating, setExcelGenerating] = useState(false)
  const [expFilter, setExpFilter] = useState<string>('')
  const [historyModal, setHistoryModal] = useState<SkillEmployee | null>(null)

  useEffect(() => { fetchSkillRacks() }, [])

  const fetchSkillRacks = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/hr/skill-summary')
      if (data.status === 'success') setSkillRacks(data.data)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const openSkillRack = async (skill: string) => {
    setSelectedSkill(skill)
    setExpFilter('')
    setHistoryModal(null)
    await fetchSkillEmployees(skill, '')
  }

  const fetchSkillEmployees = async (skill: string, minExp: string) => {
    setSkillEmployeesLoading(true)
    try {
      const params: Record<string, string> = { skill }
      if (minExp !== '') params.min_skill_exp = minExp
      const { data } = await api.get('/hr/skill-employees', { params })
      if (data.status === 'success') setSkillEmployees(data.data)
    } catch { /* ignore */ }
    finally { setSkillEmployeesLoading(false) }
  }

  const handleExpFilterChange = (minExp: string) => {
    setExpFilter(minExp)
    setHistoryModal(null)
    if (selectedSkill) fetchSkillEmployees(selectedSkill, minExp)
  }

  const goBack = () => {
    setSelectedSkill(null)
    setSkillEmployees([])
    setExpFilter('')
    setHistoryModal(null)
  }

  const generateExcel = async () => {
    if (!selectedSkill || excelGenerating) return
    setExcelGenerating(true)
    try {
      const params: Record<string, string> = { skill: selectedSkill }
      if (expFilter !== '') params.min_skill_exp = expFilter
      if (actorEmail) params.actor_email = actorEmail
      const { data } = await api.get('/hr/skill-employees-excel', { params })
      if (data.status === 'success' && data.excel_filename) {
        window.open(`http://localhost:8000/api/download-excel?filename=${encodeURIComponent(data.excel_filename)}`, '_blank')
      }
    } catch { /* ignore */ }
    finally { setExcelGenerating(false) }
  }

  // ── Skill rack grid ──────────────────────────────────────────────────────
  if (!selectedSkill) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 max-w-6xl mx-auto">
            {skillRacks.map(rack => {
              const meta = getSkillMeta(rack.skill)
              const hasEmployees = rack.employee_count > 0
              return (
                <button
                  key={rack.skill}
                  onClick={() => hasEmployees && openSkillRack(rack.skill)}
                  disabled={!hasEmployees}
                  className={`group relative rounded-2xl p-5 border text-left transition-all duration-200 ${
                    hasEmployees
                      ? `${meta.bg} hover:shadow-lg hover:-translate-y-0.5 cursor-pointer`
                      : 'bg-gray-50 border-gray-100 opacity-50 cursor-default'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform duration-200 ${
                    hasEmployees ? `${meta.text} bg-white shadow-sm group-hover:scale-110` : 'text-gray-400 bg-white'
                  }`}>
                    {meta.icon}
                  </div>
                  <p className={`font-semibold text-sm leading-tight mb-1 ${hasEmployees ? 'text-gray-800' : 'text-gray-400'}`}>
                    {rack.skill}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${hasEmployees ? meta.text : 'text-gray-300'}`}>
                      {rack.employee_count}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {rack.employee_count === 1 ? 'employee' : 'employees'}
                    </span>
                  </div>
                  {hasEmployees && (
                    <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${meta.text.replace('text-', 'bg-').replace('-700', '-400')}`} />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ── Drill-down view ──────────────────────────────────────────────────────
  const meta = getSkillMeta(selectedSkill)

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition font-medium px-3 py-2 rounded-xl hover:bg-gray-100"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Skills
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${meta.text} bg-white border ${meta.bg.split(' ')[1] ?? 'border-gray-100'} shadow-sm flex-shrink-0`}>
            {meta.icon}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800">{selectedSkill}</h2>
            <p className="text-gray-400 text-xs">
              {skillEmployeesLoading ? 'Loading…' : `${skillEmployees.length} employee${skillEmployees.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-1">
            {EXP_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleExpFilterChange(opt.value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                  expFilter === opt.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={generateExcel}
            disabled={skillEmployees.length === 0 || excelGenerating}
            className="bg-green-50 hover:bg-green-100 disabled:bg-gray-50 disabled:text-gray-300 text-green-700 border border-green-200 disabled:border-gray-200 text-sm font-medium px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap"
          >
            {excelGenerating ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Excel
              </>
            )}
          </button>
        </div>
      </div>

      {/* Employee grid — uniform card heights, history opens in modal */}
      {skillEmployeesLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : skillEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <p className="text-gray-400 text-sm">No employees match this filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {skillEmployees.map(emp => {
            const hasHistory = !!(emp.skill_history && emp.skill_history.length > 0)
            return (
              <div
                key={emp.employee_id}
                className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col"
              >
                {/* Card body */}
                <div className="p-4 flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
                      {emp.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-800 text-sm leading-tight truncate">{emp.name}</p>
                      <a href={`mailto:${emp.email}`} className="text-blue-500 text-xs hover:underline truncate block">{emp.email}</a>
                      <span className="text-gray-400 text-xs">{emp.employee_id}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-0.5">Designation</p>
                      <p className="text-gray-700 font-medium text-xs leading-tight truncate">{emp.current_designation || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-0.5">Current Skill</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getSkillBadgeClass(emp.current_skill)}`}>
                        {emp.current_skill || '—'}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-0.5">Total Exp</p>
                      <p className="text-gray-700 font-medium text-xs">{emp.total_exp ?? '—'} <span className="text-gray-400 font-normal">yrs</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5">
                      <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-0.5">Skill Exp</p>
                      <p className="text-gray-700 font-medium text-xs">{emp.current_skill_exp ?? '—'} <span className="text-gray-400 font-normal">yrs</span></p>
                    </div>
                    {emp.primary_skill && (
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-0.5">Primary</p>
                        <p className="text-gray-700 font-medium text-xs truncate">{emp.primary_skill}</p>
                      </div>
                    )}
                    {emp.secondary_skill && (
                      <div className="bg-gray-50 rounded-xl p-2.5">
                        <p className="text-gray-400 text-[10px] font-medium uppercase tracking-wide mb-0.5">Secondary</p>
                        <p className="text-gray-700 font-medium text-xs truncate">{emp.secondary_skill}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card footer — always same height, opens modal if history exists */}
                <div className="px-4 pb-4">
                  <button
                    onClick={() => hasHistory && setHistoryModal(emp)}
                    className={`w-full flex items-center justify-between text-xs font-medium px-3 py-2 rounded-xl border transition ${
                      hasHistory
                        ? 'text-blue-600 border-blue-100 bg-blue-50 hover:bg-blue-100 hover:border-blue-200 cursor-pointer'
                        : 'text-gray-300 border-gray-100 bg-gray-50 cursor-default'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {hasHistory ? `Skill History (${emp.skill_history!.length})` : 'No skill history'}
                    </span>
                    {hasHistory && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Skill history modal */}
      {historyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={() => setHistoryModal(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {historyModal.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{historyModal.name}</p>
                  <p className="text-gray-400 text-xs">{historyModal.employee_id}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryModal(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition flex-shrink-0 ml-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Current skill row */}
            <div className="px-5 py-3 border-b border-gray-50 flex items-center gap-2">
              <span className="text-gray-400 text-xs">Current:</span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getSkillBadgeClass(historyModal.current_skill)}`}>
                {historyModal.current_skill || '—'}
              </span>
              <span className="text-gray-300 text-xs ml-auto">→ previously</span>
            </div>

            {/* History list */}
            <div className="px-5 py-4 max-h-72 overflow-y-auto space-y-3">
              {[...historyModal.skill_history!].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    {i < historyModal.skill_history!.length - 1 && (  // still correct after reverse
                      <div className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: '24px' }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getSkillBadgeClass(h.skill)}`}>
                        {h.skill}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">{h.skill_exp} yrs</span>
                    </div>
                    {h.designation && (
                      <p className="text-gray-500 text-[11px] truncate">{h.designation}</p>
                    )}
                    <p className="text-gray-400 text-[10px] tabular-nums mt-0.5">
                      {fmt(h.from)} → {fmt(h.to)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
