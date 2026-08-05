import { useState, useEffect, useRef, ChangeEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import {
  ProfileData, SkillSummary, ActiveModal,
  WorkExperienceItem, WorkExpEdit, ProjectInEntry,
} from '../types/employee'

// Section components
import Navbar from '../components/employee/Navbar'
import ProfileCard from '../components/employee/ProfileCard'
import SummarySection from '../components/employee/SummarySection'
import SkillsSection from '../components/employee/SkillsSection'
import ExperienceSection from '../components/employee/ExperienceSection'
import EducationSection from '../components/employee/EducationSection'
import CertsAndAchievements from '../components/employee/CertsAndAchievements'
import SkillHistory from '../components/employee/SkillHistory'
import UploadView from '../components/employee/UploadView'
import WelcomeBanner from '../components/employee/WelcomeBanner'
import ResumePreview from '../components/employee/ResumePreview'
import {
  SummaryModal, SkillsModal, ExperienceModal,
  CertsModal, AchievementsModal, SkillProfileModal,
  EducationModal, InterestsModal, EducationEdit,
} from '../components/employee/EditModals'
import { SectionCard, SectionHead } from '../components/employee/ui'

// ── Completeness helper ────────────────────────────────────────────────────────

const completenessItems = (resume?: ProfileData['resume'], skill?: SkillSummary | null) => [
  { label: 'Summary',        done: !!resume?.profile_summary },
  { label: 'Skills',         done: !!resume?.technical_skills && Object.keys(resume.technical_skills).length > 0 },
  { label: 'Experience',     done: !!resume?.work_experience && resume.work_experience.length > 0 },
  { label: 'Education',      done: !!resume?.education && resume.education.length > 0 },
  { label: 'Certifications', done: !!resume?.certifications && resume.certifications.length > 0 },
  { label: 'Skill Profile',  done: !!skill?.current_skill },
]

const labelToModal: Record<string, ActiveModal> = {
  'Summary': 'summary',
  'Skills': 'skills',
  'Experience': 'experience',
  'Education': 'education',
  'Certifications': 'certs',
  'Skill Profile': 'skillprofile',
}

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

  // ── Profile state ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [initialTabSet, setInitialTabSet] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

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

  // Experience modal accordion state
  const [editOpenEntries, setEditOpenEntries] = useState<Set<number>>(new Set())
  const [editOpenProjects, setEditOpenProjects] = useState<Set<string>>(new Set())

  // Snapshot of edit values taken when a modal opens — used to detect unsaved changes
  const editSnapshotRef = useRef<string>('')

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
      // No email parameter — the backend derives the employee from the
      // session, so a client can only ever fetch its own profile.
      const { data } = await api.get('/employee-profile')
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
      const { data } = await api.get('/employee-skill-summary')
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
    let snapshot: unknown = null

    if (m === 'summary') {
      const summary = r?.profile_summary || ''
      const experience = skillSummary?.total_exp ?? r?.total_experience ?? 0
      setEditSummary(summary)
      setEditExperience(experience)
      snapshot = { summary, experience }
    }
    if (m === 'skills') {
      const skills = r?.technical_skills
        ? Object.entries(r.technical_skills).map(([cat, skills]) => ({ category: cat, skills: skills.join(', ') }))
        : [{ category: '', skills: '' }]
      setEditSkills(skills)
      snapshot = skills
    }
    if (m === 'experience') {
      const workExps = r?.work_experience ? toWorkExpEdits(r.work_experience) : [blankWorkExp()]
      setEditWorkExps(workExps)
      setEditOpenEntries(new Set())
      setEditOpenProjects(new Set())
      snapshot = workExps
    }
    if (m === 'certs') {
      const certs = r?.certifications ?? []
      setEditCertifications(certs)
      snapshot = certs
    }
    if (m === 'achievements') {
      const achievements = r?.achievements ?? []
      setEditAchievements(achievements)
      snapshot = achievements
    }
    if (m === 'education') {
      const education = r?.education?.map(e => ({
        institution: e.institution || '',
        stream: e.stream || '',
        year: e.year || '',
        cgpa: e.cgpa != null ? String(e.cgpa) : '',
      })) ?? []
      setEditEducation(education)
      snapshot = education
    }
    if (m === 'interests') {
      const interests = r?.interests ?? []
      setEditInterests(interests)
      snapshot = interests
    }
    if (m === 'skillprofile') {
      const designation    = skillSummary?.current_designation || ''
      const currentSkill   = skillSummary?.current_skill || ''
      const totalExp       = skillSummary?.total_exp || 0
      const skillExp       = skillSummary?.current_skill_exp || 0
      const primarySkill   = skillSummary?.primary_skill || ''
      const secondarySkill = skillSummary?.secondary_skill || ''
      setEditDesignation(designation)
      setEditCurrentSkill(currentSkill)
      setEditTotalExp(totalExp)
      setEditSkillExp(skillExp)
      setEditPrimarySkill(primarySkill)
      setEditSecondarySkill(secondarySkill)
      snapshot = { designation, currentSkill, totalExp, skillExp, primarySkill, secondarySkill }
    }

    editSnapshotRef.current = JSON.stringify(snapshot)
    setActiveModal(m)
  }

  const closeModal = () => setActiveModal(null)

  // Returns true once the current edit state differs from the snapshot taken on open
  const isDirty = (current: unknown) => JSON.stringify(current) !== editSnapshotRef.current

  // ── Save handlers ──────────────────────────────────────────────────────────

  const patchResume = async (patch: Record<string, unknown>) => {
    setSaving(true)
    setSaveMsg('')
    try {
      const { data } = await api.put('/employee-profile', {
        personal_info: profile?.resume?.personal_info,
        profile_summary: profile?.resume?.profile_summary,
        total_experience: profile?.resume?.total_experience,
        technical_skills: profile?.resume?.technical_skills,
        work_experience: profile?.resume?.work_experience,
        certifications: profile?.resume?.certifications,
        achievements: profile?.resume?.achievements,
        ...patch,
      })
      // This route returns HTTP 200 even when the save failed validation —
      // status lives in the body, matching every other route in this file.
      // Skipping this check is exactly what showed "Saved successfully!"
      // over a save that silently did nothing.
      if (data.status !== 'success') {
        setSaveMsg(data.message || 'Failed to save. Please try again.')
        return
      }
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
        current_designation: editDesignation,
        current_skill: editCurrentSkill,
        total_exp: editTotalExp,
        current_skill_exp: editSkillExp,
        primary_skill: editPrimarySkill,
        secondary_skill: editSecondarySkill,
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
      // employee_id / employee_email are no longer sent — the backend takes
      // both from the session, so a caller cannot upload against someone
      // else's record.
      const form = new FormData()
      form.append('file', file)
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

  // logout() revokes the session server-side then navigates to /login itself,
  // so a navigate() here would only race it.
  const handleLogout = () => { logout() }
  const resume = profile?.resume
  const hasResume = !!profile?.hasResume
  const displayName = skillSummary?.name || user?.fullName || resume?.personal_info?.full_name || user?.email || ''
  const completeness = completenessItems(resume, skillSummary)
  const completePct = Math.round((completeness.filter(c => c.done).length / completeness.length) * 100)
  const firstPending = completeness.find(c => !c.done)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F6F8FC] flex flex-col">

      {/* Topbar */}
      <Navbar
        fullName={user?.fullName || undefined}
        email={user?.email}
        employeeId={user?.employeeId || undefined}
        onLogout={handleLogout}
      />

      {/* Canvas */}
      {/* Was `showUpload && !hasResume`, which made "Replace Resume" a no-op —
          the flag flipped but the view stayed hidden for anyone who already
          had a resume. onCancel is passed only in that case, since someone
          with no resume has nothing to go back to. */}
      {showUpload ? (
        <UploadView
          uploading={uploading}
          uploadFile={uploadFile}
          uploadMsg={uploadMsg}
          hasEmployeeId={!!user?.employeeId}
          onFileChange={handleFileChange}
          onUpload={handleUpload}
          isReplacing={hasResume}
          onCancel={hasResume ? () => { setShowUpload(false); setUploadFile(null); setUploadMsg('') } : undefined}
        />
      ) : profileLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading profile…</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-5 flex flex-col gap-4">

          {resume && (
            <WelcomeBanner
              name={displayName}
              completePct={completePct}
              pendingLabel={firstPending?.label}
              onCtaClick={
                firstPending ? () => openModal(labelToModal[firstPending.label]) : undefined
              }
              lastUpdatedAt={skillSummary?.updated_at}
            />
          )}

          <div className="flex flex-col lg:flex-row gap-4 items-start">

          {/* Left column */}
          <ProfileCard
            displayName={displayName}
            profile={profile}
            skillSummary={skillSummary}
            skillSummaryLoading={skillSummaryLoading}
            completeness={completeness}
            completePct={completePct}
            onEditSkillProfile={() => openModal('skillprofile')}
          />

          {/* Right column */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
            {saveMsg && !activeModal && (
              <div className={`px-4 py-3 rounded-xl text-sm border ${
                saveMsg.includes('success')
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : 'bg-rose-50 text-rose-700 border-rose-100'
              }`}>
                {saveMsg}
              </div>
            )}

            {!resume ? (
              <SectionCard>
                <div className="px-6 py-10 text-center">
                  <div className="w-12 h-12 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-700 mb-1">No profile data yet</h3>
                  <p className="text-sm text-slate-400 mb-5">Upload your resume to get started.</p>
                  <button onClick={() => setShowUpload(true)}
                    className="bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 hover:scale-[1.02] text-white px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-indigo-900/20 transition-all duration-200">
                    Upload Resume
                  </button>
                </div>
              </SectionCard>
            ) : (
              <>
                <div className="flex justify-end gap-2">
                  {/* Replacing a resume is a normal thing to want — a new
                      project, a certification, a role change. Without this the
                      only way to refresh the parsed data was to edit every
                      section by hand. Re-uploading re-parses and overwrites. */}
                  <button
                    onClick={() => setShowUpload(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-all duration-200 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Replace Resume
                  </button>
                  <button
                    onClick={() => setShowPreview(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 transition-all duration-200 hover:bg-violet-100"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Preview Resume
                  </button>
                </div>
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
                  <SectionCard>
                    <SectionHead
                      icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
                      title="Interests"
                      action="edit"
                      onAction={() => openModal('interests')}
                    />
                    <div className="px-5 py-5 flex flex-wrap gap-2">
                      {resume.interests.map((interest, i) => (
                        <span key={i} className="bg-pink-50 text-pink-700 border border-pink-100 text-xs font-medium px-3 py-1.5 rounded-full">
                          {interest}
                        </span>
                      ))}
                    </div>
                  </SectionCard>
                )}
                {/* Add interests when none exist */}
                {(!resume.interests || resume.interests.length === 0) && (
                  <button onClick={() => openModal('interests')}
                    className="w-full text-left bg-white rounded-2xl border border-dashed border-slate-200 px-5 py-3.5 text-sm text-slate-400 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50/40 transition-all flex items-center gap-2">
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
        </div>
      )}

      {/* Resume preview */}
      <ResumePreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        displayName={displayName}
        profile={profile}
      />

      {/* Modals */}
      <SummaryModal
        open={activeModal === 'summary'}
        onClose={closeModal}
        onSave={handleSaveSummary}
        saving={saving}
        saveMsg={saveMsg}
        dirty={isDirty({ summary: editSummary, experience: editExperience })}
        summary={editSummary}
        onSummaryChange={setEditSummary}
      />

      <SkillsModal
        open={activeModal === 'skills'}
        onClose={closeModal}
        onSave={handleSaveSkills}
        saving={saving}
        saveMsg={saveMsg}
        dirty={isDirty(editSkills)}
        editSkills={editSkills}
        onSkillsChange={setEditSkills}
      />

      <ExperienceModal
        open={activeModal === 'experience'}
        onClose={closeModal}
        onSave={handleSaveExperience}
        saving={saving}
        saveMsg={saveMsg}
        dirty={isDirty(editWorkExps)}
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
        dirty={isDirty(editCertifications)}
        items={editCertifications}
        onItemsChange={setEditCertifications}
      />

      <AchievementsModal
        open={activeModal === 'achievements'}
        onClose={closeModal}
        onSave={handleSaveAchievements}
        saving={saving}
        saveMsg={saveMsg}
        dirty={isDirty(editAchievements)}
        items={editAchievements}
        onItemsChange={setEditAchievements}
      />

      <SkillProfileModal
        open={activeModal === 'skillprofile'}
        onClose={closeModal}
        onSave={handleSaveSkillProfile}
        saving={skillSaving}
        saveMsg={skillSaveMsg}
        dirty={isDirty({
          designation: editDesignation,
          currentSkill: editCurrentSkill,
          totalExp: editTotalExp,
          skillExp: editSkillExp,
          primarySkill: editPrimarySkill,
          secondarySkill: editSecondarySkill,
        })}
        employeeId={skillSummary?.employee_id || user?.employeeId || undefined}
        name={skillSummary?.name || user?.fullName || undefined}
        email={profile?.email || user?.email || undefined}
        designation={editDesignation}
        currentSkill={editCurrentSkill}
        totalExp={editTotalExp}
        skillExp={editSkillExp}
        primarySkill={editPrimarySkill}
        secondarySkill={editSecondarySkill}
        skillCategories={skillCategories}
        onDesignationChange={setEditDesignation}
        onCurrentSkillChange={setEditCurrentSkill}
        onTotalExpChange={setEditTotalExp}
        onSkillExpChange={setEditSkillExp}
        onPrimarySkillChange={setEditPrimarySkill}
        onSecondarySkillChange={setEditSecondarySkill}
      />

      <EducationModal
        open={activeModal === 'education'}
        onClose={closeModal}
        onSave={handleSaveEducation}
        saving={saving}
        saveMsg={saveMsg}
        dirty={isDirty(editEducation)}
        items={editEducation}
        onItemsChange={setEditEducation}
      />

      <InterestsModal
        open={activeModal === 'interests'}
        onClose={closeModal}
        onSave={handleSaveInterests}
        saving={saving}
        saveMsg={saveMsg}
        dirty={isDirty(editInterests)}
        items={editInterests}
        onItemsChange={setEditInterests}
      />
    </div>
  )
}
