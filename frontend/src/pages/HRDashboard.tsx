import { useState } from 'react'
import {
  BarChart3,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Section } from '../types/hr'
import NewEmployeesSection from '../components/hr/NewEmployeesSection'
import SkillDashboard from '../components/hr/SkillDashboard'
import EmployeeListSection from '../components/hr/EmployeeListSection'
import TalentPool from '../components/hr/TalentPool'
import MetricsSection from '../components/hr/MetricsSection'
import AuditLogSection from '../components/hr/AuditLogSection'

export default function HRDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [section, setSection] = useState<Section>('employee-list')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [newEmployeeCount, setNewEmployeeCount] = useState(0)
  const [benchCount, setBenchCount] = useState(0)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const selectSection = (s: Section) => {
    setSection(s)
    setMobileNavOpen(false)
  }

  const NAV_ITEMS: { key: Section; label: string; icon: typeof UserPlus }[] = [
    { key: 'new-employees', label: 'New Employees', icon: UserPlus },
    { key: 'skill-dashboard', label: 'Skill Dashboard', icon: BarChart3 },
    { key: 'employee-list', label: 'Employee List', icon: Users },
    { key: 'talent-pool', label: 'Talent Pool', icon: BriefcaseBusiness },
    { key: 'metrics', label: 'Monitoring', icon: ShieldCheck },
  ]

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">

      {/* Mobile backdrop, shown only while the drawer is open */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Sidebar — off-canvas drawer on mobile/tablet, static rail on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-shrink-0 flex-col border-r border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(217,70,239,0.16),_transparent_45%),linear-gradient(165deg,_#1e1b4b,_#312e81_50%,_#3b0764)] text-slate-200 shadow-[16px_0_50px_-24px_rgba(30,27,75,0.8)] transition-transform duration-300 lg:relative lg:inset-y-auto lg:left-auto lg:z-auto lg:translate-x-0 lg:transition-[width]
        ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-72'}`}
      >
        <div className={`border-b border-white/10 p-4 ${sidebarCollapsed ? 'lg:p-3' : ''}`}>
          <div className={`flex items-center justify-between ${sidebarCollapsed ? 'lg:flex-col lg:gap-2' : ''}`}>
            <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'lg:gap-0' : ''}`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/90 p-1.5 ring-1 ring-white/25 shadow-lg shadow-violet-950/30 backdrop-blur-md transition-all duration-200 hover:scale-105 hover:rotate-3 hover:bg-white">
                <img src="/syncfolio-mark.svg" alt="" className="h-full w-full" />
              </div>
              <div className={sidebarCollapsed ? 'lg:hidden' : ''}>
                <p className="text-sm font-semibold text-white">SyncFolio</p>
                <p className="text-xs text-slate-400">HR Workspace</p>
              </div>
            </div>
            {/* Desktop collapse toggle */}
            <button
              onClick={() => setSidebarCollapsed(v => !v)}
              className="hidden rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:block"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
            {/* Mobile close button */}
            <button
              onClick={() => setMobileNavOpen(false)}
              className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
              title="Close menu"
            >
              <X className="h-4 w-4" />
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
                  onClick={() => selectSection(item.key)}
                  className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition ${
                    isActive ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-violet-500/20 text-violet-200' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className={`truncate ${sidebarCollapsed ? 'lg:hidden' : ''}`}>{item.label}</span>
                  {showBadge && (
                    <span className={`ml-auto flex-shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-amber-950 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                      {badgeValue}
                    </span>
                  )}
                </button>
              )
            })}

            <button
              onClick={() => selectSection('audit-log')}
              className={`mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm transition ${
                section === 'audit-log' ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
              }`}
            >
              <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${section === 'audit-log' ? 'bg-white/10 text-white' : 'bg-white/5 text-slate-500'}`}>
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className={`text-xs uppercase tracking-[0.2em] ${sidebarCollapsed ? 'lg:hidden' : ''}`}>Audit Log</span>
            </button>
          </div>
        </div>

        <div className={`border-t border-white/10 p-4 ${sidebarCollapsed ? 'lg:p-3' : ''}`}>
          <div className={`flex items-center justify-between gap-3 ${sidebarCollapsed ? 'lg:flex-col lg:gap-2' : ''}`}>
            <div className={`flex min-w-0 items-center gap-3 ${sidebarCollapsed ? 'lg:gap-0' : ''}`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-semibold text-white shadow-lg shadow-violet-950/30">
                {(user?.fullName || user?.email || 'H')[0].toUpperCase()}
              </div>
              <div className={`min-w-0 ${sidebarCollapsed ? 'lg:hidden' : ''}`}>
                <p className="truncate text-sm font-medium text-white">{user?.fullName || 'HR User'}</p>
                <p className="truncate text-xs text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main area */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
            title="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/syncfolio-mark.svg" alt="" className="h-7 w-7" />
            <span className="text-sm font-semibold text-slate-800">SyncFolio</span>
          </div>
        </div>

        {/* Section bodies */}
        {section === 'new-employees'   && <NewEmployeesSection actorEmail={user?.email} onCountChange={setNewEmployeeCount} />}
        {section === 'skill-dashboard' && <SkillDashboard actorEmail={user?.email} />}
        {section === 'employee-list'   && <EmployeeListSection actorEmail={user?.email} />}
        {section === 'talent-pool'     && <TalentPool onCountChange={setBenchCount} />}
        {section === 'metrics'         && <MetricsSection />}
        {section === 'audit-log'       && <AuditLogSection />}
      </main>
    </div>
  )
}
