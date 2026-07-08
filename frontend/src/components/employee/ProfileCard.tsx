import { ProfileData, SkillSummary, groupWorkExperience, initials } from '../../types/employee'
import { IconEdit, SectionCard } from './ui'

interface CompletenessItem { label: string; done: boolean }

interface Props {
  displayName: string
  profile: ProfileData | null
  skillSummary: SkillSummary | null
  skillSummaryLoading: boolean
  completeness: CompletenessItem[]
  completePct: number
  onEditSkillProfile: () => void
  onBenchToggle: () => void
}

export default function ProfileCard({
  displayName, profile, skillSummary, skillSummaryLoading,
  completeness, completePct, onEditSkillProfile, onBenchToggle,
}: Props) {
  const resume = profile?.resume

  return (
    <div className="w-64 flex-shrink-0 flex flex-col gap-4 sticky top-[57px]">

      {/* Profile card */}
      <SectionCard>
        <div className="h-16 bg-gradient-to-r from-blue-700 to-violet-600 rounded-t-2xl" />
        <div className="px-4 pb-5">
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
              onClick={onEditSkillProfile}
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
                onClick={onBenchToggle}
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
  )
}
