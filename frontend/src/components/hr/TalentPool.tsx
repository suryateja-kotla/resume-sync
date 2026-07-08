import { useState, useEffect } from 'react'
import { Sparkles, Users, BriefcaseBusiness, ArrowRight } from 'lucide-react'
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
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="rounded-[32px] border border-violet-100 bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-900 p-6 text-white shadow-[0_25px_70px_-30px_rgba(79,70,229,0.7)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
                <Sparkles className="h-4 w-4" />
                Bench availability
              </div>
              <h2 className="text-2xl font-semibold">People ready for the next assignment</h2>
              <p className="mt-2 text-sm text-violet-50">Employees who marked themselves available appear here for quick allocation decisions.</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur">
              <p className="text-violet-50">Available now</p>
              <p className="text-2xl font-semibold">{benchEmployees.length}</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <p className="text-sm text-slate-500">Loading talent pool…</p>
            </div>
          </div>
        ) : benchEmployees.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-[28px] border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Users className="h-7 w-7" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-800">No one on bench right now</h3>
            <p className="text-sm text-slate-500">Employees who mark themselves as available will appear here automatically.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {benchEmployees.map(emp => (
              <div key={emp.employee_id} className="group rounded-[28px] border border-violet-100 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.2)] transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_20px_45px_-25px_rgba(99,102,241,0.45)]">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-semibold text-white shadow-sm">
                    {emp.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800">{emp.name}</p>
                    <a href={`mailto:${emp.email}`} className="block truncate text-sm text-violet-600 hover:underline">{emp.email}</a>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                    {emp.employee_id}
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Designation</p>
                    <p className="text-sm font-medium text-slate-700">{emp.current_designation || '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Current Skill</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${getSkillBadgeClass(emp.current_skill)}`}>
                      {emp.current_skill || '—'}
                    </span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Total Exp</p>
                    <p className="text-sm font-medium text-slate-700">{emp.total_exp ?? '—'} yrs</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Skill Exp</p>
                    <p className="text-sm font-medium text-slate-700">{emp.current_skill_exp ?? '—'} yrs</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50/80 px-3 py-2.5 text-sm text-violet-700">
                  <div className="flex items-center gap-2">
                    <BriefcaseBusiness className="h-4 w-4" />
                    Available for allocation
                  </div>
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
