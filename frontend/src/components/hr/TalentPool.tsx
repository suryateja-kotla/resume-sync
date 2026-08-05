import { useState, useEffect } from 'react'
import { Sparkles, Users, BriefcaseBusiness, ArrowRight, GraduationCap, MapPin } from 'lucide-react'
import { useCachedResource } from '../../hooks/useCachedResource'
import SkillChips from './SkillChips'

interface BenchMember {
  employee_id: string
  name?: string
  email?: string
  job_title?: string
  current_designation?: string
  current_skill?: string
  total_exp?: number
  current_skill_exp?: number
  primary_skill?: string
  secondary_skill?: string
  has_profile: boolean
}

interface Intern {
  employee_id: string
  name?: string
  email?: string
  job_title?: string
  employee_type?: string
  office_location?: string
}

interface Props {
  onCountChange: (count: number) => void
}

type Tab = 'bench' | 'interns'

export default function TalentPool({ onCountChange }: Props) {
  const [tab, setTab] = useState<Tab>('bench')

  // Both lists come from one call — membership derives from the Entra
  // department, so there is no manual bench flag to read any more.
  const { data, loading } = useCachedResource<{
    status: string; bench: BenchMember[]; interns: Intern[]
  }>('hr:talent-pool', '/hr/talent-pool')

  const bench = data?.status === 'success' ? data.bench : []
  const interns = data?.status === 'success' ? data.interns : []

  // The sidebar badge counts allocatable people, so interns are excluded.
  useEffect(() => { onCountChange(bench.length) }, [bench.length, onCountChange])

  const TabButton = ({ value, label, count }: { value: Tab; label: string; count: number }) => (
    <button
      onClick={() => setTab(value)}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
        tab === value
          ? 'bg-white text-violet-700 shadow-sm'
          : 'text-violet-100 hover:bg-white/10'
      }`}
    >
      {label}
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        tab === value ? 'bg-violet-100 text-violet-700' : 'bg-white/15 text-white'
      }`}>
        {count}
      </span>
    </button>
  )

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-5">

        {/* Header */}
        <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-700 via-indigo-700 to-fuchsia-700 p-5 text-white shadow-[0_25px_70px_-30px_rgba(79,70,229,0.7)] sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                  Talent Pool
                </div>
                <h2 className="text-xl font-semibold sm:text-2xl">People ready for the next assignment</h2>
                <p className="mt-2 text-sm text-violet-50">
                  Anyone whose department is <span className="font-medium">Talent Pool</span> in the
                  directory. They move out automatically once allocated to a project.
                </p>
              </div>
              <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur">
                <p className="text-violet-50">Available now</p>
                <p className="text-2xl font-semibold">{bench.length}</p>
              </div>
            </div>

            <div className="flex gap-2 rounded-2xl bg-black/15 p-1.5 backdrop-blur">
              <TabButton value="bench"   label="Bench"   count={bench.length} />
              <TabButton value="interns" label="Interns" count={interns.length} />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-slate-200 bg-white/80 shadow-sm backdrop-blur">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
              <p className="text-sm text-slate-500">Loading talent pool…</p>
            </div>
          </div>
        ) : tab === 'bench' ? (
          bench.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="No one on bench right now"
              body="Everyone is allocated. People appear here when their directory department is set to Talent Pool."
            />
          ) : (
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bench.map(emp => (
                <div key={emp.employee_id} className="group min-w-0 rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.2)] transition duration-200 hover:-translate-y-1 hover:border-violet-300 hover:shadow-[0_20px_45px_-25px_rgba(99,102,241,0.45)]">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-sm font-semibold text-white shadow-sm">
                      {emp.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800">{emp.name}</p>
                      <a href={`mailto:${emp.email}`} className="block truncate text-sm text-violet-600 hover:underline">{emp.email}</a>
                    </div>
                    <span className="flex-shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                      {emp.employee_id}
                    </span>
                  </div>

                  {/* Someone on bench who never built a profile is exactly who
                      HR needs to chase, so say so rather than showing blanks. */}
                  {!emp.has_profile && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      No skill profile yet — {emp.job_title || 'directory data only'}
                    </div>
                  )}

                  <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Designation</p>
                      <p className="text-sm font-medium text-slate-700">{emp.current_designation || emp.job_title || '—'}</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Current Skill</p>
                      <SkillChips value={emp.current_skill} maxChips={2} />
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Total Exp</p>
                      <p className="text-sm font-medium text-slate-700">{emp.total_exp ?? '—'} yrs</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Skill Exp</p>
                      <p className="text-sm font-medium text-slate-700">{emp.current_skill_exp ?? '—'} yrs</p>
                    </div>
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Primary Skill</p>
                      <SkillChips value={emp.primary_skill} maxChips={2} />
                    </div>
                    <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Secondary Skill</p>
                      <SkillChips value={emp.secondary_skill} maxChips={2} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50/80 px-3 py-2.5 text-sm text-violet-700">
                    <div className="flex items-center gap-2">
                      <BriefcaseBusiness className="h-4 w-4" />
                      Available for allocation
                    </div>
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          interns.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-7 w-7" />}
              title="No interns in the pool"
              body="Interns appear here from the directory. They cannot sign in until their employment type changes to permanent."
            />
          ) : (
            <>
              <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                Interns are shown for visibility only — they have no account and no profile.
                When their employment type changes to permanent, they are emailed an invite
                automatically and move to the Bench tab.
              </div>

              <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {interns.map(person => (
                  <div key={person.employee_id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.2)]">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-cyan-500 text-sm font-semibold text-white shadow-sm">
                        {person.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800">{person.name}</p>
                        <a href={`mailto:${person.email}`} className="block truncate text-sm text-sky-600 hover:underline">{person.email}</a>
                      </div>
                      <span className="flex-shrink-0 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                        {person.employee_id}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Role</p>
                        <p className="text-sm font-medium text-slate-700">{person.job_title || '—'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Employment Type</p>
                        <p className="text-sm font-medium text-slate-700">{person.employee_type || '—'}</p>
                      </div>
                      {person.office_location && (
                        <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
                          <MapPin className="h-3.5 w-3.5" />
                          {person.office_location}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-sky-100 bg-sky-50/80 px-3 py-2.5 text-sm text-sky-700">
                      <GraduationCap className="h-4 w-4" />
                      Sign-in not yet enabled
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-slate-800">{title}</h3>
      <p className="text-sm text-slate-500">{body}</p>
    </div>
  )
}
