import { SectionCard, SectionHead } from './ui'
import { Education } from '../../types/employee'

interface Props {
  education?: Education[]
  onEdit: () => void
}

export default function EducationSection({ education, onEdit }: Props) {
  return (
    <SectionCard>
      <SectionHead
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>}
        title="Education"
        action="edit"
        onAction={onEdit}
      />
      <div className="px-6 py-6">
        {education && education.length > 0 ? (
          <div className="space-y-5">
            {education.map((edu, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-800">{edu.institution}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{edu.stream}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {edu.year && <span className="text-sm text-gray-400">{edu.year}</span>}
                    {edu.cgpa ? <span className="text-sm text-gray-400">· CGPA {edu.cgpa}</span> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-300 italic">No education details extracted. Edit profile to add.</p>
        )}
      </div>
    </SectionCard>
  )
}
