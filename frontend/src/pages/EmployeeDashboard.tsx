import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'

type Tab = 'profile' | 'upload'

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

interface ProjectEdit {
  name: string
  description: string
  technologies: string
  role: string
  duration: string
}

interface StandaloneProject {
  name: string
  description?: string
  technologies?: string[]
  role?: string
  duration?: string
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
    projects?: StandaloneProject[]
  }
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

  const [editSummary, setEditSummary] = useState('')
  const [editExperience, setEditExperience] = useState(0)
  const [editSkillsRaw, setEditSkillsRaw] = useState('')
  const [editWorkExps, setEditWorkExps] = useState<WorkExpEdit[]>([])
  const [editProjects, setEditProjects] = useState<ProjectEdit[]>([])
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
    if (user?.email) fetchProfile()
  }, [user?.email])

  const fetchProfile = async () => {
    setProfileLoading(true)
    try {
      const { data } = await api.get('/employee-profile', { params: { email: user!.email } })
      if (data.status === 'success') setProfile(data.data)
    } catch { /* ignore */ }
    finally { setProfileLoading(false) }
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

  const blankProject = (): ProjectEdit => ({ name: '', description: '', technologies: '', role: '', duration: '' })

  const updateProject = (idx: number, field: keyof ProjectEdit, value: string) =>
    setEditProjects(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p))

  const toProjectEdits = (projects: StandaloneProject[]): ProjectEdit[] =>
    projects.map(p => ({
      name: p.name || '',
      description: p.description || '',
      technologies: p.technologies?.join(', ') || '',
      role: p.role || '',
      duration: p.duration || '',
    }))

  const fromProjectEdits = (edits: ProjectEdit[]): StandaloneProject[] =>
    edits.filter(p => p.name.trim()).map(p => ({
      name: p.name.trim(),
      description: p.description.trim() || undefined,
      technologies: p.technologies.split(',').map(s => s.trim()).filter(Boolean),
      role: p.role.trim() || undefined,
      duration: p.duration.trim() || undefined,
    }))

  const startEdit = () => {
    const r = profile?.resume
    setEditSummary(r?.profile_summary || '')
    setEditExperience(r?.total_experience || 0)
    setEditSkillsRaw(
      r?.technical_skills
        ? Object.entries(r.technical_skills).map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n')
        : ''
    )
    setEditWorkExps(r?.work_experience ? toWorkExpEdits(r.work_experience) : [blankWorkExp()])
    setEditProjects(r?.projects ? toProjectEdits(r.projects) : [])
    setEditCertifications(r?.certifications ?? [])
    setEditAchievements(r?.achievements ?? [])
    setEditOpenEntries(new Set())
    setEditOpenProjects(new Set())
    setEditMode(true)
    setSaveMsg('')
  }

  const parseSkills = (raw: string): Record<string, string[]> => {
    const result: Record<string, string[]> = {}
    raw.split('\n').forEach(line => {
      const [cat, ...rest] = line.split(':')
      if (cat && rest.length) {
        result[cat.trim()] = rest.join(':').split(',').map(s => s.trim()).filter(Boolean)
      }
    })
    return result
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg('')
    try {
      await api.put('/employee-profile', {
        email: user!.email,
        profile_summary: editSummary,
        total_experience: editExperience,
        technical_skills: parseSkills(editSkillsRaw),
        personal_info: profile?.resume?.personal_info,
        work_experience: fromWorkExpEdits(editWorkExps),
        projects: fromProjectEdits(editProjects),
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
          {[
            { key: 'profile', label: 'My Profile' },
            { key: 'upload', label: 'Upload Resume' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as Tab)}
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Profile Summary</label>
                    <textarea
                      value={editSummary}
                      onChange={e => setEditSummary(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm resize-none"
                    />
                  </div>

                  {/* Total Experience */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Experience (years)</label>
                    <input
                      type="number" min={0} value={editExperience}
                      onChange={e => setEditExperience(Number(e.target.value))}
                      className="w-32 px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                    />
                  </div>

                  {/* Technical Skills */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Technical Skills</label>
                    <p className="text-xs text-gray-400 mb-2">Format: category: skill1, skill2, skill3 (one per line)</p>
                    <textarea
                      value={editSkillsRaw}
                      onChange={e => setEditSkillsRaw(e.target.value)}
                      rows={5}
                      placeholder={'backend: Python, FastAPI, Node.js\nfrontend: React, TypeScript\ncloud: AWS, Docker'}
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm font-mono resize-none"
                    />
                  </div>

                  {/* ── Work Experience Accordion (Edit) ── */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Work Experience</label>
                      <button
                        type="button"
                        onClick={addEntry}
                        className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-lg transition"
                      >
                        + Add Entry
                      </button>
                    </div>

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
                            <div className="p-4 space-y-3 border-t border-gray-100">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Role / Designation</label>
                                  <input type="text" value={we.designation}
                                    onChange={e => updateWorkExp(idx, 'designation', e.target.value)}
                                    placeholder="e.g. Backend Developer"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Company</label>
                                  <input type="text" value={we.company}
                                    onChange={e => updateWorkExp(idx, 'company', e.target.value)}
                                    placeholder="e.g. TechNova Solutions"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                                  <input type="text" value={we.duration}
                                    onChange={e => updateWorkExp(idx, 'duration', e.target.value)}
                                    placeholder="e.g. Jan 2022 – Present"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-500 mb-1">Company Description</label>
                                  <input type="text" value={we.companyDescription}
                                    onChange={e => updateWorkExp(idx, 'companyDescription', e.target.value)}
                                    placeholder="e.g. Product startup in fintech"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
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
                                    className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-2.5 py-0.5 rounded-lg transition"
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
                                      <div key={pIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                                        {/* Project header */}
                                        <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/70">
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
                                          <div className="p-3 space-y-2.5 border-t border-gray-100">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                              <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Project Name</label>
                                                <input type="text" value={proj.name}
                                                  onChange={e => updateProjectInEntry(idx, pIdx, 'name', e.target.value)}
                                                  placeholder="e.g. Retail AI Platform"
                                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                                                <input type="text" value={proj.client}
                                                  onChange={e => updateProjectInEntry(idx, pIdx, 'client', e.target.value)}
                                                  placeholder="e.g. Internal / Acme Corp"
                                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Role in Project</label>
                                                <input type="text" value={proj.role}
                                                  onChange={e => updateProjectInEntry(idx, pIdx, 'role', e.target.value)}
                                                  placeholder="e.g. Backend Developer"
                                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                                                />
                                              </div>
                                              <div>
                                                <label className="block text-xs font-medium text-gray-500 mb-1">Technologies</label>
                                                <input type="text" value={proj.technologies}
                                                  onChange={e => updateProjectInEntry(idx, pIdx, 'technologies', e.target.value)}
                                                  placeholder="e.g. Python, FastAPI, MongoDB"
                                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                                                />
                                              </div>
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-500 mb-1">Project Description</label>
                                              <textarea value={proj.description}
                                                onChange={e => updateProjectInEntry(idx, pIdx, 'description', e.target.value)}
                                                rows={2} placeholder="Brief description of the project..."
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm resize-none"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-500 mb-1">Responsibilities</label>
                                              <textarea value={proj.responsibilities}
                                                onChange={e => updateProjectInEntry(idx, pIdx, 'responsibilities', e.target.value)}
                                                rows={3} placeholder="One responsibility per line..."
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm resize-none"
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

                  {/* Standalone Projects */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Projects</label>
                      <button
                        type="button"
                        onClick={() => setEditProjects(prev => [...prev, blankProject()])}
                        className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-lg transition"
                      >
                        + Add Project
                      </button>
                    </div>
                    <div className="space-y-4">
                      {editProjects.map((proj, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 relative">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Project {idx + 1}</span>
                            <button
                              type="button"
                              onClick={() => setEditProjects(prev => prev.filter((_, i) => i !== idx))}
                              className="text-red-400 hover:text-red-600 text-xs transition"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Project Name</label>
                              <input type="text" value={proj.name}
                                onChange={e => updateProject(idx, 'name', e.target.value)}
                                placeholder="e.g. E-Commerce Platform"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
                              <input type="text" value={proj.role}
                                onChange={e => updateProject(idx, 'role', e.target.value)}
                                placeholder="e.g. Lead Developer"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                              <input type="text" value={proj.duration}
                                onChange={e => updateProject(idx, 'duration', e.target.value)}
                                placeholder="e.g. Jan 2023 – Mar 2023"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Technologies</label>
                              <input type="text" value={proj.technologies}
                                onChange={e => updateProject(idx, 'technologies', e.target.value)}
                                placeholder="e.g. React, Node.js, MongoDB"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                            <textarea value={proj.description}
                              onChange={e => updateProject(idx, 'description', e.target.value)}
                              rows={2} placeholder="Brief description of the project..."
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm resize-none"
                            />
                          </div>
                        </div>
                      ))}
                      {editProjects.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No projects added yet. Click "+ Add Project" to add one.</p>
                      )}
                    </div>
                  </div>

                  {/* Certifications */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Certifications</label>
                      <button
                        type="button"
                        onClick={() => setEditCertifications(prev => [...prev, ''])}
                        className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-lg transition"
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
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                          />
                          <button type="button"
                            onClick={() => setEditCertifications(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-xs transition px-2"
                          >✕</button>
                        </div>
                      ))}
                      {editCertifications.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No certifications added.</p>
                      )}
                    </div>
                  </div>

                  {/* Achievements */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">Achievements</label>
                      <button
                        type="button"
                        onClick={() => setEditAchievements(prev => [...prev, ''])}
                        className="text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 px-3 py-1 rounded-lg transition"
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
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 text-sm"
                          />
                          <button type="button"
                            onClick={() => setEditAchievements(prev => prev.filter((_, i) => i !== idx))}
                            className="text-red-400 hover:text-red-600 text-xs transition px-2"
                          >✕</button>
                        </div>
                      ))}
                      {editAchievements.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No achievements added.</p>
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

                {/* Standalone Projects */}
                {resume?.projects && resume.projects.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Projects</h3>
                    <div className="space-y-5">
                      {resume.projects.map((proj, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-gray-800 text-sm">{proj.name}</p>
                                {proj.role && <p className="text-gray-500 text-xs mt-0.5">{proj.role}</p>}
                              </div>
                              {proj.duration && (
                                <span className="text-xs text-gray-400 whitespace-nowrap">{proj.duration}</span>
                              )}
                            </div>
                            {proj.description && (
                              <p className="text-gray-600 text-xs mt-1 leading-relaxed">{proj.description}</p>
                            )}
                            {proj.technologies && proj.technologies.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {proj.technologies.map((tech, j) => (
                                  <span key={j} className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">
                                    {tech}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
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
      </div>
    </div>
  )
}
