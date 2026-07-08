import { SectionCard, SectionHead } from './ui'

interface Props {
  certifications?: string[]
  achievements?: string[]
  onEditCerts: () => void
  onEditAchievements: () => void
}

export default function CertsAndAchievements({ certifications, achievements, onEditCerts, onEditAchievements }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <SectionCard>
        <SectionHead
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>}
          title="Certifications"
          action="edit"
          onAction={onEditCerts}
        />
        <div className="px-5 py-4">
          {certifications && certifications.length > 0 ? (
            <ul className="space-y-2">
              {certifications.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>{c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-300 italic">No certifications added.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHead
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
          title="Achievements"
          action="edit"
          onAction={onEditAchievements}
        />
        <div className="px-5 py-4">
          {achievements && achievements.length > 0 ? (
            <ul className="space-y-2">
              {achievements.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="text-yellow-500 mt-0.5 flex-shrink-0">★</span>{a}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-300 italic">No achievements added.</p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
