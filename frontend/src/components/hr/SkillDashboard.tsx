import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { SkillRack, SkillEmployee, getSkillBadgeClass } from '../../types/hr'
import { getSkillMeta } from './skillMeta'

const EXP_FILTER_OPTIONS = [
  { value: '', label: 'All Experience' },
  { value: '1', label: '1+ yrs' },
  { value: '2', label: '2+ yrs' },
  { value: '3', label: '3+ yrs' },
  { value: '5', label: '5+ yrs' },
  { value: '8', label: '8+ yrs' },
]

interface Props {
  actorEmail?: string
}

export default function SkillDashboard({ actorEmail }: Props) {
  const [skillRacks, setSkillRacks] = useState<SkillRack[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null)
  const [skillEmployees, setSkillEmployees] = useState<SkillEmployee[]>([])
  const [skillEmployeesLoading, setSkillEmployeesLoading] = useState(false)
  const [excelGenerating, setExcelGenerating] = useState(false)
  const [expFilter, setExpFilter] = useState<string>('')

  useEffect(() => {
    fetchSkillRacks()
  }, [])

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
    await fetchSkillEmployees(skill, '')
  }

  const fetchSkillEmployees = async (skill: string, minExp: string) => {
    setSkillEmployeesLoading(true)
    try {
      const params: Record<string, string> = { skill }
      if (minExp) params.min_skill_exp = minExp
      const { data } = await api.get('/hr/skill-employees', { params })
      if (data.status === 'success') setSkillEmployees(data.data)
    } catch { /* ignore */ }
    finally { setSkillEmployeesLoading(false) }
  }

  const handleExpFilterChange = (minExp: string) => {
    setExpFilter(minExp)
    if (selectedSkill) fetchSkillEmployees(selectedSkill, minExp)
  }

  const closePanel = () => {
    setSelectedSkill(null)
    setSkillEmployees([])
    setExpFilter('')
  }

  const generateExcel = async () => {
    if (!selectedSkill || excelGenerating) return
    setExcelGenerating(true)
    try {
      const params: Record<string, string> = { skill: selectedSkill }
      if (expFilter) params.min_skill_exp = expFilter
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
      {/* Skill racks grid */}
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

      {/* Drill-down panel */}
      {selectedSkill && (
        <div className="fixed inset-0 z-20 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={closePanel} />
          <div className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col">
            <div className="px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getSkillMeta(selectedSkill).text} bg-gray-50 border ${getSkillMeta(selectedSkill).bg.replace('bg-', 'border-').split(' ')[1] ?? 'border-gray-100'}`}>
                    {getSkillMeta(selectedSkill).icon}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">{selectedSkill}</h2>
                    <p className="text-gray-400 text-sm mt-0.5">
                      {skillEmployeesLoading ? 'Loading…' : `${skillEmployees.length} employee${skillEmployees.length !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>
                <button onClick={closePanel} className="text-gray-400 hover:text-gray-600 transition p-2 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Filter by experience</label>
                  <select
                    value={expFilter}
                    onChange={e => handleExpFilterChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 text-sm bg-white"
                  >
                    {EXP_FILTER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pt-5">
                  <button
                    onClick={generateExcel}
                    disabled={skillEmployees.length === 0 || excelGenerating}
                    className="bg-green-50 hover:bg-green-100 disabled:bg-gray-50 disabled:text-gray-300 text-green-700 border border-green-200 disabled:border-gray-200 text-sm font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 whitespace-nowrap"
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export Excel
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              {skillEmployeesLoading ? (
                <div className="flex items-center justify-center py-24">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : skillEmployees.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-12">No employees match this filter.</p>
              ) : (
                <div className="space-y-3">
                  {skillEmployees.map(emp => (
                    <div
                      key={emp.employee_id}
                      className="bg-gray-50 hover:bg-white border border-gray-100 hover:border-blue-100 hover:shadow-sm rounded-2xl p-4 transition-all duration-150"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-800 text-sm">{emp.name}</p>
                          <a href={`mailto:${emp.email}`} className="text-blue-500 text-xs hover:underline">{emp.email}</a>
                        </div>
                        <span className="bg-white border border-gray-200 text-gray-500 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
                          {emp.employee_id}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-gray-400 text-xs mb-0.5">Designation</p>
                          <p className="text-gray-700 font-medium text-sm truncate">{emp.current_designation || '—'}</p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-gray-400 text-xs mb-0.5">Current Skill</p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${getSkillBadgeClass(emp.current_skill)}`}>
                            {emp.current_skill || '—'}
                          </span>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-gray-400 text-xs mb-0.5">Total Exp</p>
                          <p className="text-gray-700 font-medium text-sm">{emp.total_exp} <span className="text-gray-400 text-xs font-normal">yrs</span></p>
                        </div>
                        <div className="bg-white rounded-xl p-3 border border-gray-100">
                          <p className="text-gray-400 text-xs mb-0.5">Skill Exp</p>
                          <p className="text-gray-700 font-medium text-sm">{emp.current_skill_exp} <span className="text-gray-400 text-xs font-normal">yrs</span></p>
                        </div>
                        {emp.primary_skill && (
                          <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="text-gray-400 text-xs mb-0.5">Primary Skill</p>
                            <p className="text-gray-700 font-medium text-sm truncate">{emp.primary_skill}</p>
                          </div>
                        )}
                        {emp.secondary_skill && (
                          <div className="bg-white rounded-xl p-3 border border-gray-100">
                            <p className="text-gray-400 text-xs mb-0.5">Secondary Skill</p>
                            <p className="text-gray-700 font-medium text-sm truncate">{emp.secondary_skill}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
