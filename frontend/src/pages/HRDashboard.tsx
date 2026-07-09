import { useState } from 'react'
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [newEmployeeCount, setNewEmployeeCount] = useState(0)
  const [benchCount, setBenchCount] = useState(0)
  const [allExcelGenerating, setAllExcelGenerating] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const NAV_ITEMS: { key: Section; label: string; icon: typeof Search }[] = [
    { key: 'search', label: 'Candidate Search', icon: Search },
    { key: 'new-employees', label: 'New Employees', icon: UserPlus },
    { key: 'skill-dashboard', label: 'Skill Dashboard', icon: BarChart3 },
    { key: 'employee-list', label: 'Employee List', icon: Users },
    { key: 'talent-pool', label: 'Talent Pool', icon: BriefcaseBusiness },
    { key: 'metrics', label: 'Monitoring', icon: ShieldCheck },
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
      <aside className={`flex flex-col flex-shrink-0 border-r border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(129,140,248,0.14),_transparent_45%),linear-gradient(135deg,_#020617,_#0f172a_55%,_#111827)] text-slate-200 shadow-[16px_0_50px_-24px_rgba(2,6,23,0.8)] transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-72'}`}>
        <div className="border-b border-white/10 p-4">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!sidebarCollapsed && (
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 shadow-lg shadow-violet-900/30">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">ResumeSync</p>
                  <p className="text-xs text-slate-400">HR Workspace</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1.5">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              const isActive = section === item.key
              const showBadge = item.key === 'new-employees' ? newEmployeeCount > 0 : item.key === 'talent-pool' ? benchCount > 0 : false
              const badgeValue = item.key === 'new-employees' ? newEmployeeCount : benchCount

              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${
                    isActive ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-violet-500/20 text-violet-200' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  {!sidebarCollapsed && showBadge && (
                    <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950">
                      {badgeValue}
                    </span>
                  )}
                </button>
              )
            })}

            <button
              onClick={() => setSection('audit-log')}
              className={`mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                section === 'audit-log' ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${section === 'audit-log' ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-500'}`}>
                <ShieldCheck className="h-4 w-4" />
              </div>
              {!sidebarCollapsed && <span className="text-xs uppercase tracking-[0.2em]">Audit Log</span>}
            </button>
          </div>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-3`}>
            <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'} min-w-0`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-semibold text-white shadow-lg shadow-violet-950/30">
                {(user?.fullName || user?.email || 'H')[0].toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{user?.fullName || 'HR User'}</p>
                  <p className="truncate text-xs text-slate-400">{user?.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className={`flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white ${sidebarCollapsed ? 'ml-0' : ''}`}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
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
