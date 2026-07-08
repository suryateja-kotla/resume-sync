import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import {
  ProfileData, SkillSummary, ActiveModal,
  WorkExperienceItem, WorkExpEdit, ProjectInEntry,
} from '../types/employee'
import { initials } from '../types/employee'

// Section components
import ProfileCard from '../components/employee/ProfileCard'
import SummarySection from '../components/employee/SummarySection'
import SkillsSection from '../components/employee/SkillsSection'
import ExperienceSection from '../components/employee/ExperienceSection'
import EducationSection from '../components/employee/EducationSection'
import CertsAndAchievements from '../components/employee/CertsAndAchievements'
import SkillHistory from '../components/employee/SkillHistory'
import UploadView from '../components/employee/UploadView'
import {
  SummaryModal, SkillsModal, ExperienceModal,
  CertsModal, AchievementsModal, SkillProfileModal,
  EducationModal, InterestsModal, EducationEdit,
} from '../components/employee/EditModals'
import { SectionCard } from '../components/employee/ui'

// ── Completeness helper ────────────────────────────────────────────────────────

const completenessItems = (resume?: ProfileData['resume'], skill?: SkillSummary | null) => [
  { label: 'Summary',        done: !!resume?.profile_summary },
  { label: 'Skills',         done: !!resume?.technical_skills && Object.keys(resume.technical_skills).length > 0 },
  { label: 'Experience',     done: !!resume?.work_experience && resume.work_experience.length > 0 },
  { label: 'Education',      done: !!resume?.education && resume.education.length > 0 },
  { label: 'Certifications', done: !!resume?.certifications && resume.certifications.length > 0 },
  { label: 'Skill Profile',  done: !!skill?.current_skill },
]

// ── Work experience edit helpers ───────────────────────────────────────────────

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

// ── Main Component ─────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [initialTabSet, setInitialTabSet] = useState(false)

  // ── Upload state ───────────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const uploadFileRef = useRef<File | null>(null)

  // ── Skill summary state ────────────────────────────────────────────────────
  const [skillSummary, setSkillSummary] = useState<SkillSummary | null>(null)
  const [skillSummaryLoading, setSkillSummaryLoading] = useState(true)
  const [skillSaving, setSkillSaving] = useState(false)
  const [skillSaveMsg, setSkillSaveMsg] = useState('')
  const [skillCategories, setSkillCategories] = useState<string[]>([])

  // ── Modal ──────────────────────────────────────────────────────────────────
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  // ── Edit field state ───────────────────────────────────────────────────────
  const [editSummary, setEditSummary] = useState('')
  const [editExperience, setEditExperience] = useState(0)
  const [editSkills, setEditSkills] = useState<{ category: string; skills: string }[]>([])
  const [editWorkExps, setEditWorkExps] = useState<WorkExpEdit[]>([])
  const [editCertifications, setEditCertifications] = useState<string[]>([])
  const [editAchievements, setEditAchievements] = useState<string[]>([])
  const [editEducation, setEditEducation] = useState<EducationEdit[]>([])
  const [editInterests, setEditInterests] = useState<string[]>([])

  // Skill profile edit state
  const [editDesignation, setEditDesignation] = useState('')
  const [editCurrentSkill, setEditCurrentSkill] = useState('')
  const [editTotalExp, setEditTotalExp] = useState(0)
  const [editSkillExp, setEditSkillExp] = useState(0)
  const [editPrimarySkill, setEditPrimarySkill] = useState('')
  const [editSecondarySkill, setEditSecondarySkill] = useState('')
  const [editIsOnBench, setEditIsOnBench] = useState(false)

  // Experience modal accordion state
  const [editOpenEntries, setEditOpenEntries] = useState<Set<number>>(new Set())
  const [editOpenProjects, setEditOpenProjects] = useState<Set<string>>(new Set())

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

  // ── Modal open ─────────────────────────────────────────────────────────────

  const openModal = (m: ActiveModal) => {
    setSaveMsg('')
    setSkillSaveMsg('')
    const r = profile?.resume
    if (m === 'summary') {
      setEditSummary(r?.profile_summary || '')
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
    if (m === 'education') {
      setEditEducation(
        r?.education?.map(e => ({
          institution: e.institution || '',
          stream: e.stream || '',
          year: e.year || '',
          cgpa: e.cgpa != null ? String(e.cgpa) : '',
        })) ?? []
      )
    }
    if (m === 'interests') setEditInterests(r?.interests ?? [])
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

  // ── Save handlers ──────────────────────────────────────────────────────────

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

  const handleSaveEducation = () =>
    patchResume({
      education: editEducation
        .filter(e => e.institution.trim())
        .map(e => ({
          institution: e.institution.trim(),
          stream: e.stream.trim(),
          year: e.year.trim() || undefined,
          cgpa: e.cgpa.trim() ? parseFloat(e.cgpa) : 0,
        })),
    })

  const handleSaveInterests = () =>
    patchResume({ interests: editInterests.map(s => s.trim()).filter(Boolean) })

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
    if (f) { setUploadFile(f); uploadFileRef.current = f }
  }

  const handleUpload = async () => {
    const file = uploadFile
    if (!file || !user?.employeeId) return
    setUploading(true)
    setUploadMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('employee_id', user.employeeId)
      form.append('employee_email', user.email)
      const { data } = await api.post('/upload-resume', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const reply = data.reply ?? data
      if (reply.status === 'success') {
        setUploadMsg('Resume uploaded and processed successfully!')
        setUploadFile(null)
        uploadFileRef.current = null
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

  // ── Bench toggle ───────────────────────────────────────────────────────────

  const handleBenchToggle = () => {
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
  }

  // ── Work experience accordion handlers ─────────────────────────────────────

  const updateWorkExp = (idx: number, field: keyof Omit<WorkExpEdit, 'projects'>, value: string) =>
    setEditWorkExps(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e))

  const updateProjectInEntry = (entryIdx: number, projIdx: number, field: keyof ProjectInEntry, value: string) =>
    setEditWorkExps(prev => prev.map((e, i) => i !== entryIdx ? e : {
      ...e, projects: e.projects.map((p, j) => j === projIdx ? { ...p, [field]: value } : p),
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
  const displayName = skillSummary?.name || user?.fullName || resume?.personal_info?.full_name || user?.email || ''
  const completeness = completenessItems(resume, skillSummary)
  const completePct = Math.round((completeness.filter(c => c.done).length / completeness.length) * 100)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Topbar */}
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
            <button onClick={() => navigate('/change-password')} title="Change password"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </button>
            <button onClick={handleLogout} title="Sign out"
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Canvas */}
      {showUpload && !hasResume ? (
        <UploadView
          uploading={uploading}
          uploadFile={uploadFile}
          uploadMsg={uploadMsg}
          hasEmployeeId={!!user?.employeeId}
          onFileChange={handleFileChange}
          onUpload={handleUpload}
        />
      ) : profileLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading profile…</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 max-w-screen-xl mx-auto w-full px-6 py-6 flex gap-5 items-start">

          {/* Left column */}
          <ProfileCard
            displayName={displayName}
            profile={profile}
            skillSummary={skillSummary}
            skillSummaryLoading={skillSummaryLoading}
            completeness={completeness}
            completePct={completePct}
            onEditSkillProfile={() => openModal('skillprofile')}
            onBenchToggle={handleBenchToggle}
          />

          {/* Right column */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {saveMsg && !activeModal && (
              <div className={`px-4 py-3 rounded-xl text-sm border ${
                saveMsg.includes('success')
                  ? 'bg-green-50 text-green-700 border-green-100'
                  : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {saveMsg}
              </div>
            )}

            {!resume ? (
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
                  <button onClick={() => setShowUpload(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition">
                    Upload Resume
                  </button>
                </div>
              </SectionCard>
            ) : (
              <>
                <SummarySection
                  summary={resume.profile_summary}
                  totalExp={resume.total_experience}
                  skillSummaryExp={skillSummary?.total_exp}
                  onEdit={() => openModal('summary')}
                />
                <SkillsSection
                  technicalSkills={resume.technical_skills}
                  onEdit={() => openModal('skills')}
                />
                <ExperienceSection
                  workExperience={resume.work_experience}
                  onEdit={() => openModal('experience')}
                />
                <EducationSection
                  education={resume.education}
                  onEdit={() => openModal('education')}
                />
                <CertsAndAchievements
                  certifications={resume.certifications}
                  achievements={resume.achievements}
                  onEditCerts={() => openModal('certs')}
                  onEditAchievements={() => openModal('achievements')}
                />
                {/* Interests */}
                {(resume.interests && resume.interests.length > 0) && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div className="flex items-center gap-2.5">
                        <span className="text-blue-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </span>
                        <span className="text-sm font-bold text-gray-800">Interests</span>
                      </div>
                      <button onClick={() => openModal('interests')}
                        className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Edit
                      </button>
                    </div>
                    <div className="px-5 py-4 flex flex-wrap gap-2">
                      {resume.interests.map((interest, i) => (
                        <span key={i} className="bg-pink-50 text-pink-700 border border-pink-100 text-xs font-medium px-3 py-1 rounded-full">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* Add interests when none exist */}
                {(!resume.interests || resume.interests.length === 0) && (
                  <button onClick={() => openModal('interests')}
                    className="w-full text-left bg-white rounded-2xl border border-dashed border-gray-200 px-5 py-3.5 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50/40 transition-all flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add interests &amp; hobbies
                  </button>
                )}
              </>
            )}

            {skillSummary?.skill_history && skillSummary.skill_history.length > 0 && (
              <SkillHistory history={skillSummary.skill_history} />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <SummaryModal
        open={activeModal === 'summary'}
        onClose={closeModal}
        onSave={handleSaveSummary}
        saving={saving}
        saveMsg={saveMsg}
        summary={editSummary}
        experience={editExperience}
        onSummaryChange={setEditSummary}
        onExperienceChange={setEditExperience}
      />

      <SkillsModal
        open={activeModal === 'skills'}
        onClose={closeModal}
        onSave={handleSaveSkills}
        saving={saving}
        saveMsg={saveMsg}
        editSkills={editSkills}
        onSkillsChange={setEditSkills}
      />

      <ExperienceModal
        open={activeModal === 'experience'}
        onClose={closeModal}
        onSave={handleSaveExperience}
        saving={saving}
        saveMsg={saveMsg}
        editWorkExps={editWorkExps}
        openEntries={editOpenEntries}
        openProjects={editOpenProjects}
        onToggleEntry={toggleEditEntry}
        onToggleProject={toggleEditProject}
        onUpdateWorkExp={updateWorkExp}
        onUpdateProject={updateProjectInEntry}
        onAddEntry={addEntry}
        onRemoveEntry={removeEntry}
        onAddProject={addProjectToEntry}
        onRemoveProject={removeProjectFromEntry}
      />

      <CertsModal
        open={activeModal === 'certs'}
        onClose={closeModal}
        onSave={handleSaveCerts}
        saving={saving}
        saveMsg={saveMsg}
        items={editCertifications}
        onItemsChange={setEditCertifications}
      />

      <AchievementsModal
        open={activeModal === 'achievements'}
        onClose={closeModal}
        onSave={handleSaveAchievements}
        saving={saving}
        saveMsg={saveMsg}
        items={editAchievements}
        onItemsChange={setEditAchievements}
      />

      <SkillProfileModal
        open={activeModal === 'skillprofile'}
        onClose={closeModal}
        onSave={handleSaveSkillProfile}
        saving={skillSaving}
        saveMsg={skillSaveMsg}
        employeeId={skillSummary?.employee_id || user?.employeeId || undefined}
        name={skillSummary?.name || user?.fullName || undefined}
        email={profile?.email || user?.email || undefined}
        designation={editDesignation}
        currentSkill={editCurrentSkill}
        totalExp={editTotalExp}
        skillExp={editSkillExp}
        primarySkill={editPrimarySkill}
        secondarySkill={editSecondarySkill}
        isOnBench={editIsOnBench}
        skillCategories={skillCategories}
        onDesignationChange={setEditDesignation}
        onCurrentSkillChange={setEditCurrentSkill}
        onTotalExpChange={setEditTotalExp}
        onSkillExpChange={setEditSkillExp}
        onPrimarySkillChange={setEditPrimarySkill}
        onSecondarySkillChange={setEditSecondarySkill}
        onBenchToggle={() => setEditIsOnBench(v => !v)}
      />

      <EducationModal
        open={activeModal === 'education'}
        onClose={closeModal}
        onSave={handleSaveEducation}
        saving={saving}
        saveMsg={saveMsg}
        items={editEducation}
        onItemsChange={setEditEducation}
      />

      <InterestsModal
        open={activeModal === 'interests'}
        onClose={closeModal}
        onSave={handleSaveInterests}
        saving={saving}
        saveMsg={saveMsg}
        items={editInterests}
        onItemsChange={setEditInterests}
      />
    </div>
  )
}
