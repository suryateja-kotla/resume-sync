import Modal from '../ui/Modal'
import { FormLabel, FormInput, FormTextarea, IconChevron } from './ui'
import { WorkExpEdit, ProjectInEntry } from '../../types/employee'

export interface EducationEdit {
  institution: string
  stream: string
  year: string
  cgpa: string
}

// ─── Summary modal ─────────────────────────────────────────────────────────────

interface SummaryModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  summary: string
  experience: number
  onSummaryChange: (v: string) => void
  onExperienceChange: (v: number) => void
}

export function SummaryModal({
  open, onClose, onSave, saving, saveMsg,
  summary, experience, onSummaryChange, onExperienceChange,
}: SummaryModalProps) {
  return (
    <Modal open={open} title="Edit Summary" subtitle="Your professional overview and total experience"
      onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg}>
      <div>
        <FormLabel>Profile Summary</FormLabel>
        <FormTextarea value={summary} onChange={onSummaryChange} placeholder="A brief professional summary…" rows={5} />
      </div>
      <div>
        <FormLabel>Total Experience (years)</FormLabel>
        <FormInput type="number" value={experience} onChange={v => onExperienceChange(Number(v))} min={0} step={0.5} />
      </div>
    </Modal>
  )
}

// ─── Skills modal ──────────────────────────────────────────────────────────────

interface SkillRow { category: string; skills: string }

interface SkillsModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  editSkills: SkillRow[]
  onSkillsChange: (rows: SkillRow[]) => void
}

export function SkillsModal({
  open, onClose, onSave, saving, saveMsg, editSkills, onSkillsChange,
}: SkillsModalProps) {
  return (
    <Modal open={open} title="Edit Technical Skills" subtitle="Add category name and comma-separated skills"
      onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg}>
      <div className="space-y-2">
        {editSkills.map((skill, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <input
              type="text"
              value={skill.category}
              onChange={e => onSkillsChange(editSkills.map((s, i) => i === idx ? { ...s, category: e.target.value } : s))}
              placeholder="Category (e.g. Backend)"
              className="w-32 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm bg-white"
            />
            <input
              type="text"
              value={skill.skills}
              onChange={e => onSkillsChange(editSkills.map((s, i) => i === idx ? { ...s, skills: e.target.value } : s))}
              placeholder="Skills, comma separated"
              className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-800 text-sm bg-white"
            />
            <button type="button" onClick={() => onSkillsChange(editSkills.filter((_, i) => i !== idx))}
              className="text-red-400 hover:text-red-600 px-1 flex-shrink-0">✕</button>
          </div>
        ))}
        {editSkills.length === 0 && <p className="text-xs text-gray-400 italic">No skills added.</p>}
      </div>
      <button type="button"
        onClick={() => onSkillsChange([...editSkills, { category: '', skills: '' }])}
        className="text-sm text-blue-600 font-semibold hover:text-blue-700 border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full">
        + Add Category
      </button>
    </Modal>
  )
}

// ─── Experience modal ──────────────────────────────────────────────────────────

interface ExperienceModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  editWorkExps: WorkExpEdit[]
  openEntries: Set<number>
  openProjects: Set<string>
  onToggleEntry: (i: number) => void
  onToggleProject: (key: string) => void
  onUpdateWorkExp: (idx: number, field: keyof Omit<WorkExpEdit, 'projects'>, value: string) => void
  onUpdateProject: (entryIdx: number, projIdx: number, field: keyof ProjectInEntry, value: string) => void
  onAddEntry: () => void
  onRemoveEntry: (idx: number) => void
  onAddProject: (entryIdx: number) => void
  onRemoveProject: (entryIdx: number, projIdx: number) => void
}

export function ExperienceModal({
  open, onClose, onSave, saving, saveMsg,
  editWorkExps, openEntries, openProjects,
  onToggleEntry, onToggleProject,
  onUpdateWorkExp, onUpdateProject,
  onAddEntry, onRemoveEntry, onAddProject, onRemoveProject,
}: ExperienceModalProps) {
  return (
    <Modal open={open} title="Edit Work Experience" subtitle="Add or update companies and projects"
      onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg} wide>
      <div className="space-y-2">
        {editWorkExps.map((we, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-gray-50">
              <button type="button" onClick={() => onToggleEntry(idx)}
                className="flex-1 flex items-center gap-2 text-left min-w-0">
                <IconChevron open={openEntries.has(idx)} />
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
                <button type="button" onClick={() => onRemoveEntry(idx)}
                  className="text-red-400 hover:text-red-600 text-xs font-semibold flex-shrink-0">Remove</button>
              )}
            </div>

            {openEntries.has(idx) && (
              <div className="p-4 space-y-3 border-t border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <FormLabel>Role / Designation</FormLabel>
                    <FormInput value={we.designation} onChange={v => onUpdateWorkExp(idx, 'designation', v)} placeholder="e.g. Backend Developer" />
                  </div>
                  <div>
                    <FormLabel>Company</FormLabel>
                    <FormInput value={we.company} onChange={v => onUpdateWorkExp(idx, 'company', v)} placeholder="e.g. TechNova Solutions" />
                  </div>
                  <div>
                    <FormLabel>Duration</FormLabel>
                    <FormInput value={we.duration} onChange={v => onUpdateWorkExp(idx, 'duration', v)} placeholder="e.g. Jan 2022 – Present" />
                  </div>
                  <div>
                    <FormLabel>Company Description</FormLabel>
                    <FormInput value={we.companyDescription} onChange={v => onUpdateWorkExp(idx, 'companyDescription', v)} placeholder="e.g. Product startup in fintech" />
                  </div>
                </div>

                <div className="pt-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Projects</span>
                    <button type="button" onClick={() => onAddProject(idx)}
                      className="text-xs text-blue-600 font-semibold border border-blue-200 rounded-lg px-2.5 py-1 hover:bg-blue-50 transition">
                      + Add Project
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {we.projects.length === 0 && <p className="text-xs text-gray-400 italic">No projects yet.</p>}
                    {we.projects.map((proj, pIdx) => {
                      const key = `${idx}-${pIdx}`
                      return (
                        <div key={pIdx} className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50/60">
                            <button type="button" onClick={() => onToggleProject(key)}
                              className="flex-1 flex items-center gap-1.5 text-left min-w-0">
                              <IconChevron open={openProjects.has(key)} />
                              <span className="text-xs font-semibold text-gray-600 truncate">
                                {proj.name || `Project ${pIdx + 1}`}
                              </span>
                            </button>
                            <button type="button" onClick={() => onRemoveProject(idx, pIdx)}
                              className="text-red-400 hover:text-red-600 text-xs font-semibold flex-shrink-0">Remove</button>
                          </div>

                          {openProjects.has(key) && (
                            <div className="p-3 space-y-2.5 border-t border-gray-100">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div>
                                  <FormLabel>Project Name</FormLabel>
                                  <FormInput value={proj.name} onChange={v => onUpdateProject(idx, pIdx, 'name', v)} placeholder="e.g. Retail AI Platform" />
                                </div>
                                <div>
                                  <FormLabel>Client</FormLabel>
                                  <FormInput value={proj.client} onChange={v => onUpdateProject(idx, pIdx, 'client', v)} placeholder="e.g. Acme Corp" />
                                </div>
                                <div>
                                  <FormLabel>Role in Project</FormLabel>
                                  <FormInput value={proj.role} onChange={v => onUpdateProject(idx, pIdx, 'role', v)} placeholder="e.g. Backend Developer" />
                                </div>
                                <div>
                                  <FormLabel>Technologies (comma-separated)</FormLabel>
                                  <FormInput value={proj.technologies} onChange={v => onUpdateProject(idx, pIdx, 'technologies', v)} placeholder="e.g. Python, FastAPI, MongoDB" />
                                </div>
                              </div>
                              <div>
                                <FormLabel>Project Description</FormLabel>
                                <FormTextarea value={proj.description} onChange={v => onUpdateProject(idx, pIdx, 'description', v)} placeholder="Brief description…" rows={2} />
                              </div>
                              <div>
                                <FormLabel>Responsibilities (one per line)</FormLabel>
                                <FormTextarea value={proj.responsibilities} onChange={v => onUpdateProject(idx, pIdx, 'responsibilities', v)} placeholder="One responsibility per line…" rows={3} />
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
      <button type="button" onClick={onAddEntry}
        className="text-sm text-blue-600 font-semibold hover:text-blue-700 border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full">
        + Add Company / Role
      </button>
    </Modal>
  )
}

// ─── Certifications modal ──────────────────────────────────────────────────────

interface ListModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  items: string[]
  onItemsChange: (items: string[]) => void
  title: string
  subtitle: string
  placeholder: string
  addLabel: string
  emptyLabel: string
}

function ListModal({ open, onClose, onSave, saving, saveMsg, items, onItemsChange, title, subtitle, placeholder, addLabel, emptyLabel }: ListModalProps) {
  return (
    <Modal open={open} title={title} subtitle={subtitle} onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg}>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <FormInput
              value={item}
              onChange={v => onItemsChange(items.map((c, i) => i === idx ? v : c))}
              placeholder={placeholder}
            />
            <button type="button" onClick={() => onItemsChange(items.filter((_, i) => i !== idx))}
              className="text-red-400 hover:text-red-600 px-1 flex-shrink-0">✕</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400 italic">{emptyLabel}</p>}
      </div>
      <button type="button" onClick={() => onItemsChange([...items, ''])}
        className="text-sm text-blue-600 font-semibold border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full">
        {addLabel}
      </button>
    </Modal>
  )
}

export function CertsModal({ open, onClose, onSave, saving, saveMsg, items, onItemsChange }: Omit<ListModalProps, 'title' | 'subtitle' | 'placeholder' | 'addLabel' | 'emptyLabel'>) {
  return (
    <ListModal
      open={open} onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg}
      items={items} onItemsChange={onItemsChange}
      title="Edit Certifications" subtitle="List your professional certifications"
      placeholder="e.g. AWS Certified Solutions Architect"
      addLabel="+ Add Certification" emptyLabel="No certifications added."
    />
  )
}

export function AchievementsModal({ open, onClose, onSave, saving, saveMsg, items, onItemsChange }: Omit<ListModalProps, 'title' | 'subtitle' | 'placeholder' | 'addLabel' | 'emptyLabel'>) {
  return (
    <ListModal
      open={open} onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg}
      items={items} onItemsChange={onItemsChange}
      title="Edit Achievements" subtitle="Recognitions, awards, and notable accomplishments"
      placeholder="e.g. Employee of the Quarter"
      addLabel="+ Add Achievement" emptyLabel="No achievements added."
    />
  )
}

// ─── Skill Profile modal ───────────────────────────────────────────────────────

interface SkillProfileModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  employeeId?: string
  name?: string
  email?: string
  designation: string
  currentSkill: string
  totalExp: number
  skillExp: number
  primarySkill: string
  secondarySkill: string
  isOnBench: boolean
  skillCategories: string[]
  onDesignationChange: (v: string) => void
  onCurrentSkillChange: (v: string) => void
  onTotalExpChange: (v: number) => void
  onSkillExpChange: (v: number) => void
  onPrimarySkillChange: (v: string) => void
  onSecondarySkillChange: (v: string) => void
  onBenchToggle: () => void
}

export function SkillProfileModal({
  open, onClose, onSave, saving, saveMsg,
  employeeId, name, email,
  designation, currentSkill, totalExp, skillExp, primarySkill, secondarySkill, isOnBench,
  skillCategories,
  onDesignationChange, onCurrentSkillChange, onTotalExpChange, onSkillExpChange,
  onPrimarySkillChange, onSecondarySkillChange, onBenchToggle,
}: SkillProfileModalProps) {
  return (
    <Modal open={open} title="Edit Skill Profile" subtitle="Used by HR for skill allocation and tracking"
      onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg} wide>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Employee ID', val: employeeId },
          { label: 'Name', val: name },
          { label: 'Email', val: email },
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
          <FormInput value={designation} onChange={onDesignationChange} placeholder="e.g. Senior Software Engineer" />
        </div>
        <div>
          <FormLabel>Current Skill</FormLabel>
          <select
            value={currentSkill}
            onChange={e => onCurrentSkillChange(e.target.value)}
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
          <FormInput type="number" value={totalExp} onChange={v => onTotalExpChange(Number(v))} min={0} step={0.5} />
        </div>
        <div>
          <FormLabel>Current Skill Experience (years)</FormLabel>
          <FormInput type="number" value={skillExp} onChange={v => onSkillExpChange(Number(v))} min={0} step={0.5} />
        </div>
        <div>
          <FormLabel>Primary Skill</FormLabel>
          <FormInput value={primarySkill} onChange={onPrimarySkillChange} placeholder="e.g. Java" />
        </div>
        <div>
          <FormLabel>Secondary Skill</FormLabel>
          <FormInput value={secondarySkill} onChange={onSecondarySkillChange} placeholder="e.g. Python" />
        </div>
      </div>

      <div
        onClick={onBenchToggle}
        className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
          isOnBench ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
        }`}
      >
        <div>
          <p className={`text-sm font-semibold ${isOnBench ? 'text-amber-700' : 'text-gray-600'}`}>
            Currently on Bench
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Let HR know you're available for new project allocation</p>
        </div>
        <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${
          isOnBench ? 'bg-amber-400' : 'bg-gray-300'
        }`}>
          <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
            isOnBench ? 'translate-x-5' : 'translate-x-0'
          }`} />
        </div>
      </div>
    </Modal>
  )
}

// ─── Education modal ───────────────────────────────────────────────────────────

interface EducationModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  items: EducationEdit[]
  onItemsChange: (items: EducationEdit[]) => void
}

const blankEdu = (): EducationEdit => ({ institution: '', stream: '', year: '', cgpa: '' })

export function EducationModal({ open, onClose, onSave, saving, saveMsg, items, onItemsChange }: EducationModalProps) {
  const update = (idx: number, field: keyof EducationEdit, value: string) =>
    onItemsChange(items.map((e, i) => i === idx ? { ...e, [field]: value } : e))

  return (
    <Modal open={open} title="Edit Education" subtitle="Add or correct your academic background"
      onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg}>
      <div className="space-y-3">
        {items.map((edu, idx) => (
          <div key={idx} className="border border-gray-200 rounded-xl p-4 space-y-3 relative">
            <button type="button" onClick={() => onItemsChange(items.filter((_, i) => i !== idx))}
              className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-xs font-semibold">
              Remove
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <FormLabel>Institution</FormLabel>
                <FormInput value={edu.institution} onChange={v => update(idx, 'institution', v)} placeholder="e.g. VIT University" />
              </div>
              <div className="sm:col-span-2">
                <FormLabel>Degree / Stream</FormLabel>
                <FormInput value={edu.stream} onChange={v => update(idx, 'stream', v)} placeholder="e.g. B.Tech Computer Science" />
              </div>
              <div>
                <FormLabel>Year of Passing</FormLabel>
                <FormInput value={edu.year} onChange={v => update(idx, 'year', v)} placeholder="e.g. 2020" />
              </div>
              <div>
                <FormLabel>CGPA / Percentage</FormLabel>
                <FormInput value={edu.cgpa} onChange={v => update(idx, 'cgpa', v)} placeholder="e.g. 8.5" />
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400 italic">No education added.</p>}
      </div>
      <button type="button" onClick={() => onItemsChange([...items, blankEdu()])}
        className="text-sm text-blue-600 font-semibold border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full">
        + Add Education
      </button>
    </Modal>
  )
}

// ─── Interests modal ───────────────────────────────────────────────────────────

interface InterestsModalProps {
  open: boolean
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  items: string[]
  onItemsChange: (items: string[]) => void
}

export function InterestsModal({ open, onClose, onSave, saving, saveMsg, items, onItemsChange }: InterestsModalProps) {
  return (
    <Modal open={open} title="Edit Interests" subtitle="Hobbies and areas of interest"
      onClose={onClose} onSave={onSave} saving={saving} saveMsg={saveMsg}>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <FormInput
              value={item}
              onChange={v => onItemsChange(items.map((c, i) => i === idx ? v : c))}
              placeholder="e.g. Open source, Chess, Travelling"
            />
            <button type="button" onClick={() => onItemsChange(items.filter((_, i) => i !== idx))}
              className="text-red-400 hover:text-red-600 px-1 flex-shrink-0">✕</button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-gray-400 italic">No interests added.</p>}
      </div>
      <button type="button" onClick={() => onItemsChange([...items, ''])}
        className="text-sm text-blue-600 font-semibold border border-blue-200 rounded-xl px-4 py-2 hover:bg-blue-50 transition w-full">
        + Add Interest
      </button>
    </Modal>
  )
}
