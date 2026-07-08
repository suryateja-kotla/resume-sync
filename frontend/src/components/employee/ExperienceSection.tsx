import { useState } from 'react'
import { SectionCard, SectionHead, IconChevron } from './ui'
import { WorkExperienceItem, groupWorkExperience } from '../../types/employee'

interface Props {
  workExperience?: WorkExperienceItem[]
  onEdit: () => void
}

export default function ExperienceSection({ workExperience, onEdit }: Props) {
  const [outerOpen, setOuterOpen] = useState(false)
  const [openEntries, setOpenEntries] = useState<Set<number>>(new Set())
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set())

  const toggleEntry = (i: number) => setOpenEntries(prev => {
    const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s
  })
  const toggleProject = (key: string) => setOpenProjects(prev => {
    const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s
  })

  const groups = workExperience ? groupWorkExperience(workExperience) : []

  return (
    <SectionCard>
      <SectionHead
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
        title="Work Experience"
        action="edit"
        actionLabel="Edit / Add"
        onAction={onEdit}
      />

      {groups.length > 0 ? (
        <div className="divide-y divide-gray-50">
          <button
            onClick={() => setOuterOpen(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-gray-50 transition"
          >
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {groups.length} position{groups.length !== 1 ? 's' : ''}
            </span>
            <IconChevron open={outerOpen} />
          </button>

          {outerOpen && (
            <div className="divide-y divide-gray-50">
              {groups.map((group, i) => (
                <div key={i}>
                  <button
                    onClick={() => toggleEntry(i)}
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
                      <IconChevron open={openEntries.has(i)} />
                    </div>
                  </button>

                  {openEntries.has(i) && (
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
                              onClick={() => hasDetails && toggleProject(key)}
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
                                {proj?.project_description && !openProjects.has(key) && (
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">{proj.project_description}</p>
                                )}
                              </div>
                              {hasDetails && <IconChevron open={openProjects.has(key)} />}
                            </button>

                            {openProjects.has(key) && proj && (
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
  )
}
