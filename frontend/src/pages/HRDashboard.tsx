import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Section } from '../types/hr'
import CandidateSearch from '../components/hr/CandidateSearch'
import NewEmployeesSection from '../components/hr/NewEmployeesSection'
import SkillDashboard from '../components/hr/SkillDashboard'
import EmployeeListSection from '../components/hr/EmployeeListSection'
import TalentPool from '../components/hr/TalentPool'
import MetricsSection from '../components/hr/MetricsSection'
import AuditLogSection from '../components/hr/AuditLogSection'

export default function HRDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('search')
  const [newEmployeeCount, setNewEmployeeCount] = useState(0)
  const [benchCount, setBenchCount] = useState(0)
  const [allExcelGenerating, setAllExcelGenerating] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const NAV_ITEMS: { key: Section; label: string; icon: string }[] = [
    { key: 'search',         label: 'Candidate Search', icon: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z' },
    { key: 'new-employees',  label: 'New Employees',    icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
    { key: 'skill-dashboard',label: 'Skill Dashboard',  icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2h0' },
    { key: 'employee-list',  label: 'Employee List',    icon: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4' },
    { key: 'talent-pool',    label: 'Talent Pool',      icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
    { key: 'metrics',        label: 'Monitoring',       icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
  ]

  const SECTION_SUBTITLE: Record<Section, string> = {
    'search':          'Find talent using natural language queries',
    'new-employees':   'Send onboarding invites so new hires can upload their resume',
    'skill-dashboard': 'Click a skill rack to see which employees currently work in that stack',
    'employee-list':   'Skill profile directory — all employees from skill summary data',
    'talent-pool':     'Employees currently on bench and available for new project allocation',
    'audit-log':       'Track who changed what, and when, across the system',
    'metrics':         'Live resume coverage, skill distribution and recent activity',
  }

  const SECTION_TITLE: Record<Section, string> = {
    'search':          'Candidate Search',
    'new-employees':   'New Employees',
    'skill-dashboard': 'Skill Dashboard',
    'employee-list':   'Employee List',
    'talent-pool':     'Talent Pool',
    'audit-log':       'Audit Log',
    'metrics':         'Monitoring',
  }

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 flex flex-col flex-shrink-0">
        {/* Logo */}
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

        {/* Navigation */}
        <div className="p-4 border-b border-slate-700">
          <div className="space-y-1">
            {NAV_ITEMS.map(s => (
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
                {s.key === 'new-employees' && newEmployeeCount > 0 && (
                  <span className="ml-auto bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {newEmployeeCount}
                  </span>
                )}
                {s.key === 'talent-pool' && benchCount > 0 && (
                  <span className="ml-auto bg-amber-400 text-amber-900 text-xs font-bold px-1.5 py-0.5 rounded-full">
                    {benchCount}
                  </span>
                )}
              </button>
            ))}
            <button
              onClick={() => setSection('audit-log')}
              className={`w-full flex items-center gap-3 text-left text-xs px-3 py-2 rounded-lg transition mt-1 ${
                section === 'audit-log' ? 'bg-slate-700 text-slate-200' : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
              }`}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              System Audit Log
            </button>
          </div>
        </div>

        {/* Sidebar content area (quick searches for candidate search) */}
        <div className="p-6 flex-1">
          {/* nothing here for non-search sections */}
        </div>

        {/* User footer */}
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
            <h1 className="text-lg font-semibold text-gray-800">{SECTION_TITLE[section]}</h1>
            <p className="text-gray-400 text-sm">{SECTION_SUBTITLE[section]}</p>
          </div>
          {section === 'employee-list' && (
            <button
              onClick={() => (EmployeeListSection as any)._generateExcel?.()}
              disabled={allExcelGenerating}
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
                  Export Excel
                </>
              )}
            </button>
          )}
        </header>

        {/* Section bodies */}
        {section === 'search'          && <CandidateSearch />}
        {section === 'new-employees'   && <NewEmployeesSection actorEmail={user?.email} onCountChange={setNewEmployeeCount} />}
        {section === 'skill-dashboard' && <SkillDashboard actorEmail={user?.email} />}
        {section === 'employee-list'   && (
          <EmployeeListSection
            actorEmail={user?.email}
            excelGenerating={allExcelGenerating}
            onExcelGenerating={setAllExcelGenerating}
          />
        )}
        {section === 'talent-pool'     && <TalentPool onCountChange={setBenchCount} />}
        {section === 'metrics'         && <MetricsSection />}
        {section === 'audit-log'       && <AuditLogSection />}
      </main>
    </div>
  )
}
