import { useState, useEffect } from 'react'
import api from '../../api/axios'
import { SkillSummaryRow, getSkillBadgeClass } from '../../types/hr'

interface Props {
  actorEmail?: string
  onExcelGenerating: (v: boolean) => void
  excelGenerating: boolean
}

export default function EmployeeListSection({ actorEmail, onExcelGenerating, excelGenerating }: Props) {
  const [allEmployees, setAllEmployees] = useState<SkillSummaryRow[]>([])
  const [loading, setLoading] = useState(false)
  const [allEmployeesCount, setAllEmployeesCount] = useState(0)
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<SkillSummaryRow | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => {
    fetchAllEmployees()
  }, [])

  const fetchAllEmployees = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/hr/skill-summary-employees')
      if (data.status === 'success') {
        setAllEmployees(data.data)
        setAllEmployeesCount(data.count)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  const generateExcel = async () => {
    if (excelGenerating) return
    onExcelGenerating(true)
    try {
      const { data } = await api.get('/hr/all-employees-excel', {
        params: actorEmail ? { actor_email: actorEmail } : {},
      })
      if (data.status === 'success' && data.excel_filename) {
        window.open(`http://localhost:8000/api/download-excel?filename=${encodeURIComponent(data.excel_filename)}`, '_blank')
      }
    } catch { /* ignore */ }
    finally { onExcelGenerating(false) }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await api.delete(`/hr/employee/${deleteTarget.employee_id}`, {
        params: actorEmail ? { actor_email: actorEmail } : {},
      })
      setAllEmployees(prev => prev.filter(e => e.employee_id !== deleteTarget.employee_id))
      setAllEmployeesCount(prev => prev - 1)
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

  // expose generateExcel so the parent header button can call it
  ;(EmployeeListSection as any)._generateExcel = generateExcel

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading employees...</p>
        </div>
      </div>
    )
  }

  if (allEmployees.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-6 py-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center max-w-xl">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No skill profiles yet</h3>
          <p className="text-gray-400 text-sm">Employees will appear here once they have filled in their Skill Profile.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <h2 className="text-base font-semibold text-gray-800 whitespace-nowrap">
            {filteredEmployees.length}
            {filteredEmployees.length !== allEmployeesCount && ` of ${allEmployeesCount}`}
            {' '}Employee{allEmployeesCount !== 1 ? 's' : ''}
          </h2>
          <div className="relative max-w-xs w-full">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="text"
              value={employeeSearch}
              onChange={e => setEmployeeSearch(e.target.value)}
              placeholder="Search name, skill, email…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400 bg-white"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left bg-gray-50/80">
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">#</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Employee</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Designation</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Current Skill</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Total Exp</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Skill Exp</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Resume</th>
                  <th className="px-5 py-3.5 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEmployees.map((emp, idx) => (
                  <tr key={emp.employee_id} className="hover:bg-blue-50/30 transition-colors duration-100 group">
                    <td className="px-5 py-3.5 text-gray-400 text-xs whitespace-nowrap">{idx + 1}</td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {emp.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 truncate max-w-[160px]">{emp.name}</p>
                          <p className="text-gray-400 text-xs truncate max-w-[160px]">{emp.email}</p>
                          <p className="text-gray-300 text-xs">{emp.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600 whitespace-nowrap max-w-[180px] truncate">
                      {emp.current_designation || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {emp.current_skill ? (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getSkillBadgeClass(emp.current_skill)}`}>
                          {emp.current_skill}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {emp.total_exp !== '' && emp.total_exp !== undefined ? (
                        <span className="text-gray-700 font-medium">{emp.total_exp} <span className="text-gray-400 font-normal text-xs">yrs</span></span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {emp.current_skill_exp !== '' && emp.current_skill_exp !== undefined ? (
                        <span className="text-gray-700 font-medium">{emp.current_skill_exp} <span className="text-gray-400 font-normal text-xs">yrs</span></span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      {emp.resume_path ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-100 text-xs font-medium px-2.5 py-1 rounded-full">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-gray-50 text-gray-400 border border-gray-100 text-xs font-medium px-2.5 py-1 rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <button
                        onClick={() => setDeleteTarget(emp)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition"
                        title="Delete employee"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEmployees.length === 0 && employeeSearch && (
              <div className="py-12 text-center text-gray-400 text-sm">
                No employees match "<span className="font-medium text-gray-600">{employeeSearch}</span>"
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm mx-4 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">Delete Employee</h3>
                <p className="text-gray-400 text-xs">{deleteTarget.employee_id}</p>
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-1">
              Are you sure you want to delete <span className="font-semibold text-gray-800">{deleteTarget.name}</span>?
            </p>
            <p className="text-gray-400 text-xs mb-6">
              This will permanently remove their profile, resume data, skill summary, and generated DOCX. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
