import { SectionCard, SectionHead } from './ui'

interface Props {
  summary?: string
  totalExp?: number
  skillSummaryExp?: number
  onEdit: () => void
}

export default function SummarySection({
  summary,
  onEdit,
}: Props) {
  return (
    <SectionCard
      className="
        overflow-hidden
        rounded-2xl
        border
        border-slate-200/70
        shadow-xl
        shadow-indigo-950/5
        hover:shadow-2xl
        hover:-translate-y-0.5
        transition-all
        duration-200
      "
    >
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        }
        title="Summary"
        action="edit"
        onAction={onEdit}
      />

      <div className="px-6 py-6">

        <p className="mb-5 text-sm text-slate-500">
          A quick overview of your professional background.
        </p>

        {summary ? (
          <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white via-violet-50/30 to-indigo-50/20 p-6">

            <p
              className="
                text-[16px]
                leading-[1.9]
                text-slate-700
                whitespace-pre-line
                max-w-4xl
              "
            >
              {summary}
            </p>

          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-violet-50 p-10 text-center">

            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">

              <svg
                className="w-5 h-5 text-violet-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>

            </div>

            <h3 className="text-base font-semibold text-slate-800">
              No Summary Available
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Add a professional summary to introduce yourself to HR and project managers.
            </p>

          </div>
        )}

      </div>
    </SectionCard>
  )
}