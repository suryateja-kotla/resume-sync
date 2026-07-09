import { SectionCard, SectionHead } from './ui'

interface Props {
  certifications?: string[]
  achievements?: string[]
  onEditCerts: () => void
  onEditAchievements: () => void
}

export default function CertsAndAchievements({
  certifications,
  achievements,
  onEditCerts,
  onEditAchievements,
}: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* Certifications */}

      <SectionCard>

        <SectionHead
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
              />
            </svg>
          }
          title="Certifications"
          action="edit"
          onAction={onEditCerts}
        />

        <div className="px-6 py-6">

          {certifications?.length ? (

            <div className="space-y-3">

              {certifications.map((cert, index) => (

                <div
                  key={index}
                  className="
                    flex
                    items-start
                    gap-3
                    rounded-xl
                    border
                    border-emerald-100
                    bg-emerald-50/60
                    p-4
                    transition-all
                    duration-200
                    hover:shadow-md
                  "
                >

                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100">

                    <svg
                      className="w-4 h-4 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>

                  </div>

                  <p className="text-sm leading-6 text-slate-700">
                    {cert}
                  </p>

                </div>

              ))}

            </div>

          ) : (

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">

              <p className="text-sm text-slate-500">
                No certifications added yet.
              </p>

            </div>

          )}

        </div>

      </SectionCard>

      {/* Achievements */}

      <SectionCard>

        <SectionHead
          icon={
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.98 10.101c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          }
          title="Achievements"
          action="edit"
          onAction={onEditAchievements}
        />

        <div className="px-6 py-6">

          {achievements?.length ? (

            <div className="space-y-3">

              {achievements.map((achievement, index) => (

                <div
                  key={index}
                  className="
                    flex
                    items-start
                    gap-3
                    rounded-xl
                    border
                    border-amber-100
                    bg-amber-50/70
                    p-4
                    transition-all
                    duration-200
                    hover:shadow-md
                  "
                >

                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">

                    <svg
                      className="w-4 h-4 text-amber-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.12 3.447a1 1 0 00.95.69h3.623c.969 0 1.371 1.24.588 1.81l-2.931 2.13a1 1 0 00-.364 1.118l1.12 3.447c.3.922-.755 1.688-1.539 1.118l-2.93-2.13a1 1 0 00-1.176 0l-2.93 2.13c-.784.57-1.839-.197-1.539-1.118l1.12-3.447a1 1 0 00-.364-1.118L2.22 8.874c-.783-.57-.38-1.81.588-1.81h3.623a1 1 0 00.95-.69l1.668-3.447z"/>
                    </svg>

                  </div>

                  <p className="text-sm leading-6 text-slate-700">
                    {achievement}
                  </p>

                </div>

              ))}

            </div>

          ) : (

            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">

              <p className="text-sm text-slate-500">
                No achievements added yet.
              </p>

            </div>

          )}

        </div>

      </SectionCard>

    </div>
  )
}