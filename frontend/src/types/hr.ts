export type Section = 'search' | 'new-employees' | 'skill-dashboard' | 'employee-list' | 'talent-pool' | 'audit-log' | 'metrics'

export interface Candidate {
  employee_id: string
  name: string
  email: string
  currentRole: string
  skills: string[]
  experience: number
  resume_path?: string
  isOnBench?: boolean
}

export interface Message {
  id: number
  type: 'user' | 'assistant'
  text?: string
  candidates?: Candidate[]
  excel_filename?: string
  loading?: boolean
}

export interface NewEmployee {
  employee_id: string
  name: string
  email: string
  department?: string
}

export interface SkillRack {
  skill: string
  employee_count: number
}

export interface SkillHistoryEntry {
  skill: string
  skill_exp: number
  designation: string
  from: string
  to: string
}

export interface SkillEmployee {
  employee_id: string
  name: string
  email: string
  current_designation: string
  current_skill: string
  total_exp: number
  current_skill_exp: number
  primary_skill?: string
  secondary_skill?: string
  skill_history?: SkillHistoryEntry[]
}

export interface SkillSummaryRow {
  employee_id: string
  name: string
  email: string
  current_designation: string
  current_skill: string
  total_exp: number | string
  current_skill_exp: number | string
  resume_path?: string
}

export interface AuditEvent {
  _id: string
  event_type: string
  actor: string
  employee_id: string | null
  timestamp: string
  payload: Record<string, unknown>
}

export interface HRMetrics {
  overview: {
    total_employees: number
    total_with_resume: number
    pending_resumes: number
    coverage_pct: number
    bench_count: number
  }
  activity: {
    uploads_last_7d: number
    updates_last_7d: number
    invites_last_7d: number
    uploads_last_30d: number
  }
  skill_distribution: { skill: string; count: number }[]
  recent_feed: { event_type: string; actor: string; employee_id: string | null; timestamp: string }[]
}

export const AUDIT_EVENT_TYPES = [
  'LOGIN',
  'RESUME_UPLOAD',
  'PROFILE_UPDATED',
  'SKILL_PROFILE_UPDATED',
  'RESUME_REGENERATED',
  'MONTHLY_UPDATE_SUBMITTED',
  'NEW_EMPLOYEE_PROVISIONED',
  'INVITE_SENT',
  'EXCEL_REPORT_GENERATED',
  'EMPLOYEE_DELETED',
]

export const AUDIT_EVENT_LABELS: Record<string, string> = {
  LOGIN: 'Login',
  RESUME_UPLOAD: 'Resume Upload',
  PROFILE_UPDATED: 'Profile Updated',
  SKILL_PROFILE_UPDATED: 'Skill Profile Updated',
  RESUME_REGENERATED: 'Resume Regenerated',
  MONTHLY_UPDATE_SUBMITTED: 'Monthly Update Submitted',
  NEW_EMPLOYEE_PROVISIONED: 'New Employee Provisioned',
  INVITE_SENT: 'Invite Sent',
  EXCEL_REPORT_GENERATED: 'Excel Report Generated',
  EMPLOYEE_DELETED: 'Employee Deleted',
}

export const AUDIT_EVENT_COLORS: Record<string, string> = {
  LOGIN: 'bg-slate-100 text-slate-700',
  RESUME_UPLOAD: 'bg-blue-50 text-blue-700',
  PROFILE_UPDATED: 'bg-violet-50 text-violet-700',
  SKILL_PROFILE_UPDATED: 'bg-violet-50 text-violet-700',
  RESUME_REGENERATED: 'bg-teal-50 text-teal-700',
  MONTHLY_UPDATE_SUBMITTED: 'bg-amber-50 text-amber-700',
  EMPLOYEE_DELETED: 'bg-red-50 text-red-700',
  NEW_EMPLOYEE_PROVISIONED: 'bg-green-50 text-green-700',
  INVITE_SENT: 'bg-blue-50 text-blue-700',
  EXCEL_REPORT_GENERATED: 'bg-emerald-50 text-emerald-700',
}

export const SKILL_BADGE: Record<string, string> = {
  'React': 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  'Angular': 'bg-red-50 text-red-700 border border-red-200',
  '.NET': 'bg-purple-50 text-purple-700 border border-purple-200',
  '.NET Full Stack': 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  'Java': 'bg-orange-50 text-orange-700 border border-orange-200',
  'Java Full Stack': 'bg-amber-50 text-amber-700 border border-amber-200',
  'DevOps': 'bg-slate-100 text-slate-700 border border-slate-200',
  'AI': 'bg-violet-50 text-violet-700 border border-violet-200',
  'Automation Testing': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'PHP & Laravel': 'bg-rose-50 text-rose-700 border border-rose-200',
  'Data Engineering': 'bg-teal-50 text-teal-700 border border-teal-200',
  'Data Analysis': 'bg-blue-50 text-blue-700 border border-blue-200',
  'UI/UX': 'bg-pink-50 text-pink-700 border border-pink-200',
  'Technical Writing': 'bg-gray-100 text-gray-700 border border-gray-200',
  'BA': 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  'PO': 'bg-lime-50 text-lime-700 border border-lime-200',
  'IT': 'bg-stone-50 text-stone-700 border border-stone-200',
  'Other': 'bg-gray-100 text-gray-600 border border-gray-200',
}

export function getSkillBadgeClass(skill?: string) {
  if (!skill) return 'bg-gray-100 text-gray-400 border border-gray-200'
  return SKILL_BADGE[skill] ?? 'bg-blue-50 text-blue-700 border border-blue-200'
}
