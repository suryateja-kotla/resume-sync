import { useState } from 'react'
import { SectionCard, SectionHead, IconChevron } from './ui'
import { WorkExperienceItem, groupByCompany } from '../../types/employee'

interface Props {
  workExperience?: WorkExperienceItem[]
  onEdit: () => void
}

export default function ExperienceSection({ workExperience, onEdit }: Props) {
  const [openEntries, setOpenEntries] = useState<Set<number>>(new Set())
  const [openProjects, setOpenProjects] = useState<Set<string>>(new Set())

  const toggleEntry = (i: number) => setOpenEntries(prev => {
    const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s
  })
  const toggleProject = (key: string) => setOpenProjects(prev => {
    const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s
  })

  const companies = workExperience ? groupByCompany(workExperience) : []

  return (
    <SectionCard>
      <SectionHead
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
        title="Work Experience"
        action="edit"
        actionLabel="Edit / Add"
        onAction={onEdit}
      />

      {companies.length > 0 ? (
        <div className="divide-y divide-slate-50">
          <div className="px-5 py-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {companies.length} {companies.length !== 1 ? 'companies' : 'company'}
            </span>
          </div>

          <div className="divide-y divide-slate-50">
            {companies.map((group, i) => {
              const roleSummary =
                group.roles.length === 1
                  ? group.roles[0].designation
                  : `${group.roles.length} roles`
              const durationSummary = group.roles.map(r => r.duration).filter(Boolean).join(' · ')

              return (
                <div key={i}>
                  <button
                    onClick={() => toggleEntry(i)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50 transition"
                  >
                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 text-sm font-bold text-violet-600">
                      {(group.company.name || 'C')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{group.company.name}</p>
                      <p className="text-xs text-slate-400 truncate">{roleSummary}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {durationSummary && <span className="text-xs text-slate-400 whitespace-nowrap hidden sm:inline">{durationSummary}</span>}
                      <IconChevron open={openEntries.has(i)} />
                    </div>
                  </button>

                  {openEntries.has(i) && (
                    <div className="px-5 pb-4 pt-1 bg-slate-50/60 space-y-3">
                      {group.roles.map((role, ri) => (
                        <div key={ri} className="space-y-2">
                          {/* Role header — always shown so multiple stints at one company stay distinct */}
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <p className="text-xs font-semibold text-slate-600">{role.designation || 'Role'}</p>
                            {role.duration && <span className="text-xs text-slate-400 whitespace-nowrap">{role.duration}</span>}
                          </div>

                          {role.projects.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No project details.</p>
                          ) : role.projects.map((proj, j) => {
                            const key = `${i}-${ri}-${j}`
                            const hasDetails = !!(
                              proj?.project_description ||
                              (proj?.environment && proj.environment.length > 0) ||
                              (proj?.responsibilities && proj.responsibilities.length > 0)
                            )
                            return (
                              <div key={j} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                <button
                                  onClick={() => hasDetails && toggleProject(key)}
                                  className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${hasDetails ? 'hover:bg-slate-50 cursor-pointer' : 'cursor-default'}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold text-slate-700">{proj?.name?.trim() || role.designation}</span>
                                      {proj?.client?.trim() && <span className="text-xs text-slate-400">· {proj.client}</span>}
                                      {proj?.role?.trim() && proj.role !== role.designation && (
                                        <span className="text-xs text-slate-400">· {proj.role}</span>
                                      )}
                                    </div>
                                    {proj?.project_description && !openProjects.has(key) && (
                                      <p className="text-xs text-slate-400 mt-0.5 truncate">{proj.project_description}</p>
                                    )}
                                  </div>
                                  {hasDetails && <IconChevron open={openProjects.has(key)} />}
                                </button>

                                {openProjects.has(key) && proj && (
                                  <div className="px-4 pb-4 pt-3 border-t border-slate-100 space-y-4">
                                    {proj.project_description && (
                                      <p className="text-[15px] text-slate-600 leading-relaxed">{proj.project_description}</p>
                                    )}
                                    {proj.environment && proj.environment.length > 0 && (
                                      <div className="flex flex-wrap gap-2">
                                        {proj.environment.map((sk, k) => (
                                          <span key={k} className="flex items-center gap-1.5 bg-violet-50 text-violet-700 border border-violet-100 text-xs px-3 py-1.5 rounded-full font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                                            {sk}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {proj.responsibilities && proj.responsibilities.length > 0 && (
                                      <ul className="space-y-1">
                                        {proj.responsibilities.map((r, k) => (
                                          <li key={k} className="flex items-start gap-1.5 text-[15px] text-slate-600 leading-relaxed">
                                            <span className="text-violet-400 mt-0.5 flex-shrink-0">›</span>{r}
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
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="px-5 py-5">
          <p className="text-sm text-slate-300 italic">No work experience added yet.</p>
        </div>
      )}
    </SectionCard>
  )
}
