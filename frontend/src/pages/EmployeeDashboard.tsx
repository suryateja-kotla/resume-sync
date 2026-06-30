import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

type Tab = 'profile' | 'upload' | 'experience'

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

interface SkillSummary {
  employee_id: string
  name: string
  current_designation: string
  current_skill: string
  total_exp: number
  current_skill_exp: number
}

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

const Chevron = ({ open, size = 4 }: { open: boolean; size?: number }) => (
  <svg
    className={`w-${size} h-${size} text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

export default function EmployeeDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [initialTabSet, setInitialTabSet] = useState(false)

  // Skill Profile (employee_skill_summary)
  const [skillSummary, setSkillSummary] = useState<SkillSummary | null>(null)
  const [skillSummaryLoading, setSkillSummaryLoading] = useState(true)
  const [skillEditMode, setSkillEditMode] = useState(false)
  const [skillSaving, setSkillSaving] = useState(false)
  const [skillSaveMsg, setSkillSaveMsg] = useState('')
  const [editDesignation, setEditDesignation] = useState('')
  const [editCurrentSkill, setEditCurrentSkill] = useState('')
  const [editTotalExp, setEditTotalExp] = useState(0)
  const [editSkillExp, setEditSkillExp] = useState(0)
  const [skillCategories, setSkillCategories] = useState<string[]>([])

  const [editSummary, setEditSummary] = useState('')
  const [editExperience, setEditExperience] = useState(0)
  const [editSkills, setEditSkills] = useState<{ category: string; skills: string }[]>([])
  const [editWorkExps, setEditWorkExps] = useState<WorkExpEdit[]>([])
  const [editCertifications, setEditCertifications] = useState<string[]>([])
  const [editAchievements, setEditAchievements] = useState<string[]>([])

  // View accordion state
  const [viewWEOpen, setViewWEOpen] = useState(false)
  const [viewOpenEntries, setViewOpenEntries] = useState<Set<number>>(new Set())
  const [viewOpenProjects, setViewOpenProjects] = useState<Set<string>>(new Set())

  // Edit accordion state
  const [editOpenEntries, setEditOpenEntries] = useState<Set<number>>(new Set())
  const [editOpenProjects, setEditOpenProjects] = useState<Set<string>>(new Set())

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
        // New employees (no resume yet) land on Upload; existing employees land on My Profile.
        if (!initialTabSet) {
          setTab(data.data.hasResume ? 'profile' : 'upload')
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

  const startSkillEdit = () => {
    setEditDesignation(skillSummary?.current_designation || '')
    setEditCurrentSkill(skillSummary?.current_skill || '')
    setEditTotalExp(skillSummary?.total_exp || 0)
    setEditSkillExp(skillSummary?.current_skill_exp || 0)
    setSkillEditMode(true)
    setSkillSaveMsg('')
  }

  const handleSkillSave = async () => {
    setSkillSaving(true)
    setSkillSaveMsg('')
    try {
      const { data } = await api.put('/employee-skill-summary', {
        email: user!.email,
        current_designation: editDesignation,
        current_skill: editCurrentSkill,
        total_exp: editTotalExp,
        current_skill_exp: editSkillExp,
      })
      if (data.status === 'success') {
        setSkillSummary(data.data)
        setSkillSaveMsg('Experience snapshot saved successfully!')
        setSkillEditMode(false)
      } else {
        setSkillSaveMsg(data.message || 'Failed to save. Please try again.')
      }
    } catch {
      setSkillSaveMsg('Failed to save. Please try again.')
    } finally {
      setSkillSaving(false)
    }
  }

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

  const startEdit = () => {
    const r = profile?.resume
    setEditSummary(r?.profile_summary || '')
    setEditExperience(r?.total_experience || 0)
    setEditSkills(
      r?.technical_skills
        ? Object.entries(r.technical_skills).map(([cat, skills]) => ({ category: cat, skills: skills.join(', ') }))
        : [{ category: '', skills: '' }]
    )
    setEditWorkExps(r?.work_experience ? toWorkExpEdits(r.work_experience) : [blankWorkExp()])
    setEditCertifications(r?.certifications ?? [])
    setEditAchievements(r?.achievements ?? [])
    setEditOpenEntries(new Set())
    setEditOpenProjects(new Set())
    setEditMode(true)
    setSaveMsg('')
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api.put('/employee-profile', {
        email: user!.email,
        profile_summary: editSummary,
        total_experience: editExperience,
        technical_skills: Object.fromEntries(
          editSkills
            .filter(s => s.category.trim())
            .map(s => [s.category.trim(), s.skills.split(',').map(x => x.trim()).filter(Boolean)])
        ),
        personal_info: profile?.resume?.personal_info,
        work_experience: fromWorkExpEdits(editWorkExps),
        certifications: editCertifications.map(s => s.trim()).filter(Boolean),
        achievements: editAchievements.map(s => s.trim()).filter(Boolean),
      })
      setSaveMsg('Profile saved successfully!')
      setEditMode(false)
      await fetchProfile()
    } catch {
      setSaveMsg('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

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
        // Resume now exists — move off the Upload tab, which will be hidden on next render.
        setTab('profile')
      } else {
        setUploadMsg(reply.message || data.message || 'Upload failed. Please try again.')
      }
    } catch {
      setUploadMsg('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleLogout = () => { logout(); navigate('/login') }

  const resume = profile?.resume
  // Existing employees already have resume data seeded/uploaded server-side, so they
  // manage their profile via My Profile + Experience Snapshot and never see Upload again.
  // Only employees with no resume data yet (new joiners) see the Upload Resume tab.
  const hasResume = !!profile?.hasResume
  const visibleTabs = hasResume
    ? [
        { key: 'profile' as Tab, label: 'My Profile' },
        { key: 'experience' as Tab, label: 'Skill Profile' },
      ]
    : [{ key: 'upload' as Tab, label: 'Upload Resume' }]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-bold text-gray-800 text-lg">ResumeSync</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-700">{user?.fullName || user?.email}</p>
              <p className="text-xs text-gray-400">{user?.employeeId}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-gray-600 transition p-2 rounded-lg hover:bg-gray-100"
              title="Sign out"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">
            Welcome back, {user?.fullName?.split(' ')[0] || 'there'}!
          </h1>
          <p className="text-gray-400 mt-1">Manage your profile and resume from here.</p>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-8">
          {visibleTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <div className="space-y-6">
            {profileLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading profile...</p>
                </div>
              </div>
            ) : !resume ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No profile data yet</h3>
                <p className="text-gray-400 text-sm mb-6">Upload your resume to get started. We'll extract your information automatically.</p>
                <button
                  onClick={() => setTab('upload')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition text-sm"
                >
                  Upload Resume
                </button>
              </div>
            ) : editMode ? (
              /* ── Edit Form ── */
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-800">Edit Profile</h2>
                  <button onClick={() => setEditMode(false)} className="text-gray-400 hover:text-gray-600 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Profile Summary */}
                  <div className="bg-blue-50/50 rounded-xl p-4">
                    <label className="block text-sm font-semibold text-blue-700 mb-2">Profile Summary</label>
                    <textarea
                      value={editSummary}
                      onChange={e => setEditSummary(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-800 text-sm resize-none bg-white"
                    />
                  </div>

                  {/* Total Experience */}
                  <div className="bg-amber-50/50 rounded-xl p-4">
                    <label className="block text-sm font-semibold text-amber-700 mb-2">Total Experience (years)</label>
                    <input
                      type="number" min={0} value={editExperience}
                      onChange={e => setEditExperience(Number(e.target.value))}
                      className="w-32 px-4 py-3 rounded-xl border border-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-gray-800 text-sm bg-white"
                    />
                  </div>

                  {/* Technical Skills */}
                  <div className="bg-violet-50/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-violet-700">Technical Skills</label>
                      <button
                        type="button"
                        onClick={() => setEditSkills(prev => [...prev, { category: '', skills: '' }])}
                        className="text-xs text-violet-600 hover:text-violet-700 border border-violet-300 hover:border-violet-400 bg-white px-3 py-1 rounded-lg transition font-medium"
                      >
                        + Add Entry
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editSkills.map((skill, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={skill.category}
                            onChange={e => setEditSkills(prev => prev.map((s, i) => i === idx ? { ...s, category: e.target.value } : s))}
                            placeholder="Category (e.g. Backend)"
                            className="w-36 px-3 py-2 rounded-lg border border-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-gray-800 text-sm bg-white"
                          />
                          <input
                            type="text"
                            value={skill.skills}
                            onChange={e => setEditSkills(prev => prev.map((s, i) => i === idx ? { ...s, skills: e.target.value } : s))}
                            placeholder="Skills, comma separated (e.g. Python, FastAPI)"
                            className="flex-1 px-3 py-2 rounded-lg border border-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-gray-800 text-sm bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => setEditSkills(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-sm transition px-2 flex-shrink-0"
                          >✕</button>
                        </div>
                      ))}
                      {editSkills.length === 0 && (
                        <p className="text-xs text-violet-400 italic">No skills added. Click "+ Add Entry" to add one.</p>
                      )}
                    </div>
                  </div>

                  {/* ── Work Experience Accordion (Edit) ── */}
                  <div className="bg-green-50/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-green-700">Work Experience</label>
                      <button
                        type="button"
                        onClick={addEntry}
                        className="text-xs text-green-600 hover:text-green-700 border border-green-300 hover:border-green-400 bg-white px-3 py-1 rounded-lg transition font-medium"
                      >
                        + Add Entry
                      </button>
                    </div>

                    <div className="space-y-2">
                      {editWorkExps.map((we, idx) => (
                        <div key={idx} className="border border-green-100 rounded-xl overflow-hidden bg-white">
                          {/* Entry header */}
                          <div className="flex items-center gap-2 px-4 py-3 bg-green-50/60">
                            <button
                              type="button"
                              onClick={() => toggleEditEntry(idx)}
                              className="flex-1 flex items-center gap-2 text-left min-w-0"
                            >
                              <Chevron open={editOpenEntries.has(idx)} />
                              <div className="min-w-0">
                                <span className="text-sm font-medium text-gray-700 truncate block">
                                  {we.designation || we.company
                                    ? `${we.designation}${we.designation && we.company ? ' @ ' : ''}${we.company}`
                                    : `Entry ${idx + 1}`}
                                </span>
                                {we.duration && (
                                  <span className="text-xs text-gray-400">{we.duration}</span>
                                )}
                              </div>
                            </button>
                            {editWorkExps.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeEntry(idx)}
                                className="text-red-400 hover:text-red-600 text-xs transition flex-shrink-0"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          {/* Entry body */}
                          {editOpenEntries.has(idx) && (
                            <div className="p-4 space-y-3 border-t border-green-50">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Role / Designation</label>
                                  <input type="text" value={we.designation}
                                    onChange={e => updateWorkExp(idx, 'designation', e.target.value)}
                                    placeholder="e.g. Backend Developer"
                                    className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                                  <input type="text" value={we.company}
                                    onChange={e => updateWorkExp(idx, 'company', e.target.value)}
                                    placeholder="e.g. TechNova Solutions"
                                    className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                                  <input type="text" value={we.duration}
                                    onChange={e => updateWorkExp(idx, 'duration', e.target.value)}
                                    placeholder="e.g. Jan 2022 – Present"
                                    className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Company Description</label>
                                  <input type="text" value={we.companyDescription}
                                    onChange={e => updateWorkExp(idx, 'companyDescription', e.target.value)}
                                    placeholder="e.g. Product startup in fintech"
                                    className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm"
                                  />
                                </div>
                              </div>

                              {/* Projects within entry */}
                              <div className="pt-1">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</span>
                                  <button
                                    type="button"
                                    onClick={() => addProjectToEntry(idx)}
                                    className="text-xs text-green-600 hover:text-green-700 border border-green-200 hover:border-green-300 px-2.5 py-0.5 rounded-lg transition"
                                  >
                                    + Add Project
                                  </button>
                                </div>

                                <div className="space-y-1.5">
                                  {we.projects.length === 0 && (
                                    <p className="text-xs text-gray-400 italic">No projects. Click "+ Add Project" to add one.</p>
                                  )}
                                  {we.projects.map((proj, pIdx) => {
                                    const key = `${idx}-${pIdx}`
                                    return (
                                      <div key={pIdx} className="border border-green-100 rounded-lg overflow-hidden">
                                        {/* Project header */}
                                        <div className="flex items-center gap-2 px-3 py-2.5 bg-green-50/40">
                                          <button
                                            type="button"
                                            onClick={() => toggleEditProject(key)}
                                            className="flex-1 flex items-center gap-1.5 text-left min-w-0"
                                          >
                                            <svg
                                              className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${editOpenProjects.has(key) ? 'rotate-180' : ''}`}
                                              fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            >
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                            <span className="text-xs font-medium text-gray-600 truncate">
                                              {proj.name || `Project ${pIdx + 1}`}
                                            </span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => removeProjectFromEntry(idx, pIdx)}
                                            className="text-red-400 hover:text-red-600 text-xs transition flex-shrink-0"
                                          >
                                            Remove
                                          </button>
                                        </div>

                                        {/* Project form */}
                                        {editOpenProjects.has(key) && (
                                          <div className="p-3 space-y-2.5 border-t border-green-50">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                              <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Project Name</label>
                                                <input type="text" value={proj.name}
                                                  onChange={e => updateProjectInEntry(idx, pIdx, 'name', e.target.value)}
                                                  placeholder="e.g. Retail AI Platform"
                                                  className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                                                <input type="text" value={proj.client}
                                                  onChange={e => updateProjectInEntry(idx, pIdx, 'client', e.target.value)}
                                                  placeholder="e.g. Internal / Acme Corp"
                                                  className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Role in Project</label>
                                                <input type="text" value={proj.role}
                                                  onChange={e => updateProjectInEntry(idx, pIdx, 'role', e.target.value)}
                                                  placeholder="e.g. Backend Developer"
                                                  className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Technologies</label>
                                                <input type="text" value={proj.technologies}
                                                  onChange={e => updateProjectInEntry(idx, pIdx, 'technologies', e.target.value)}
                                                  placeholder="e.g. Python, FastAPI, MongoDB"
                                                  className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-500 mb-1">Project Description</label>
                                              <textarea value={proj.description}
                                                onChange={e => updateProjectInEntry(idx, pIdx, 'description', e.target.value)}
                                                rows={2} placeholder="Brief description of the project..."
                                                className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm resize-none"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-500 mb-1">Responsibilities</label>
                                              <textarea value={proj.responsibilities}
                                                onChange={e => updateProjectInEntry(idx, pIdx, 'responsibilities', e.target.value)}
                                                rows={3} placeholder="One responsibility per line..."
                                                className="w-full px-3 py-2 rounded-lg border border-green-100 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent text-gray-800 text-sm resize-none"
                                              />
                                              <p className="text-xs text-gray-400 mt-1">One per line</p>
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
                  </div>

                  {/* Certifications */}
                  <div className="bg-teal-50/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-teal-700">Certifications</label>
                      <button
                        type="button"
                        onClick={() => setEditCertifications(prev => [...prev, ''])}
                        className="text-xs text-teal-600 hover:text-teal-700 border border-teal-300 hover:border-teal-400 bg-white px-3 py-1 rounded-lg transition font-medium"
                      >
                        + Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editCertifications.map((cert, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input type="text" value={cert}
                            onChange={e => setEditCertifications(prev => prev.map((c, i) => i === idx ? e.target.value : c))}
                            placeholder="e.g. AWS Certified Solutions Architect"
                            className="flex-1 px-3 py-2 rounded-lg border border-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-gray-800 text-sm bg-white"
                          />
                          <button type="button"
                            onClick={() => setEditCertifications(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-sm transition px-2"
                          >✕</button>
                        </div>
                      ))}
                      {editCertifications.length === 0 && (
                        <p className="text-xs text-teal-400 italic">No certifications added.</p>
                      )}
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="bg-orange-50/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-semibold text-orange-700">Achievements</label>
                      <button
                        type="button"
                        onClick={() => setEditAchievements(prev => [...prev, ''])}
                        className="text-xs text-orange-600 hover:text-orange-700 border border-orange-300 hover:border-orange-400 bg-white px-3 py-1 rounded-lg transition font-medium"
                      >
                        + Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editAchievements.map((ach, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input type="text" value={ach}
                            onChange={e => setEditAchievements(prev => prev.map((a, i) => i === idx ? e.target.value : a))}
                            placeholder="e.g. Employee of the Quarter"
                            className="flex-1 px-3 py-2 rounded-lg border border-orange-100 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent text-gray-800 text-sm bg-white"
                          />
                          <button type="button"
                            onClick={() => setEditAchievements(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-sm transition px-2"
                          >✕</button>
                        </div>
                      ))}
                      {editAchievements.length === 0 && (
                        <p className="text-xs text-orange-400 italic">No achievements added.</p>
                      )}
                    </div>
                  </div>
                </div>

                {saveMsg && (
                  <div className={`mt-4 px-4 py-3 rounded-xl text-sm ${
                    saveMsg.includes('success') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                  }`}>
                    {saveMsg}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-xl font-medium transition text-sm flex items-center gap-2"
                  >
                    {saving ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Saving...
                      </>
                    ) : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-6 py-2.5 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-100 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* ── View Profile ── */
              <>
                {saveMsg && (
                  <div className="bg-green-50 text-green-700 border border-green-100 px-4 py-3 rounded-xl text-sm">
                    {saveMsg}
                  </div>
                )}

                {/* Header card */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-xl font-bold">
                        {(resume?.personal_info?.full_name || user?.fullName || user?.email || 'E')[0].toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-800">
                          {resume?.personal_info?.full_name || user?.fullName || '—'}
                        </h2>
                        <p className="text-gray-500 text-sm">{profile?.email}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {profile?.currentRole && (
                            <span className="text-xs text-gray-500">{profile.currentRole}</span>
                          )}
                          {resume?.total_experience !== undefined && (
                            <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
                              {resume.total_experience} yrs experience
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-4 py-2 rounded-xl transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Profile
                    </button>
                  </div>
                  {resume?.profile_summary && (
                    <div className="mt-5 pt-5 border-t border-gray-50">
                      <p className="text-sm font-medium text-gray-500 mb-2">About</p>
                      <p className="text-gray-700 text-sm leading-relaxed">{resume.profile_summary}</p>
                    </div>
                  )}
                </div>

                {/* Skills */}
                {resume?.technical_skills && Object.keys(resume.technical_skills).length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Technical Skills</h3>
                    <div className="space-y-3">
                      {Object.entries(resume.technical_skills).map(([cat, skills]) => (
                        <div key={cat} className="flex items-start gap-3">
                          <span className="text-xs font-medium text-gray-400 w-24 flex-shrink-0 pt-1 capitalize">{cat}</span>
                          <div className="flex flex-wrap gap-1.5">
                            {skills.map((s, i) => (
                              <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">{s}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Work Experience Accordion (View) ── */}
                {resume?.work_experience && resume.work_experience.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Level 1: heading row */}
                    <button
                      onClick={() => setViewWEOpen(v => !v)}
                      className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition"
                    >
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Work Experience</h3>
                      <Chevron open={viewWEOpen} />
                    </button>

                    {viewWEOpen && (
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {groupWorkExperience(resume.work_experience).map((group, i) => (
                          <div key={i}>
                            {/* Level 2: entry row */}
                            <button
                              onClick={() => toggleViewEntry(i)}
                              className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50 transition"
                            >
                              <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-sm">{group.designation}</p>
                                <p className="text-gray-500 text-xs mt-0.5">{group.company.name}</p>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                {group.duration && (
                                  <span className="text-xs text-gray-400 whitespace-nowrap">{group.duration}</span>
                                )}
                                <Chevron open={viewOpenEntries.has(i)} />
                              </div>
                            </button>

                            {/* Entry expanded: projects list */}
                            {viewOpenEntries.has(i) && (
                              <div className="px-6 pb-4 pt-1 space-y-2 bg-gray-50/40">
                                {group.projects.length === 0 ? (
                                  <p className="text-xs text-gray-400 italic py-2">No project details available.</p>
                                ) : (
                                  group.projects.map((proj, j) => {
                                    const key = `${i}-${j}`
                                    return (
                                      <div key={j} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                                        {/* Level 3: project row */}
                                        <button
                                          onClick={() => toggleViewProject(key)}
                                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition"
                                        >
                                          <div className="flex items-center gap-2 flex-wrap min-w-0">
                                            <span className="font-medium text-gray-700 text-xs">
                                              {proj?.name || 'Project'}
                                            </span>
                                            {proj?.client && (
                                              <span className="text-gray-400 text-xs">· {proj.client}</span>
                                            )}
                                            {proj?.role && (
                                              <span className="text-gray-400 text-xs">· {proj.role}</span>
                                            )}
                                          </div>
                                          <svg
                                            className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-3 ${viewOpenProjects.has(key) ? 'rotate-180' : ''}`}
                                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>

                                        {/* Project details */}
                                        {viewOpenProjects.has(key) && proj && (
                                          <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3">
                                            {proj.project_description && (
                                              <p className="text-gray-600 text-xs leading-relaxed">{proj.project_description}</p>
                                            )}
                                            {proj.environment && proj.environment.length > 0 && (
                                              <div className="flex flex-wrap gap-1.5">
                                                {proj.environment.map((skill, k) => (
                                                  <span key={k} className="bg-green-50 text-green-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                                    {skill}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                            {proj.responsibilities && proj.responsibilities.length > 0 && (
                                              <ul className="space-y-1">
                                                {proj.responsibilities.map((r, k) => (
                                                  <li key={k} className="flex items-start gap-1.5 text-xs text-gray-600">
                                                    <span className="text-green-500 mt-0.5 flex-shrink-0">›</span>
                                                    {r}
                                                  </li>
                                                ))}
                                              </ul>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Education */}
                {resume?.education && resume.education.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Education</h3>
                    <div className="space-y-4">
                      {resume.education.map((edu, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">{edu.institution}</p>
                            <p className="text-gray-500 text-xs mt-0.5">{edu.stream}</p>
                            <div className="flex items-center gap-3 mt-1">
                              {edu.year && <span className="text-xs text-gray-400">{edu.year}</span>}
                              <span className="text-xs text-gray-400">CGPA: {edu.cgpa}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certifications & Achievements */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {resume?.certifications && resume.certifications.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Certifications</h3>
                      <ul className="space-y-2">
                        {resume.certifications.map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-green-500 mt-0.5">✓</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {resume?.achievements && resume.achievements.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Achievements</h3>
                      <ul className="space-y-2">
                        {resume.achievements.map((a, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-yellow-500 mt-0.5">★</span>
                            {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Upload Tab */}
        {tab === 'upload' && (
          <div className="max-w-xl">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Upload Resume</h2>
              <p className="text-gray-400 text-sm mb-6">
                Upload your resume in PDF or DOCX format. We'll extract your information automatically using AI.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition ${
                  uploadFile ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={handleFileChange} className="hidden" />
                {uploadFile ? (
                  <div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="font-medium text-gray-800 text-sm">{uploadFile.name}</p>
                    <p className="text-gray-400 text-xs mt-1">{(uploadFile.size / 1024).toFixed(0)} KB · Click to change</p>
                  </div>
                ) : (
                  <div>
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="font-medium text-gray-700 text-sm">Click to upload or drag & drop</p>
                    <p className="text-gray-400 text-xs mt-1">PDF or DOCX · Max 10MB</p>
                  </div>
                )}
              </div>

              {!user?.employeeId && (
                <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-700 text-sm px-4 py-3 rounded-xl">
                  Your account doesn't have an Employee ID yet. Please contact HR to get set up.
                </div>
              )}

              {uploadMsg && (
                <div className={`mt-4 px-4 py-3 rounded-xl text-sm ${
                  uploadMsg.includes('success')
                    ? 'bg-green-50 text-green-700 border border-green-100'
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                  {uploadMsg}
                </div>
              )}

              <button
                onClick={handleUpload}
                disabled={!uploadFile || uploading || !user?.employeeId}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing resume...
                  </>
                ) : 'Upload & Process Resume'}
              </button>

              <p className="text-gray-400 text-xs text-center mt-4">
                Resume processing may take 30–60 seconds. You'll see your profile update automatically.
              </p>
            </div>
          </div>
        )}

        {/* Experience Snapshot Tab */}
        {tab === 'experience' && (
          <div className="max-w-2xl space-y-6">
            {skillSummaryLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-gray-400 text-sm">Loading skill profile...</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-semibold text-gray-800">Skill Profile</h2>
                  {!skillEditMode && (
                    <button
                      onClick={startSkillEdit}
                      className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-4 py-2 rounded-xl transition"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  )}
                </div>
                <p className="text-gray-400 text-sm mb-6">
                  A quick-reference profile of your current role and skill experience, used by HR for skill-wise resourcing.
                </p>

                {/* Static identity fields — never editable */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee ID</label>
                      <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 text-sm font-medium">{skillSummary?.employee_id || user?.employeeId}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</label>
                      <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 text-sm font-medium">{skillSummary?.name || user?.fullName}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</label>
                      <svg className="w-3 h-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-gray-700 text-sm font-medium truncate">{profile?.email || user?.email}</p>
                  </div>
                </div>

                {skillEditMode ? (
                  /* ── Edit Form ── */
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-blue-50/50 rounded-xl p-4">
                        <label className="block text-sm font-semibold text-blue-700 mb-2">Current Designation</label>
                        <input
                          type="text" value={editDesignation}
                          onChange={e => setEditDesignation(e.target.value)}
                          placeholder="e.g. Senior Software Engineer"
                          className="w-full px-3 py-2.5 rounded-xl border border-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-800 text-sm bg-white"
                        />
                      </div>
                      <div className="bg-violet-50/50 rounded-xl p-4">
                        <label className="block text-sm font-semibold text-violet-700 mb-2">Current Skill</label>
                        <select
                          value={editCurrentSkill}
                          onChange={e => setEditCurrentSkill(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent text-gray-800 text-sm bg-white"
                        >
                          <option value="" disabled>Select a skill...</option>
                          {skillCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="bg-amber-50/50 rounded-xl p-4">
                        <label className="block text-sm font-semibold text-amber-700 mb-2">Total Experience (years)</label>
                        <input
                          type="number" min={0} step={0.5} value={editTotalExp}
                          onChange={e => setEditTotalExp(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl border border-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent text-gray-800 text-sm bg-white"
                        />
                      </div>
                      <div className="bg-teal-50/50 rounded-xl p-4">
                        <label className="block text-sm font-semibold text-teal-700 mb-2">Current Skill Experience (years)</label>
                        <input
                          type="number" min={0} step={0.5} value={editSkillExp}
                          onChange={e => setEditSkillExp(Number(e.target.value))}
                          className="w-full px-3 py-2.5 rounded-xl border border-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent text-gray-800 text-sm bg-white"
                        />
                      </div>
                    </div>

                    {skillSaveMsg && (
                      <div className={`px-4 py-3 rounded-xl text-sm ${
                        skillSaveMsg.includes('success') ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {skillSaveMsg}
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={handleSkillSave}
                        disabled={skillSaving}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-xl font-medium transition text-sm flex items-center gap-2"
                      >
                        {skillSaving ? (
                          <>
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Saving...
                          </>
                        ) : 'Save Changes'}
                      </button>
                      <button
                        onClick={() => setSkillEditMode(false)}
                        className="px-6 py-2.5 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-100 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── View ── */
                  <>
                    {skillSaveMsg && (
                      <div className="bg-green-50 text-green-700 border border-green-100 px-4 py-3 rounded-xl text-sm mb-4">
                        {skillSaveMsg}
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-blue-50/50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Current Designation</p>
                        <p className="text-gray-800 text-sm">{skillSummary?.current_designation || '—'}</p>
                      </div>
                      <div className="bg-violet-50/50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wider mb-1">Current Skill</p>
                        <p className="text-gray-800 text-sm">{skillSummary?.current_skill || '—'}</p>
                      </div>
                      <div className="bg-amber-50/50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Total Experience</p>
                        <p className="text-gray-800 text-sm">{skillSummary?.total_exp ?? '—'} yrs</p>
                      </div>
                      <div className="bg-teal-50/50 rounded-xl p-4">
                        <p className="text-xs font-semibold text-teal-700 uppercase tracking-wider mb-1">Current Skill Experience</p>
                        <p className="text-gray-800 text-sm">{skillSummary?.current_skill_exp ?? '—'} yrs</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
