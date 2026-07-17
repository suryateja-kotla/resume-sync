import { useState, useEffect } from 'react'
import { Download, Filter, Sparkles, ArrowLeft, History } from 'lucide-react'
import api from '../../api/axios'
import { SkillRack, SkillEmployee, getSkillBadgeClass } from '../../types/hr'
import { getSkillMeta } from './skillMeta'
import SkillChips from './SkillChips'

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

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-5">
          {!selectedSkill && (
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-5 text-white shadow-[0_25px_70px_-30px_rgba(79,70,229,0.7)] sm:p-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                  Skill intelligence
                </div>
                <h2 className="text-xl font-semibold sm:text-2xl">Browse capabilities by skill rack</h2>
                <p className="mt-2 text-sm text-violet-100">Open any skill group to view matching employees and export the list instantly.</p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur">
                <p className="text-violet-100">Available skill groups</p>
                <p className="text-xl font-semibold">{skillRacks.length}</p>
              </div>
            </div>
          </div>
          )}

          {selectedSkill ? null : loading ? (
            <div className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
              <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                <p className="text-sm text-slate-500">Loading skill racks…</p>
              </div>
            </div>
          ) : skillRacks.length === 0 ? (
            <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <h3 className="mb-2 text-lg font-semibold text-slate-800">No skill data yet</h3>
              <p className="text-sm text-slate-500">Skill racks populate once employees have filled in their skill profile.</p>
            </div>
          ) : (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {skillRacks.map(rack => {
                const meta = getSkillMeta(rack.skill)
                const hasEmployees = rack.employee_count > 0
                return (
                  <button
                    key={rack.skill}
                    onClick={() => hasEmployees && openSkillRack(rack.skill)}
                    disabled={!hasEmployees}
                    className={`group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all duration-300 ${
                      hasEmployees
                        ? 'cursor-pointer hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_22px_50px_-24px_rgba(79,70,229,0.5)]'
                        : 'cursor-default border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1 ${hasEmployees ? 'bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600' : 'bg-slate-300'}`} />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                    <div className="relative z-10">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition-all duration-300 ${hasEmployees ? `${meta.bg} ${meta.text} shadow-sm group-hover:scale-110 group-hover:shadow-md` : 'border-slate-200 bg-white text-slate-400'}`}>
                        {meta.icon}
                      </div>
                      <p className={`mt-4 text-base font-semibold leading-tight ${hasEmployees ? 'text-slate-800' : 'text-slate-400'}`}>{rack.skill}</p>
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/70 bg-white/75 px-3 py-2.5 text-sm shadow-sm">
                        <span className={`h-2.5 w-2.5 rounded-full ${hasEmployees ? 'bg-violet-500' : 'bg-slate-300'}`} />
                        <span className="text-slate-600">{rack.employee_count} {rack.employee_count === 1 ? 'engineer' : 'engineers'}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {selectedSkill && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex-shrink-0 border-b border-slate-200 bg-gradient-to-r from-white via-violet-50/40 to-indigo-50/30 px-4 py-4 sm:px-6 sm:py-5">
              {/* Back to skill racks */}
              <button
                onClick={goBack}
                className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to skills
              </button>

              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                  <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border ${getSkillMeta(selectedSkill).bg}`}>
                    <div className={getSkillMeta(selectedSkill).text}>{getSkillMeta(selectedSkill).icon}</div>
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-semibold text-slate-800">{selectedSkill}</h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {skillEmployeesLoading ? 'Loading…' : `${skillEmployees.length} employee${skillEmployees.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Filter by experience</label>
                  <div className="relative">
                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={expFilter}
                      onChange={e => handleExpFilterChange(e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
                    >
                      {EXP_FILTER_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  onClick={generateExcel}
                  disabled={skillEmployees.length === 0 || excelGenerating}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  {excelGenerating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {excelGenerating ? 'Generating…' : 'Export Excel'}
                </button>
              </div>
            </div>

            <div className="px-4 py-5 sm:px-6">
              {skillEmployeesLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
                </div>
              ) : skillEmployees.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">No employees match this filter.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {skillEmployees.map(emp => (
                    <div key={emp.employee_id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-sm">
                      <div className="mb-3 flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-semibold text-white">
                          {emp.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800">{emp.name}</p>
                          <a href={`mailto:${emp.email}`} className="block truncate text-sm text-violet-600 hover:underline">{emp.email}</a>
                        </div>
                        <span className="flex-shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-500">
                          {emp.employee_id}
                        </span>
                      </div>
                      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="mb-0.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Designation</p>
                          <p className="text-sm font-medium text-slate-700">{emp.current_designation || '—'}</p>
                        </div>
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Current Skill</p>
                          <SkillChips value={emp.current_skill} maxChips={2} />
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="mb-0.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Total Exp</p>
                          <p className="text-sm font-medium text-slate-700">{emp.total_exp} yrs</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="mb-0.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Skill Exp</p>
                          <p className="text-sm font-medium text-slate-700">{emp.current_skill_exp} yrs</p>
                        </div>
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Primary Skill</p>
                          <SkillChips value={emp.primary_skill} maxChips={2} />
                        </div>
                        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Secondary Skill</p>
                          <SkillChips value={emp.secondary_skill} maxChips={2} />
                        </div>
                      </div>

                      {emp.skill_history && emp.skill_history.length > 0 && (
                        <button
                          onClick={() => setHistoryModal(emp)}
                          className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-semibold text-violet-700 transition hover:bg-violet-100"
                        >
                          <History className="h-4 w-4" />
                          View Skill History
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      {historyModal && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
                  <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-md" onClick={() => setHistoryModal(null)} />
                  <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-white via-violet-50/40 to-indigo-50/30 px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{historyModal.name}</p>
                        <p className="text-xs text-slate-400">Skill History</p>
                      </div>
                      <button
                        onClick={() => setHistoryModal(null)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition flex-shrink-0 ml-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Current skill row */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <span className="text-slate-400 text-xs">Current:</span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${getSkillBadgeClass(historyModal.current_skill)}`}>
                {historyModal.current_skill || '—'}
              </span>
              <span className="text-slate-300 text-xs ml-auto">→ previously</span>
            </div>

            {/* History list */}
            <div className="px-5 py-4 max-h-72 overflow-y-auto space-y-3">
              {[...historyModal.skill_history!].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  {/* Timeline dot + line */}
                  <div className="flex flex-col items-center flex-shrink-0 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                    {i < historyModal.skill_history!.length - 1 && (  // still correct after reverse
                      <div className="w-px flex-1 bg-slate-200 mt-1" style={{ minHeight: '24px' }} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getSkillBadgeClass(h.skill)}`}>
                        {h.skill}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">{h.skill_exp} yrs</span>
                    </div>
                    {h.designation && (
                      <p className="text-slate-500 text-[11px] truncate">{h.designation}</p>
                    )}
                    <p className="text-slate-400 text-[10px] tabular-nums mt-0.5">
                      {fmt(h.from)} → {fmt(h.to)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
