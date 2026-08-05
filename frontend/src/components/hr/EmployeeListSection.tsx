import { useState } from 'react'
import { Search, Users, Trash2, BriefcaseBusiness, BadgeCheck, Download, Sparkles, CalendarCheck } from 'lucide-react'
import api, { API_BASE_URL } from '../../api/axios'
import { useCachedResource, invalidate } from '../../hooks/useCachedResource'
import { useAuth } from '../../context/AuthContext'
import { SkillSummaryRow, MonthlyResponse, MONTHLY_RESPONSE_BADGE, getSkillBadgeClass } from '../../types/hr'

// actorEmail is gone: the backend records the signed-in user as the audit
// actor, so the client no longer states who it claims to be.
export default function EmployeeListSection() {
  // Delete is ADMIN-only on the backend (require_admin, not require_hr) —
  // 55 people hold the HR persona, including IT/Finance/Ops staff who have
  // no business deleting records. The delete UI mirrors that here, rather
  // than showing HR a button that always 403s.
  const { isAdmin } = useAuth()
  const { data: listData, loading, refresh } = useCachedResource<
    { status: string; data: SkillSummaryRow[]; count: number }
  >('hr:employee-list', '/hr/skill-summary-employees')

  const allEmployees: SkillSummaryRow[] = listData?.status === 'success' ? listData.data : []
  const allEmployeesCount = listData?.count ?? 0

  const [employeeSearch, setEmployeeSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SkillSummaryRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [excelGenerating, setExcelGenerating] = useState(false)

  const generateExcel = async () => {
    if (excelGenerating) return
    setExcelGenerating(true)
    try {
      const { data } = await api.get('/hr/all-employees-excel')
      if (data.status === 'success' && data.excel_filename) {
        window.open(`${API_BASE_URL}/download-excel?filename=${encodeURIComponent(data.excel_filename)}`, '_blank')
      }
    } catch { /* ignore */ }
    finally { setExcelGenerating(false) }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/hr/employee/${deleteTarget.employee_id}`)
      // Deleting changes headcount everywhere, so drop the whole hr: namespace
      // rather than just splicing this row out of the local list — otherwise
      // the metrics and skill racks keep showing the deleted person.
      invalidate('hr:')
      await refresh()
    } catch { /* ignore */ }
    finally {
      setDeleteLoading(false)
      setDeleteTarget(null)
    }
  }

  const filteredEmployees = allEmployees
    .filter(emp => {
      if (!employeeSearch.trim()) return true
      const q = employeeSearch.toLowerCase()
      return (
        emp.name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.employee_id?.toLowerCase().includes(q) ||
        emp.current_skill?.toLowerCase().includes(q) ||
        emp.current_designation?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => (a.employee_id || '').localeCompare(b.employee_id || '', 'en', { numeric: true }))

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="flex min-h-[60vh] items-center justify-center rounded-2xl border border-violet-100 bg-white/80 p-8 shadow-[0_20px_60px_-25px_rgba(109,40,217,0.25)] backdrop-blur">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
            <p className="text-sm text-slate-500">Loading employee profiles…</p>
          </div>
        </div>
      </div>
    )
  }

  if (allEmployees.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-2xl items-center justify-center rounded-2xl border border-violet-100 bg-white/80 p-10 text-center shadow-[0_20px_60px_-25px_rgba(109,40,217,0.25)] backdrop-blur">
          <div>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <BriefcaseBusiness className="h-7 w-7" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-800">No skill profiles yet</h3>
            <p className="text-sm text-slate-500">Employees will appear here once they share their skill profile.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-5 text-white shadow-[0_25px_70px_-30px_rgba(79,70,229,0.7)] sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                  Talent directory
                </div>
                <h2 className="text-xl font-semibold sm:text-2xl">{filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''} in view</h2>
                <p className="mt-2 text-sm text-violet-100">
                  {allEmployeesCount} profiles available with searchable skills and resumes.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={e => setEmployeeSearch(e.target.value)}
                    placeholder="Search name, skill, email…"
                    className="w-full rounded-2xl border border-white/20 bg-white/10 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-violet-100 outline-none ring-0 backdrop-blur transition focus:bg-white/15"
                  />
                </div>
                <button
                  onClick={generateExcel}
                  disabled={excelGenerating}
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {excelGenerating ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {excelGenerating ? 'Generating…' : 'Export Excel'}
                </button>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="min-w-0 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 rounded-2xl bg-violet-50 p-2.5 text-violet-600">
                  <Users className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Total employees</p>
                  <p className="text-xl font-semibold text-slate-800">{allEmployeesCount}</p>
                </div>
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Updated this month</p>
                  <p className="text-xl font-semibold text-slate-800">{allEmployees.filter(emp => emp.monthly_response === 'Updated').length}</p>
                </div>
              </div>
            </div>
            <div className="min-w-0 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 rounded-2xl bg-sky-50 p-2.5 text-sky-600">
                  <BriefcaseBusiness className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">Visible now</p>
                  <p className="text-xl font-semibold text-slate-800">{filteredEmployees.length}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-xl shadow-indigo-950/5 hover:shadow-2xl transition-all duration-200">
            <span className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 z-10" />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Designation</th>
                    <th className="px-5 py-3.5">Current Skill</th>
                    <th className="px-5 py-3.5">Experience</th>
                    <th className="px-5 py-3.5">Monthly Status</th>
                    {isAdmin && <th className="px-5 py-3.5">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.employee_id} className="transition-colors duration-150 hover:bg-violet-50/40">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-semibold text-white">
                            {emp.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{emp.name}</p>
                            <p className="text-xs text-slate-500">{emp.email}</p>
                            <p className="text-[11px] text-slate-400">{emp.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{emp.current_designation || <span className="text-slate-400">—</span>}</td>
                      <td className="px-5 py-4">
                        {emp.current_skill ? (
                          <span className={`inline-block w-fit whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getSkillBadgeClass(emp.current_skill)}`}>
                            {emp.current_skill}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <div className="flex flex-col">
                          <span className="font-medium">{emp.total_exp ?? '—'} yrs</span>
                          <span className="text-xs text-slate-400">Skill exp {emp.current_skill_exp ?? '—'} yrs</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {(() => {
                          const status: MonthlyResponse = emp.monthly_response || 'No Response'
                          return (
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${MONTHLY_RESPONSE_BADGE[status]}`}>
                              {status === 'Updated' && <BadgeCheck className="h-3.5 w-3.5" />}
                              {status}
                            </span>
                          )
                        })()}
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-4">
                          <button
                            onClick={() => setDeleteTarget(emp)}
                            className="inline-flex items-center gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 transition hover:border-rose-200 hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredEmployees.length === 0 && employeeSearch && (
                <div className="py-12 text-center text-sm text-slate-500">
                  No employees match “<span className="font-semibold text-slate-700">{employeeSearch}</span>”.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-800">Delete employee</h3>
                <p className="text-sm text-slate-500">{deleteTarget.employee_id}</p>
              </div>
            </div>
            <p className="mb-1 text-sm text-slate-600">
              Are you sure you want to remove <span className="font-semibold text-slate-800">{deleteTarget.name}</span>?
            </p>
            <p className="mb-6 text-sm text-slate-500">
              This will permanently remove their profile, resume data, skill summary, and generated DOCX.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="flex-1 rounded-2xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {deleteLoading ? 'Removing…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
