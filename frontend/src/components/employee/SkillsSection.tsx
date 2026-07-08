import { SectionCard, SectionHead } from './ui'

interface Props {
  technicalSkills?: Record<string, string[]>
  onEdit: () => void
}

export default function SkillsSection({ technicalSkills, onEdit }: Props) {
  const hasSkills = technicalSkills && Object.keys(technicalSkills).length > 0

  return (
    <SectionCard>
      <SectionHead
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>}
        title="Technical Skills"
        action="edit"
        onAction={onEdit}
      />
      <div className="px-5 py-4">
        {hasSkills ? (
          <div className="space-y-3">
            {Object.entries(technicalSkills!).map(([cat, skills]) => (
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
  )
}
