export interface Education {
  year?: string
  institution: string
  stream: string
  cgpa: number
}

export interface ProjectInEntry {
  name: string
  client: string
  role: string
  technologies: string
  description: string
  responsibilities: string
}

export interface WorkExpEdit {
  designation: string
  company: string
  companyDescription: string
  duration: string
  projects: ProjectInEntry[]
}

export interface WorkExperienceItem {
  company: { name: string; description?: string }
  designation: string
  duration: string
  project?: {
    name?: string
    client?: string
    role?: string
    environment?: string[]
    project_description?: string
    responsibilities?: string[]
  }
}

/** A single role (designation + duration) held at a company, with its projects. */
export interface CompanyRole {
  designation: string
  duration: string
  projects: WorkExperienceItem['project'][]
}

/** All roles held at one company, grouped together. */
export interface CompanyGroup {
  company: { name: string; description?: string }
  roles: CompanyRole[]
}

export interface ProfileData {
  employeeId?: string
  fullName?: string
  email?: string
  currentRole?: string
  department?: string
  location?: string
  joiningDate?: string
  hasResume?: boolean
  resume?: {
    profile_summary?: string
    technical_skills?: Record<string, string[]>
    total_experience?: number
    education?: Education[]
    certifications?: string[]
    achievements?: string[]
    interests?: string[]
    personal_info?: { full_name: string }
    work_experience?: WorkExperienceItem[]
  }
}

export interface SkillHistoryEntry {
  skill: string
  skill_exp: number
  designation: string
  from: string
  to: string
}

export interface SkillSummary {
  employee_id: string
  name: string
  current_designation: string
  current_skill: string
  total_exp: number
  current_skill_exp: number
  primary_skill: string
  secondary_skill: string
  is_on_bench: boolean
  skill_history: SkillHistoryEntry[]
  /** Set server-side on every save. Drives the "last updated N months ago"
   *  staleness nudge — completeness alone cannot show that a 100%-complete
   *  profile has not been touched since it was seeded. */
  updated_at?: string
  /** Fields derived from the resume rather than chosen by the employee.
   *  Cleared as soon as they save. Empty means everything was confirmed. */
  prefilled_fields?: string[]
}

export type ActiveModal =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'education'
  | 'certs'
  | 'achievements'
  | 'interests'
  | 'skillprofile'
  | null

/**
 * Groups work experience by company, then by distinct role (designation + duration)
 * within each company. Multiple roles/stints at the same company collapse under a
 * single company entry instead of appearing as separate companies.
 */
export const groupByCompany = (items: WorkExperienceItem[]): CompanyGroup[] => {
  const companyMap = new Map<string, CompanyGroup>()
  const companyOrder: string[] = []

  items.forEach(item => {
    const companyKey = item.company.name.trim().toLowerCase()
    if (!companyMap.has(companyKey)) {
      companyOrder.push(companyKey)
      companyMap.set(companyKey, { company: item.company, roles: [] })
    }
    const group = companyMap.get(companyKey)!

    const roleKey = `${item.designation}|||${item.duration}`
    let role = group.roles.find(r => `${r.designation}|||${r.duration}` === roleKey)
    if (!role) {
      role = { designation: item.designation, duration: item.duration, projects: [] }
      group.roles.push(role)
    }
    if (item.project) role.projects.push(item.project)
  })

  return companyOrder.map(k => companyMap.get(k)!)
}

/** Count unique companies (ignores multiple roles at the same company) */
export const countUniqueCompanies = (items: WorkExperienceItem[]): number =>
  new Set(items.map(i => i.company.name.trim().toLowerCase())).size

export const initials = (name?: string) =>
  (name || 'E').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
