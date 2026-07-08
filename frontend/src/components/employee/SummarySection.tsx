import { SectionCard, SectionHead } from './ui'
import { SkillSummary } from '../../types/employee'

interface Props {
  summary?: string
  totalExp?: number
  skillSummaryExp?: number
  onEdit: () => void
}

export default function SummarySection({ summary, totalExp, skillSummaryExp, onEdit }: Props) {
  const displayExp = skillSummaryExp ?? totalExp

  return (
    <SectionCard>
      <SectionHead
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>}
        title="Summary"
        action="edit"
        onAction={onEdit}
      />
      <div className="px-5 py-4">
        {summary ? (
          <p className="text-sm text-gray-600 leading-relaxed">{summary}</p>
        ) : (
          <p className="text-sm text-gray-300 italic">No summary added yet. Click Edit to add one.</p>
        )}
        {displayExp !== undefined && (
          <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
            </svg>
            {displayExp} years of experience
          </div>
        )}
      </div>
    </SectionCard>
  )
}
