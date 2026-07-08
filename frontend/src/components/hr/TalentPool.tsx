import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { SkillEmployee, getSkillBadgeClass } from '../../types/hr'

interface Props {
  onCountChange: (count: number) => void
}

export default function TalentPool({ onCountChange }: Props) {
  const [benchEmployees, setBenchEmployees] = useState<SkillEmployee[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchBenchEmployees()
  }, [])

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

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6">
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading talent pool...</p>
          </div>
        </div>
      ) : benchEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-xl mx-auto">
          <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No one on bench right now</h3>
          <p className="text-gray-400 text-sm">Employees who mark themselves as available will appear here automatically.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-5">
            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-sm font-semibold px-3 py-1.5 rounded-full">
              {benchEmployees.length} available
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {benchEmployees.map(emp => (
              <div
                key={emp.employee_id}
                className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-150"
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

                <div className="grid grid-cols-2 gap-2">
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
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                  <span className="text-xs text-amber-600 font-medium">Available for allocation</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
