import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Education {
  year?: string
  institution: string
  stream: string
  cgpa: number
}

interface ProjectInEntry {
  name: string
  client: string
  role: string
  technologies: string
  description: string
  responsibilities: string
}

interface WorkExpEdit {
  designation: string
  company: string
  companyDescription: string
  duration: string
  projects: ProjectInEntry[]
}

interface WorkExperienceItem {
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

interface WorkExpGroup {
  designation: string
  company: { name: string; description?: string }
  duration: string
  projects: WorkExperienceItem['project'][]
}

interface ProfileData {
  employeeId?: string
  fullName?: string
  email?: string
  currentRole?: string
  department?: string
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

interface SkillHistoryEntry {
  skill: string
  skill_exp: number
  designation: string
  from: string
  to: string
}

interface SkillSummary {
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

type ActiveModal =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'education'
  | 'certs'
  | 'achievements'
  | 'skillprofile'
  | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

const groupWorkExperience = (items: WorkExperienceItem[]): WorkExpGroup[] => {
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

const initials = (name?: string) =>
  (name || 'E').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

// ─── SVG icons ────────────────────────────────────────────────────────────────

const IconEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
)
const IconPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)
const IconClose = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)
const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)
const IconSpinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

// ─── Small reusable bits ───────────────────────────────────────────────────────

const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
)

const SectionHead = ({
  icon, title, action, actionLabel, onAction,
}: {
  icon: React.ReactNode
  title: string
  action?: 'edit' | 'add'
  actionLabel?: string
  onAction?: () => void
}) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
    <div className="flex items-center gap-2.5">
      <span className="text-blue-600">{icon}</span>
      <span className="text-sm font-bold text-gray-800">{title}</span>
    </div>
    {onAction && (
      <button
        onClick={onAction}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
      >
        {action === 'add' ? <IconPlus /> : <IconEdit />}
        {actionLabel || (action === 'add' ? 'Add' : 'Edit')}
      </button>
    )}
  </div>
)

const FormLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{children}</label>
)

const FormInput = ({
  value, onChange, placeholder, type = 'text', min, step,
}: {
  value: string | number
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  min?: number
  step?: number
}) => (
  <input
    type={type}
    min={min}
    step={step}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-800 text-sm bg-white"
  />
)

const FormTextarea = ({
  value, onChange, placeholder, rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-800 text-sm bg-white resize-none"
  />
)

// ─── Modal shell ───────────────────────────────────────────────────────────────

const Modal = ({
  open, title, subtitle, onClose, onSave, saving, saveMsg, children, wide,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  children: React.ReactNode
  wide?: boolean
}) => {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-2xl flex flex-col max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition ml-4 flex-shrink-0"
          >
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {children}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {saveMsg && (
            <p className={`text-xs mb-3 ${saveMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
              {saveMsg}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 transition flex items-center gap-2"
            >
              {saving && <IconSpinner />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Profile completeness ──────────────────────────────────────────────────────

const completenessItems = (resume?: ProfileData['resume'], skill?: SkillSummary | null) => [
  { label: 'Summary',       done: !!resume?.profile_summary },
  { label: 'Skills',        done: !!resume?.technical_skills && Object.keys(resume.technical_skills).length > 0 },
  { label: 'Experience',    done: !!resume?.work_experience && resume.work_experience.length > 0 },
  { label: 'Education',     done: !!resume?.education && resume.education.length > 0 },
  { label: 'Certifications',done: !!resume?.certifications && resume.certifications.length > 0 },
  { label: 'Skill Profile', done: !!skill?.current_skill },
]

// ─── Main Component ────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [initialTabSet, setInitialTabSet] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  // Skill profile
  const [skillSummary, setSkillSummary] = useState<SkillSummary | null>(null)
  const [skillSummaryLoading, setSkillSummaryLoading] = useState(true)
  const [skillSaving, setSkillSaving] = useState(false)
  const [skillSaveMsg, setSkillSaveMsg] = useState('')
  const [editDesignation, setEditDesignation] = useState('')
  const [editCurrentSkill, setEditCurrentSkill] = useState('')
  const [editTotalExp, setEditTotalExp] = useState(0)
  const [editSkillExp, setEditSkillExp] = useState(0)
  const [editPrimarySkill, setEditPrimarySkill] = useState('')
  const [editSecondarySkill, setEditSecondarySkill] = useState('')
  const [editIsOnBench, setEditIsOnBench] = useState(false)
  const [skillCategories, setSkillCategories] = useState<string[]>([])

  // Resume fields edit state
  const [editSummary, setEditSummary] = useState('')
  const [editExperience, setEditExperience] = useState(0)
  const [editSkills, setEditSkills] = useState<{ category: string; skills: string }[]>([])
  const [editWorkExps, setEditWorkExps] = useState<WorkExpEdit[]>([])
  const [editCertifications, setEditCertifications] = useState<string[]>([])
  const [editAchievements, setEditAchievements] = useState<string[]>([])

  // Work experience view accordions
  const [viewWEOpen, setViewWEOpen] = useState(false)
  const [viewOpenEntries, setViewOpenEntries] = useState<Set<number>>(new Set())
  const [viewOpenProjects, setViewOpenProjects] = useState<Set<string>>(new Set())

  // Work experience edit accordions
  const [editOpenEntries, setEditOpenEntries] = useState<Set<number>>(new Set())
  const [editOpenProjects, setEditOpenProjects] = useState<Set<string>>(new Set())

  // Active modal
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user?.email) {
      fetchProfile()
      fetchSkillSummary()
      fetchSkillCategories()
    }
  }, [user?.email])

  const fetchProfile = async () => {
    setProfileLoading(true)
    try {
      const { data } = await api.get('/employee-profile', { params: { email: user!.email } })
      if (data.status === 'success') {
        setProfile(data.data)
        if (!initialTabSet) {
          setShowUpload(!data.data.hasResume)
          setInitialTabSet(true)
        }
      }
    } catch { /* ignore */ }
    finally { setProfileLoading(false) }
  }

  const fetchSkillSummary = async () => {
    setSkillSummaryLoading(true)
    try {
      const { data } = await api.get('/employee-skill-summary', { params: { email: user!.email } })
      if (data.status === 'success') setSkillSummary(data.data)
    } catch { /* ignore */ }
    finally { setSkillSummaryLoading(false) }
  }

  const fetchSkillCategories = async () => {
    try {
      const { data } = await api.get('/skill-categories')
      if (data.status === 'success') setSkillCategories(data.data)
    } catch { /* ignore */ }
  }

  // ── Open modals ─────────────────────────────────────────────────────────────

  const openModal = (m: ActiveModal) => {
    setSaveMsg('')
    setSkillSaveMsg('')
    const r = profile?.resume
    if (m === 'summary') {
      setEditSummary(r?.profile_summary || '')
      // Prefer skill summary exp (HR-verified) over resume-extracted value
      setEditExperience(skillSummary?.total_exp ?? r?.total_experience ?? 0)
    }
    if (m === 'skills') {
      setEditSkills(
        r?.technical_skills
          ? Object.entries(r.technical_skills).map(([cat, skills]) => ({ category: cat, skills: skills.join(', ') }))
          : [{ category: '', skills: '' }]
      )
    }
    if (m === 'experience') {
      setEditWorkExps(r?.work_experience ? toWorkExpEdits(r.work_experience) : [blankWorkExp()])
      setEditOpenEntries(new Set())
      setEditOpenProjects(new Set())
    }
    if (m === 'certs') setEditCertifications(r?.certifications ?? [])
    if (m === 'achievements') setEditAchievements(r?.achievements ?? [])
    if (m === 'skillprofile') {
      setEditDesignation(skillSummary?.current_designation || '')
      setEditCurrentSkill(skillSummary?.current_skill || '')
      setEditTotalExp(skillSummary?.total_exp || 0)
      setEditSkillExp(skillSummary?.current_skill_exp || 0)
      setEditPrimarySkill(skillSummary?.primary_skill || '')
      setEditSecondarySkill(skillSummary?.secondary_skill || '')
      setEditIsOnBench(skillSummary?.is_on_bench || false)
    }
    setActiveModal(m)
  }

  const closeModal = () => setActiveModal(null)

  // ── Save handlers ───────────────────────────────────────────────────────────

  const patchResume = async (patch: Record<string, unknown>) => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api.put('/employee-profile', {
        email: user!.email,
        personal_info: profile?.resume?.personal_info,
        profile_summary: profile?.resume?.profile_summary,
        total_experience: profile?.resume?.total_experience,
        technical_skills: profile?.resume?.technical_skills,
        work_experience: profile?.resume?.work_experience,
        certifications: profile?.resume?.certifications,
        achievements: profile?.resume?.achievements,
        ...patch,
      })
      setSaveMsg('Saved successfully!')
      await fetchProfile()
      setActiveModal(null)
    } catch {
      setSaveMsg('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSummary = () =>
    patchResume({ profile_summary: editSummary, total_experience: editExperience })

  const handleSaveSkills = () =>
    patchResume({
      technical_skills: Object.fromEntries(
        editSkills
          .filter(s => s.category.trim())
          .map(s => [s.category.trim(), s.skills.split(',').map(x => x.trim()).filter(Boolean)])
      ),
    })

  const handleSaveExperience = () =>
    patchResume({ work_experience: fromWorkExpEdits(editWorkExps) })

  const handleSaveCerts = () =>
    patchResume({ certifications: editCertifications.map(s => s.trim()).filter(Boolean) })

  const handleSaveAchievements = () =>
    patchResume({ achievements: editAchievements.map(s => s.trim()).filter(Boolean) })

  const handleSaveSkillProfile = async () => {
    setSkillSaving(true)
    setSkillSaveMsg('')
    try {
      const { data } = await api.put('/employee-skill-summary', {
        email: user!.email,
        current_designation: editDesignation,
        current_skill: editCurrentSkill,
        total_exp: editTotalExp,
        current_skill_exp: editSkillExp,
        primary_skill: editPrimarySkill,
        secondary_skill: editSecondarySkill,
        is_on_bench: editIsOnBench,
      })
      if (data.status === 'success') {
        setSkillSummary(data.data)
        setSkillSaveMsg('Saved successfully!')
        setActiveModal(null)
      } else {
        setSkillSaveMsg(data.message || 'Failed to save. Please try again.')
      }
    } catch {
      setSkillSaveMsg('Failed to save. Please try again.')
    } finally {
      setSkillSaving(false)
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setUploadFile(f)
  }

  const handleUpload = async () => {
    if (!uploadFile || !user?.employeeId) return
    setUploading(true)
    setUploadMsg('')
    try {
      const form = new FormData()
      form.append('file', uploadFile)
      form.append('employee_id', user.employeeId)
      form.append('employee_email', user.email)
      const { data } = await api.post('/upload-resume', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const reply = data.reply ?? data
      if (reply.status === 'success') {
        setUploadMsg('Resume uploaded and processed successfully!')
        setUploadFile(null)
        if (fileRef.current) fileRef.current.value = ''
        await fetchProfile()
        setShowUpload(false)
      } else {
        setUploadMsg(reply.message || data.message || 'Upload failed. Please try again.')
      }
    } catch {
      setUploadMsg('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // ── Work experience edit helpers ────────────────────────────────────────────

  const blankProjectInEntry = (): ProjectInEntry => ({
    name: '', client: '', role: '', technologies: '', description: '', responsibilities: '',
  })

  const blankWorkExp = (): WorkExpEdit => ({
    designation: '', company: '', companyDescription: '', duration: '',
    projects: [blankProjectInEntry()],
  })

  const toWorkExpEdits = (workExp: WorkExperienceItem[]): WorkExpEdit[] => {
    const map = new Map<string, WorkExpEdit>()
    const order: string[] = []
    workExp.forEach(we => {
      const key = `${we.company.name}|||${we.designation}|||${we.duration}`
      if (!map.has(key)) {
        order.push(key)
        map.set(key, {
          designation: we.designation || '',
          company: we.company.name || '',
          companyDescription: we.company.description || '',
          duration: we.duration || '',
          projects: [],
        })
      }
      if (we.project) {
        map.get(key)!.projects.push({
          name: we.project.name || '',
          client: we.project.client || '',
          role: we.project.role || '',
          technologies: we.project.environment?.join(', ') || '',
          description: we.project.project_description || '',
          responsibilities: we.project.responsibilities?.join('\n') || '',
        })
      }
    })
    return order.map(k => map.get(k)!)
  }

  const fromWorkExpEdits = (edits: WorkExpEdit[]): WorkExperienceItem[] => {
    const items: WorkExperienceItem[] = []
    edits.filter(e => e.designation.trim() || e.company.trim()).forEach(e => {
      if (e.projects.length === 0) {
        items.push({
          company: { name: e.company.trim(), description: e.companyDescription.trim() || undefined },
          designation: e.designation.trim(),
          duration: e.duration.trim(),
        })
      } else {
        e.projects.forEach(p => {
          items.push({
            company: { name: e.company.trim(), description: e.companyDescription.trim() || undefined },
            designation: e.designation.trim(),
            duration: e.duration.trim(),
            project: {
              name: p.name.trim() || undefined,
              client: p.client.trim() || undefined,
              role: p.role.trim() || undefined,
              environment: p.technologies.split(',').map(s => s.trim()).filter(Boolean),
              project_description: p.description.trim() || undefined,
              responsibilities: p.responsibilities.split('\n').map(s => s.trim()).filter(Boolean),
            },
          })
        })
      }
    })
    return items
  }

  const updateWorkExp = (idx: number, field: keyof Omit<WorkExpEdit, 'projects'>, value: string) =>
    setEditWorkExps(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))

  const updateProjectInEntry = (entryIdx: number, projIdx: number, field: keyof ProjectInEntry, value: string) =>
    setEditWorkExps(prev => prev.map((e, i) => i !== entryIdx ? e : {
      ...e,
      projects: e.projects.map((p, j) => j === projIdx ? { ...p, [field]: value } : p),
    }))

  const addEntry = () => {
    const idx = editWorkExps.length
    setEditWorkExps(prev => [...prev, blankWorkExp()])
    setEditOpenEntries(prev => { const s = new Set(prev); s.add(idx); return s })
    setEditOpenProjects(prev => { const s = new Set(prev); s.add(`${idx}-0`); return s })
  }

  const removeEntry = (idx: number) => {
    setEditWorkExps(prev => prev.filter((_, i) => i !== idx))
    setEditOpenEntries(prev => {
      const s = new Set<number>()
      prev.forEach(i => { if (i < idx) s.add(i); else if (i > idx) s.add(i - 1) })
      return s
    })
    setEditOpenProjects(prev => {
      const s = new Set<string>()
      prev.forEach(key => {
        const [ei, pi] = key.split('-').map(Number)
        if (ei < idx) s.add(key)
        else if (ei > idx) s.add(`${ei - 1}-${pi}`)
      })
      return s
    })
  }

  const addProjectToEntry = (entryIdx: number) => {
    const projIdx = editWorkExps[entryIdx].projects.length
    setEditWorkExps(prev => prev.map((e, i) => i !== entryIdx ? e : {
      ...e, projects: [...e.projects, blankProjectInEntry()],
    }))
    setEditOpenProjects(prev => { const s = new Set(prev); s.add(`${entryIdx}-${projIdx}`); return s })
  }

  const removeProjectFromEntry = (entryIdx: number, projIdx: number) => {
    setEditWorkExps(prev => prev.map((e, i) => i !== entryIdx ? e : {
      ...e, projects: e.projects.filter((_, j) => j !== projIdx),
    }))
    setEditOpenProjects(prev => {
      const s = new Set<string>()
      prev.forEach(key => {
        const [ei, pi] = key.split('-').map(Number)
        if (ei !== entryIdx) s.add(key)
        else if (pi < projIdx) s.add(key)
        else if (pi > projIdx) s.add(`${ei}-${pi - 1}`)
      })
      return s
    })
  }

  const toggleViewEntry = (i: number) => setViewOpenEntries(prev => {
    const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s
  })
  const toggleViewProject = (key: string) => setViewOpenProjects(prev => {
    const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s
  })
  const toggleEditEntry = (i: number) => setEditOpenEntries(prev => {
    const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s
  })
  const toggleEditProject = (key: string) => setEditOpenProjects(prev => {
    const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s
  })

  // ── Derived ────────────────────────────────────────────────────────────────

  const handleLogout = () => { logout(); navigate('/login') }
  const resume = profile?.resume
  const hasResume = !!profile?.hasResume
  // skillSummary.name is seeded from HR Excel — always the authoritative name.
  // Fall back to auth user, then the AI-extracted personal_info only as last resort.
  const displayName = skillSummary?.name || user?.fullName || resume?.personal_info?.full_name || user?.email || ''
  const completeness = completenessItems(resume, skillSummary)
  const completePct = Math.round((completeness.filter(c => c.done).length / completeness.length) * 100)

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Topbar ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-800 text-[15px]">ResumeSync</span>
          </div>

          <div className="flex items-center gap-3">
            {hasResume && (
              <div className="hidden sm:flex items-center gap-1 text-xs text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Profile Active
              </div>
            )}
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-gray-700">{user?.fullName || user?.email}</p>
              <p className="text-xs text-gray-400">{user?.employeeId}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
              {initials(user?.fullName || user?.email)}
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ── Canvas ── */}
      {showUpload && !hasResume ? (
        /* ── Upload-only view for new joiners ── */
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800 text-center mb-1">Upload Your Resume</h2>
            <p className="text-sm text-gray-400 text-center mb-7">
              We'll extract your information automatically using AI — PDF or DOCX, max 10 MB.
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
                uploadFile ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={handleFileChange} className="hidden" />
              {uploadFile ? (
                <>
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="font-semibold text-gray-700 text-sm">{uploadFile.name}</p>
                  <p className="text-gray-400 text-xs mt-1">{(uploadFile.size / 1024).toFixed(0)} KB · Click to change</p>
                </>
              ) : (
                <>
                  <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm font-medium text-gray-500">Click to upload or drag &amp; drop</p>
                </>
              )}
            </div>

            {!user?.employeeId && (
              <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-700 text-xs px-4 py-3 rounded-xl">
                Your account doesn't have an Employee ID. Please contact HR.
              </div>
            )}
            {uploadMsg && (
              <div className={`mt-4 text-xs px-4 py-3 rounded-xl border ${
                uploadMsg.includes('success')
                  ? 'bg-green-50 text-green-700 border-green-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}>{uploadMsg}</div>
            )}
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading || !user?.employeeId}
              className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm"
            >
              {uploading ? <><IconSpinner />Processing resume...</> : 'Upload & Process Resume'}
            </button>
            <p className="text-gray-400 text-xs text-center mt-3">
              Processing may take 30–60 seconds.
            </p>
          </div>
        </div>
      ) : profileLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading profile…</p>
          </div>
        </div>
      ) : (
        /* ── Main two-column layout ── */
        <div className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-6 flex gap-5 items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-4 sticky top-[57px]">

            {/* Profile card */}
            <SectionCard>
              {/* Banner */}
              <div className="h-16 bg-gradient-to-r from-blue-700 to-violet-600 rounded-t-2xl" />
              <div className="px-4 pb-5">
                {/* Avatar */}
                <div className="flex items-end gap-3 -mt-7 mb-3">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 border-3 border-white flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
                    style={{ border: '3px solid white' }}>
                    {initials(displayName)}
                  </div>
                </div>
                <p className="text-[15px] font-bold text-gray-800 leading-tight">{displayName || '—'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {skillSummary?.current_designation || profile?.currentRole || 'Employee'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 truncate">{profile?.email}</p>

                {/* Tags — current skill + department + bench status only */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {skillSummary?.current_skill && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {skillSummary.current_skill}
                    </span>
                  )}
                  {profile?.department && (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                      {profile.department}
                    </span>
                  )}
                  <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                    skillSummary?.is_on_bench
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {skillSummary?.is_on_bench ? 'On Bench' : 'Active'}
                  </span>
                </div>

                {/* Stats — skillSummary is the authoritative source for exp */}
                <div className="flex justify-between mt-4 pt-4 border-t border-gray-100">
                  <div className="text-center">
                    <p className="text-base font-bold text-gray-800 tabular-nums">
                      {skillSummary?.total_exp ?? resume?.total_experience ?? '—'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">Yrs Exp</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-gray-800 tabular-nums">
                      {resume?.work_experience ? groupWorkExperience(resume.work_experience).length : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">Companies</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-gray-800 tabular-nums">
                      {resume?.technical_skills ? Object.values(resume.technical_skills).flat().length : '—'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">Skills</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Profile completeness */}
            <SectionCard>
              <div className="px-4 py-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Profile Strength</p>
                <div className="flex items-center gap-4">
                  {/* Ring */}
                  <div className="relative w-16 h-16 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none"
                        stroke={completePct >= 80 ? '#16a34a' : completePct >= 50 ? '#d97706' : '#e5e7eb'}
                        strokeWidth="3"
                        strokeDasharray={`${completePct} 100`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">
                      {completePct}%
                    </span>
                  </div>
                  {/* Items */}
                  <div className="flex flex-col gap-1.5 flex-1">
                    {completeness.map(c => (
                      <div key={c.label} className="flex items-center gap-1.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                          c.done ? 'bg-green-100' : 'bg-amber-100'
                        }`}>
                          {c.done ? (
                            <svg className="w-2.5 h-2.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-2.5 h-2.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 8v4m0 4h.01" />
                            </svg>
                          )}
                        </div>
                        <span className={`text-[11px] font-medium ${c.done ? 'text-gray-500' : 'text-amber-600'}`}>
                          {c.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Skill Profile card */}
            <SectionCard>
              <div className="px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Skill Profile</p>
                  <button
                    onClick={() => openModal('skillprofile')}
                    className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 border border-gray-200 rounded-lg px-2 py-1 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                  >
                    <IconEdit /> Edit
                  </button>
                </div>
                {skillSummaryLoading ? (
                  <div className="flex items-center gap-2 py-2">
                    <div className="w-4 h-4 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-gray-400">Loading…</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Current Skill</p>
                      <p className="text-xs font-semibold text-blue-700 truncate">{skillSummary?.current_skill || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Skill Exp</p>
                      <p className="text-xs font-semibold text-gray-700">{skillSummary?.current_skill_exp ?? '—'} yrs</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Primary</p>
                      <p className="text-xs font-semibold text-gray-700 truncate">{skillSummary?.primary_skill || '—'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Secondary</p>
                      <p className="text-xs font-semibold text-gray-700 truncate">{skillSummary?.secondary_skill || '—'}</p>
                    </div>

                    {/* Bench toggle */}
                    <div
                      onClick={() => {
                        if (!skillSummary) return
                        const next = !skillSummary.is_on_bench
                        setSkillSummary(s => s ? { ...s, is_on_bench: next } : s)
                        api.put('/employee-skill-summary', {
                          email: user!.email,
                          current_designation: skillSummary.current_designation,
                          current_skill: skillSummary.current_skill,
                          total_exp: skillSummary.total_exp,
                          current_skill_exp: skillSummary.current_skill_exp,
                          primary_skill: skillSummary.primary_skill,
                          secondary_skill: skillSummary.secondary_skill,
                          is_on_bench: next,
                        }).catch(() => setSkillSummary(s => s ? { ...s, is_on_bench: !next } : s))
                      }}
                      className={`col-span-2 flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                        skillSummary?.is_on_bench ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100 hover:border-gray-200'
                      }`}
                    >
                      <div>
                        <p className={`text-[11px] font-bold ${skillSummary?.is_on_bench ? 'text-amber-700' : 'text-gray-600'}`}>
                          {skillSummary?.is_on_bench ? 'On Bench' : 'Available on Bench?'}
                        </p>
                        <p className="text-[10px] text-gray-400">Toggle to notify HR</p>
                      </div>
                      <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
                        skillSummary?.is_on_bench ? 'bg-amber-400' : 'bg-gray-200'
                      }`}>
                        <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          skillSummary?.is_on_bench ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* Save feedback toast */}
            {saveMsg && !activeModal && (
              <div className={`px-4 py-3 rounded-xl text-sm border ${
                saveMsg.includes('success')
                  ? 'bg-green-50 text-green-700 border-green-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {saveMsg}
              </div>
            )}

            {/* No resume yet */}
            {!resume && (
              <SectionCard>
                <div className="px-6 py-12 text-center">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-gray-700 mb-1">No profile data yet</h3>
                  <p className="text-sm text-gray-400 mb-5">Upload your resume to get started.</p>
                  <button
                    onClick={() => setShowUpload(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
                  >
                    Upload Resume
                  </button>
                </div>
              </SectionCard>
            )}

            {/* ── Summary ── */}
            {resume && (
              <SectionCard>
                <SectionHead
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
                  title="Summary"
                  action="edit"
                  onAction={() => openModal('summary')}
                />
                <div className="px-5 py-4">
                  {resume.profile_summary ? (
                    <p className="text-sm text-gray-600 leading-relaxed">{resume.profile_summary}</p>
                  ) : (
                    <p className="text-sm text-gray-300 italic">No summary added yet. Click Edit to add one.</p>
                  )}
                  {(skillSummary?.total_exp ?? resume.total_experience) !== undefined && (
                    <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
                        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                      </svg>
                      {skillSummary?.total_exp ?? resume.total_experience} years of experience
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* ── Technical Skills ── */}
            {resume && (
              <SectionCard>
                <SectionHead
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
                  title="Technical Skills"
                  action="edit"
                  onAction={() => openModal('skills')}
                />
                <div className="px-5 py-4">
                  {resume.technical_skills && Object.keys(resume.technical_skills).length > 0 ? (
                    <div className="space-y-3">
                      {Object.entries(resume.technical_skills).map(([cat, skills]) => (
                        <div key={cat} className="flex items-start gap-3">
                          <span className="text-[11px] font-semibold text-gray-400 w-24 flex-shrink-0 pt-1 uppercase tracking-wide">{cat}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map((s, i) => (
                              <span key={i} className="bg-gray-100 text-gray-600 text-xs px-2.5 py-1 rounded-full font-medium hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-default">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300 italic">No skills added yet. Click Edit to add your skills.</p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* ── Work Experience ── */}
            {resume && (
              <SectionCard>
                <SectionHead
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                  title="Work Experience"
                  action="edit"
                  actionLabel="Edit / Add"
                  onAction={() => openModal('experience')}
                />

                {resume.work_experience && resume.work_experience.length > 0 ? (
                  <div className="divide-y divide-gray-50">
                    {/* Outer toggle */}
                    <button
                      onClick={() => setViewWEOpen(v => !v)}
                      className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition"
                    >
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {groupWorkExperience(resume.work_experience).length} position{groupWorkExperience(resume.work_experience).length !== 1 ? 's' : ''}
                      </span>
                      <IconChevron open={viewWEOpen} />
                    </button>

                    {viewWEOpen && (
                      <div className="divide-y divide-gray-50">
                        {groupWorkExperience(resume.work_experience).map((group, i) => (
                          <div key={i}>
                            <button
                              onClick={() => toggleViewEntry(i)}
                              className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition"
                            >
                              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-sm font-bold text-blue-600">
                                {(group.company.name || 'C')[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-gray-800 truncate">{group.designation}</p>
                                <p className="text-xs text-gray-400 truncate">{group.company.name}</p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {group.duration && <span className="text-xs text-gray-400 whitespace-nowrap">{group.duration}</span>}
                                <IconChevron open={viewOpenEntries.has(i)} />
                              </div>
                            </button>

                            {viewOpenEntries.has(i) && (
                              <div className="px-5 pb-4 pt-1 bg-gray-50/60 space-y-2">
                                {group.projects.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic">No project details.</p>
                                ) : group.projects.map((proj, j) => {
                                  const key = `${i}-${j}`
                                  const hasDetails = !!(
                                    proj?.project_description ||
                                    (proj?.environment && proj.environment.length > 0) ||
                                    (proj?.responsibilities && proj.responsibilities.length > 0)
                                  )
                                  return (
                                    <div key={j} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                      <button
                                        onClick={() => hasDetails && toggleViewProject(key)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${hasDetails ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                                      >
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-semibold text-gray-700">{proj?.name?.trim() || group.designation}</span>
                                            {proj?.client?.trim() && <span className="text-xs text-gray-400">· {proj.client}</span>}
                                            {proj?.role?.trim() && proj.role !== group.designation && (
                                              <span className="text-xs text-gray-400">· {proj.role}</span>
                                            )}
                                          </div>
                                          {proj?.project_description && !viewOpenProjects.has(key) && (
                                            <p className="text-xs text-gray-400 mt-0.5 truncate">{proj.project_description}</p>
                                          )}
                                        </div>
                                        {hasDetails && <IconChevron open={viewOpenProjects.has(key)} />}
                                      </button>

                                      {viewOpenProjects.has(key) && proj && (
                                        <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                                          {proj.project_description && (
                                            <p className="text-xs text-gray-600 leading-relaxed">{proj.project_description}</p>
                                          )}
                                          {proj.environment && proj.environment.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                              {proj.environment.map((sk, k) => (
                                                <span key={k} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">{sk}</span>
                                              ))}
                                            </div>
                                          )}
                                          {proj.responsibilities && proj.responsibilities.length > 0 && (
                                            <ul className="space-y-1">
                                              {proj.responsibilities.map((r, k) => (
                                                <li key={k} className="flex items-start gap-1.5 text-xs text-gray-600">
                                                  <span className="text-blue-400 mt-0.5 flex-shrink-0">›</span>{r}
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="px-5 py-4">
                    <p className="text-sm text-gray-300 italic">No work experience added yet.</p>
                  </div>
                )}
              </SectionCard>
            )}

            {/* ── Education ── */}
            {resume && (
              <SectionCard>
                <SectionHead
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>}
                  title="Education"
                />
                <div className="px-5 py-4">
                  {resume.education && resume.education.length > 0 ? (
                    <div className="space-y-4">
                      {resume.education.map((edu, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{edu.institution}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{edu.stream}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {edu.year && <span className="text-xs text-gray-400">{edu.year}</span>}
                              {edu.cgpa ? <span className="text-xs text-gray-400">· CGPA {edu.cgpa}</span> : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-300 italic">No education details extracted. Edit profile to add.</p>
                  )}
                </div>
              </SectionCard>
            )}

            {/* ── Certifications & Achievements ── */}
            {resume && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SectionCard>
                  <SectionHead
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
                    title="Certifications"
                    action="edit"
                    onAction={() => openModal('certs')}
                  />
                  <div className="px-5 py-4">
                    {resume.certifications && resume.certifications.length > 0 ? (
                      <ul className="space-y-2">
                        {resume.certifications.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{c}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-300 italic">No certifications added.</p>
                    )}
                  </div>
                </SectionCard>

                <SectionCard>
                  <SectionHead
                    icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                    title="Achievements"
                    action="edit"
                    onAction={() => openModal('achievements')}
                  />
                  <div className="px-5 py-4">
                    {resume.achievements && resume.achievements.length > 0 ? (
                      <ul className="space-y-2">
                        {resume.achievements.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-yellow-500 mt-0.5 flex-shrink-0">★</span>{a}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-300 italic">No achievements added.</p>
                    )}
                  </div>
                </SectionCard>
              </div>
            )}

            {/* ── Skill History ── */}
            {skillSummary?.skill_history && skillSummary.skill_history.length > 0 && (
              <SectionCard>
                <SectionHead
                  icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                  title="Skill History"
                />
                <div className="px-5 py-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        <th className="pb-2 text-left">Skill</th>
                        <th className="pb-2 text-left">Exp</th>
                        <th className="pb-2 text-left">Designation</th>
                        <th className="pb-2 text-left">From</th>
                        <th className="pb-2 text-left">To</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {skillSummary.skill_history.map((h, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-2.5 font-semibold text-gray-800 text-xs">{h.skill}</td>
                          <td className="py-2.5 text-gray-500 text-xs">{h.skill_exp} yrs</td>
                          <td className="py-2.5 text-gray-500 text-xs">{h.designation || '—'}</td>
                          <td className="py-2.5 text-gray-500 text-xs tabular-nums">
                            {h.from ? new Date(h.from).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="py-2.5 text-gray-500 text-xs tabular-nums">
                            {h.to ? new Date(h.to).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════ */}

      {/* Summary + Experience years */}
      <Modal
        open={activeModal === 'summary'}
        title="Edit Summary"
        subtitle="Your professional overview and total experience"
        onClose={closeModal}
        onSave={handleSaveSummary}
        saving={saving}
        saveMsg={saveMsg}
      >
        <div>
          <FormLabel>Profile Summary</FormLabel>
          <FormTextarea
            value={editSummary}
            onChange={setEditSummary}
            placeholder="A brief professional summary…"
            rows={5}
          />
        </div>
        <div>
          <FormLabel>Total Experience (years)</FormLabel>
          <FormInput
            type="number"
            value={editExperience}
            onChange={v => setEditExperience(Number(v))}
            min={0}
            step={0.5}
          />
        </div>
      </Modal>

      {/* Technical Skills */}
      <Modal
        open={activeModal === 'skills'}
        title="Edit Technical Skills"
        subtitle="Add category name and comma-separated skills"
        onClose={closeModal}
        onSave={handleSaveSkills}
        saving={saving}
        saveMsg={saveMsg}
      >
        <div className="space-y-2">
          {editSkills.map((skill, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={skill.category}
                onChange={e => setEditSkills(prev => prev.map((s, i) => i === idx ? { ...s, category: e.target.value } : s))}
                placeholder="Category (e.g. Backend)"
                className="w-32 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm bg-white"
              />
              <input
                type="text"
                value={skill.skills}
                onChange={e => setEditSkills(prev => prev.map((s, i) => i === idx ? { ...s, skills: e.target.value } : s))}
                placeholder="Skills, comma separated"
                className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm bg-white"
              />
              <button
                type="button"
                onClick={() => setEditSkills(prev => prev.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-600 px-1 flex-shrink-0"
              >✕</button>
            </div>
          ))}
          {editSkills.length === 0 && (
            <p className="text-xs text-gray-400 italic">No skills added.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditSkills(prev => [...prev, { category: '', skills: '' }])}
          className="text-sm text-blue-600 font-semibold hover:text-blue-700 border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full"
        >
          + Add Category
        </button>
      </Modal>

      {/* Work Experience */}
      <Modal
        open={activeModal === 'experience'}
        title="Edit Work Experience"
        subtitle="Add or update companies and projects"
        onClose={closeModal}
        onSave={handleSaveExperience}
        saving={saving}
        saveMsg={saveMsg}
        wide
      >
        <div className="space-y-2">
          {editWorkExps.map((we, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Entry header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => toggleEditEntry(idx)}
                  className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                  <IconChevron open={editOpenEntries.has(idx)} />
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-gray-700 truncate block">
                      {we.designation || we.company
                        ? `${we.designation}${we.designation && we.company ? ' @ ' : ''}${we.company}`
                        : `Entry ${idx + 1}`}
                    </span>
                    {we.duration && <span className="text-xs text-gray-400">{we.duration}</span>}
                  </div>
                </button>
                {editWorkExps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEntry(idx)}
                    className="text-red-400 hover:text-red-600 text-xs font-semibold flex-shrink-0"
                  >Remove</button>
                )}
              </div>

              {editOpenEntries.has(idx) && (
                <div className="p-4 space-y-3 border-t border-gray-100">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FormLabel>Role / Designation</FormLabel>
                      <FormInput value={we.designation} onChange={v => updateWorkExp(idx, 'designation', v)} placeholder="e.g. Backend Developer" />
                    </div>
                    <div>
                      <FormLabel>Company</FormLabel>
                      <FormInput value={we.company} onChange={v => updateWorkExp(idx, 'company', v)} placeholder="e.g. TechNova Solutions" />
                    </div>
                    <div>
                      <FormLabel>Duration</FormLabel>
                      <FormInput value={we.duration} onChange={v => updateWorkExp(idx, 'duration', v)} placeholder="e.g. Jan 2022 – Present" />
                    </div>
                    <div>
                      <FormLabel>Company Description</FormLabel>
                      <FormInput value={we.companyDescription} onChange={v => updateWorkExp(idx, 'companyDescription', v)} placeholder="e.g. Product startup in fintech" />
                    </div>
                  </div>

                  {/* Projects */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Projects</span>
                      <button
                        type="button"
                        onClick={() => addProjectToEntry(idx)}
                        className="text-xs text-blue-600 font-semibold border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition"
                      >+ Add Project</button>
                    </div>

                    <div className="space-y-1.5">
                      {we.projects.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No projects yet.</p>
                      )}
                      {we.projects.map((proj, pIdx) => {
                        const key = `${idx}-${pIdx}`
                        return (
                          <div key={pIdx} className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/60">
                              <button
                                type="button"
                                onClick={() => toggleEditProject(key)}
                                className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                              >
                                <IconChevron open={editOpenProjects.has(key)} />
                                <span className="text-xs font-semibold text-gray-600 truncate">
                                  {proj.name || `Project ${pIdx + 1}`}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => removeProjectFromEntry(idx, pIdx)}
                                className="text-red-400 hover:text-red-600 text-xs font-semibold flex-shrink-0"
                              >Remove</button>
                            </div>

                            {editOpenProjects.has(key) && (
                              <div className="p-3 space-y-2.5 border-t border-gray-100">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                  <div>
                                    <FormLabel>Project Name</FormLabel>
                                    <FormInput value={proj.name} onChange={v => updateProjectInEntry(idx, pIdx, 'name', v)} placeholder="e.g. Retail AI Platform" />
                                  </div>
                                  <div>
                                    <FormLabel>Client</FormLabel>
                                    <FormInput value={proj.client} onChange={v => updateProjectInEntry(idx, pIdx, 'client', v)} placeholder="e.g. Acme Corp" />
                                  </div>
                                  <div>
                                    <FormLabel>Role in Project</FormLabel>
                                    <FormInput value={proj.role} onChange={v => updateProjectInEntry(idx, pIdx, 'role', v)} placeholder="e.g. Backend Developer" />
                                  </div>
                                  <div>
                                    <FormLabel>Technologies (comma-separated)</FormLabel>
                                    <FormInput value={proj.technologies} onChange={v => updateProjectInEntry(idx, pIdx, 'technologies', v)} placeholder="e.g. Python, FastAPI, MongoDB" />
                                  </div>
                                </div>
                                <div>
                                  <FormLabel>Project Description</FormLabel>
                                  <FormTextarea value={proj.description} onChange={v => updateProjectInEntry(idx, pIdx, 'description', v)} placeholder="Brief description…" rows={2} />
                                </div>
                                <div>
                                  <FormLabel>Responsibilities (one per line)</FormLabel>
                                  <FormTextarea value={proj.responsibilities} onChange={v => updateProjectInEntry(idx, pIdx, 'responsibilities', v)} placeholder="One responsibility per line…" rows={3} />
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addEntry}
          className="text-sm text-blue-600 font-semibold hover:text-blue-700 border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full"
        >+ Add Company / Role</button>
      </Modal>

      {/* Certifications */}
      <Modal
        open={activeModal === 'certs'}
        title="Edit Certifications"
        subtitle="List your professional certifications"
        onClose={closeModal}
        onSave={handleSaveCerts}
        saving={saving}
        saveMsg={saveMsg}
      >
        <div className="space-y-2">
          {editCertifications.map((cert, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <FormInput
                value={cert}
                onChange={v => setEditCertifications(prev => prev.map((c, i) => i === idx ? v : c))}
                placeholder="e.g. AWS Certified Solutions Architect"
              />
              <button
                type="button"
                onClick={() => setEditCertifications(prev => prev.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-600 px-1 flex-shrink-0"
              >✕</button>
            </div>
          ))}
          {editCertifications.length === 0 && <p className="text-xs text-gray-400 italic">No certifications added.</p>}
        </div>
        <button
          type="button"
          onClick={() => setEditCertifications(prev => [...prev, ''])}
          className="text-sm text-blue-600 font-semibold border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full"
        >+ Add Certification</button>
      </Modal>

      {/* Achievements */}
      <Modal
        open={activeModal === 'achievements'}
        title="Edit Achievements"
        subtitle="Recognitions, awards, and notable accomplishments"
        onClose={closeModal}
        onSave={handleSaveAchievements}
        saving={saving}
        saveMsg={saveMsg}
      >
        <div className="space-y-2">
          {editAchievements.map((ach, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <FormInput
                value={ach}
                onChange={v => setEditAchievements(prev => prev.map((a, i) => i === idx ? v : a))}
                placeholder="e.g. Employee of the Quarter"
              />
              <button
                type="button"
                onClick={() => setEditAchievements(prev => prev.filter((_, i) => i !== idx))}
                className="text-red-400 hover:text-red-600 px-1 flex-shrink-0"
              >✕</button>
            </div>
          ))}
          {editAchievements.length === 0 && <p className="text-xs text-gray-400 italic">No achievements added.</p>}
        </div>
        <button
          type="button"
          onClick={() => setEditAchievements(prev => [...prev, ''])}
          className="text-sm text-blue-600 font-semibold border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full"
        >+ Add Achievement</button>
      </Modal>

      {/* Skill Profile */}
      <Modal
        open={activeModal === 'skillprofile'}
        title="Edit Skill Profile"
        subtitle="Used by HR for skill allocation and tracking"
        onClose={closeModal}
        onSave={handleSaveSkillProfile}
        saving={skillSaving}
        saveMsg={skillSaveMsg}
        wide
      >
        {/* Read-only identity */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Employee ID', val: skillSummary?.employee_id || user?.employeeId },
            { label: 'Name',        val: skillSummary?.name || user?.fullName },
            { label: 'Email',       val: profile?.email || user?.email },
          ].map(f => (
            <div key={f.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{f.label}</p>
              <p className="text-xs font-semibold text-gray-700 truncate">{f.val}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FormLabel>Current Designation</FormLabel>
            <FormInput value={editDesignation} onChange={setEditDesignation} placeholder="e.g. Senior Software Engineer" />
          </div>
          <div>
            <FormLabel>Current Skill</FormLabel>
            <select
              value={editCurrentSkill}
              onChange={e => setEditCurrentSkill(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm bg-white"
            >
              <option value="" disabled>Select a skill…</option>
              {skillCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <FormLabel>Total Experience (years)</FormLabel>
            <FormInput type="number" value={editTotalExp} onChange={v => setEditTotalExp(Number(v))} min={0} step={0.5} />
          </div>
          <div>
            <FormLabel>Current Skill Experience (years)</FormLabel>
            <FormInput type="number" value={editSkillExp} onChange={v => setEditSkillExp(Number(v))} min={0} step={0.5} />
          </div>
          <div>
            <FormLabel>Primary Skill</FormLabel>
            <FormInput value={editPrimarySkill} onChange={setEditPrimarySkill} placeholder="e.g. Java" />
          </div>
          <div>
            <FormLabel>Secondary Skill</FormLabel>
            <FormInput value={editSecondarySkill} onChange={setEditSecondarySkill} placeholder="e.g. Python" />
          </div>
        </div>

        <div
          onClick={() => setEditIsOnBench(v => !v)}
          className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
            editIsOnBench ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
          }`}
        >
          <div>
            <p className={`text-sm font-semibold ${editIsOnBench ? 'text-amber-700' : 'text-gray-600'}`}>
              Currently on Bench
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Let HR know you're available for new project allocation</p>
          </div>
          <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
            editIsOnBench ? 'bg-amber-400' : 'bg-gray-300'
          }`}>
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
              editIsOnBench ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </div>
        </div>
      </Modal>

    </div>
  )
}
