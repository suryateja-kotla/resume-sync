import { SectionCard, SectionHead } from './ui'

interface Props {
  technicalSkills?: Record<string, string[]>
  onEdit: () => void
}

export default function SkillsSection({ technicalSkills, onEdit }: Props) {
  const hasSkills = technicalSkills && Object.keys(technicalSkills).length > 0

  return (
    <SectionCard className="bg-[#F8FAFF]">
      <SectionHead
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
        title="Technical Skills"
        action="edit"
        onAction={onEdit}
      />
      <div className="px-6 py-6">
        {hasSkills ? (
          <div className="space-y-4">
            {Object.entries(technicalSkills!).map(([cat, skills]) => (
              <div key={cat} className="flex items-start gap-3">
                <span className="text-[11px] font-semibold text-gray-400 w-24 flex-shrink-0 pt-1.5 uppercase tracking-wide">{cat}</span>
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 text-xs px-3 py-1.5 rounded-full font-medium hover:bg-blue-100 transition-colors cursor-default">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
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
  )
}
