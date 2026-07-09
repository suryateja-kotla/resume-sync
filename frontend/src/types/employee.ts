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

export interface WorkExpGroup {
  designation: string
  company: { name: string; description?: string }
  duration: string
  projects: WorkExperienceItem['project'][]
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

export const groupWorkExperience = (items: WorkExperienceItem[]): WorkExpGroup[] => {
  const map = new Map<string, WorkExpGroup>()
  const order: string[] = []
  items.forEach(item => {
    const key = `${item.company.name}|||${item.designation}|||${item.duration}`
    if (!map.has(key)) {
      order.push(key)
      map.set(key, { designation: item.designation, company: item.company, duration: item.duration, projects: [] })
    }
    if (item.project) map.get(key)!.projects.push(item.project)
  })
  return order.map(k => map.get(k)!)
}

export const initials = (name?: string) =>
  (name || 'E').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
