import {
  ProfileData,
  SkillSummary,
  countUniqueCompanies,
  initials,
} from "../../types/employee";
import { IconEdit, SectionCard } from "./ui";

interface CompletenessItem {
  label: string;
  done: boolean;
}

interface Props {
  displayName: string;
  profile: ProfileData | null;
  skillSummary: SkillSummary | null;
  skillSummaryLoading: boolean;
  completeness: CompletenessItem[];
  completePct: number;
  onEditSkillProfile: () => void;
}

export default function ProfileCard({
  displayName,
  profile,
  skillSummary,
  skillSummaryLoading,
  completeness,
  completePct,
  onEditSkillProfile,
}: Props) {
  const resume = profile?.resume;

  return (
    <div className="w-full lg:w-[320px] xl:w-[340px] flex-shrink-0 flex flex-col gap-4 lg:sticky lg:top-[76px]">
      {/* Profile Card */}
      <SectionCard className="overflow-hidden p-0 hover:shadow-2xl transition-all duration-300">
        {/* Banner */}
        <div className="relative h-24 bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700">
          {/* Avatar */}
          <div className="absolute -bottom-11 left-1/2 -translate-x-1/2">
            <div className="w-[88px] h-[88px] rounded-full bg-white p-1 shadow-xl">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold">
                {initials(displayName)}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-14 pb-5 px-5">
          {/* Name */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 leading-tight">
              {displayName || "Employee"}
            </h2>

            <p className="mt-1.5 text-sm font-medium text-slate-600">
              {skillSummary?.current_designation ||
                profile?.currentRole ||
                "Software Engineer"}
            </p>

            <p className="text-xs text-slate-400 mt-1">
              {profile?.employeeId || ""}
            </p>
          </div>

          {/* Contact */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2.5 text-sm text-slate-600">
              <svg
                className="w-4 h-4 text-indigo-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l9 6 9-6"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 8v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8"
                />
              </svg>

              <span className="truncate">{profile?.email}</span>
            </div>

            {profile?.department && (
              <div className="flex items-center gap-2.5 text-sm text-slate-600">
                <svg
                  className="w-4 h-4 text-violet-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 21h16M4 10l8-6 8 6M6 10v8m4-8v8m4-8v8m4-8v8"
                  />
                </svg>

                {profile.department}
              </div>
            )}
          </div>

          {/* Badges */}

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {skillSummary?.current_skill && (
              <span className="px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 font-semibold text-xs">
                {skillSummary.current_skill}
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                skillSummary?.is_on_bench
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  skillSummary?.is_on_bench ? "bg-amber-500" : "bg-slate-400"
                }`}
              />
              {skillSummary?.is_on_bench ? "On Bench" : "Available"}
            </span>
          </div>

          {/* Statistics */}

          <div className="grid grid-cols-3 gap-2.5 mt-5">
            <div className="rounded-xl bg-indigo-50 p-2.5 text-center">
              <p className="text-lg font-bold text-indigo-700">
                {skillSummary?.total_exp ?? resume?.total_experience ?? "—"}
              </p>

              <p className="text-[11px] mt-0.5 text-slate-500">Experience</p>
            </div>

            <div className="rounded-xl bg-violet-50 p-2.5 text-center">
              <p className="text-lg font-bold text-violet-700">
                {resume?.work_experience
                  ? countUniqueCompanies(resume.work_experience)
                  : "—"}
              </p>

              <p className="text-[11px] mt-0.5 text-slate-500">Companies</p>
            </div>

            <div className="rounded-xl bg-emerald-50 p-2.5 text-center">
              <p className="text-lg font-bold text-emerald-700">
                {resume?.technical_skills
                  ? Object.values(resume.technical_skills).flat().length
                  : "—"}
              </p>

              <p className="text-[11px] mt-0.5 text-slate-500">Skills</p>
            </div>
          </div>
        </div>
      </SectionCard>

{/* Profile Completion */}
<SectionCard className="overflow-hidden">

  <div className="px-5 py-5">

    {/* Header */}

    <div className="flex items-center justify-between gap-3">

      <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-bold">
        Profile Completion
      </p>

      <span
        className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          completePct >= 90
            ? "bg-emerald-100 text-emerald-700"
            : completePct >= 70
            ? "bg-violet-100 text-violet-700"
            : "bg-amber-100 text-amber-700"
        }`}
      >
        {completePct >= 90
          ? "Excellent"
          : completePct >= 70
          ? "Good"
          : "Needs Improvement"}
      </span>

    </div>

    <div className="mt-1 flex items-baseline gap-1.5">
      <span className="text-2xl font-extrabold text-slate-800">{completePct}%</span>
      <span className="text-sm text-slate-400">
        · {completeness.filter(c => c.done).length} of {completeness.length} sections
      </span>
    </div>

    {/* Progress */}

    <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 transition-all duration-500"
        style={{ width: `${completePct}%` }}
      />
    </div>

    {/* Checklist — always visible, no expand/collapse */}

    <div className="mt-3.5 grid grid-cols-2 gap-2">
      {completeness.map(item => (
        <div
          key={item.label}
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${
            item.done
              ? "border-emerald-100 bg-emerald-50"
              : "border-amber-100 bg-amber-50"
          }`}
        >
          <span
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
              item.done
                ? "bg-emerald-100 text-emerald-600"
                : "bg-amber-100 text-amber-600"
            }`}
          >
            {item.done ? (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v4m0 4h.01" />
              </svg>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">
            {item.label}
          </span>
        </div>
      ))}
    </div>

    {/* Suggestion */}

    {completeness.some(c => !c.done) && (
      <div className="mt-3.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
        <p className="text-sm font-medium text-amber-700">
          Complete{" "}
          <span className="font-bold">
            {completeness.find(c => !c.done)?.label}
          </span>
          {" "}to improve your profile.
        </p>
      </div>
    )}

  </div>

</SectionCard>

      {/* Skill Profile card */}
      {/* Skill Profile */}
      <SectionCard className="overflow-hidden">
        <div className="px-5 py-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400 font-bold">
                Skill Profile
              </p>

              <h3 className="text-base font-bold text-slate-800 mt-1">
                Professional Details
              </h3>
            </div>

            <button
              onClick={onEditSkillProfile}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50 transition"
            >
              <IconEdit />
              Edit
            </button>
          </div>

          {skillSummaryLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* Values read from the resume rather than chosen. Current skill
                  inference is only ~68% accurate — a resume shows what someone
                  has accumulated, while current skill means the project they
                  are on now. Saying so is what makes the guess safe: otherwise
                  the profile looks confirmed and nobody corrects it. */}
              {(skillSummary?.prefilled_fields?.length ?? 0) > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs leading-relaxed text-amber-800">
                    We filled some of this in from your resume.{" "}
                    <button onClick={onEditSkillProfile} className="font-semibold underline underline-offset-2">
                      Please check it is right
                    </button>{" "}
                    — especially your current skill, which should reflect the
                    project you are on now.
                  </p>
                </div>
              )}

              {/* Skill Cards */}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                  <p className="text-xs uppercase text-indigo-500 font-semibold">
                    Current Skill
                  </p>

                  <p className="mt-1.5 font-bold text-slate-800 text-base">
                    {skillSummary?.current_skill || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
                  <p className="text-xs uppercase text-violet-500 font-semibold">
                    Skill Experience
                  </p>

                  <p className="mt-1.5 font-bold text-slate-800 text-base">
                    {skillSummary?.current_skill_exp ?? "—"} yrs
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-xs uppercase text-emerald-600 font-semibold">
                    Primary Skill
                  </p>

                  <p className="mt-1.5 font-bold text-slate-800 text-sm">
                    {skillSummary?.primary_skill || "—"}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <p className="text-xs uppercase text-amber-600 font-semibold">
                    Secondary Skill
                  </p>

                  <p className="mt-1.5 font-bold text-slate-800 text-sm">
                    {skillSummary?.secondary_skill || "—"}
                  </p>
                </div>
              </div>

              {/* Divider */}

              <div className="my-4 border-t border-slate-100" />

              {/* Bench Status */}

              <div
                className={`rounded-xl p-4 border transition-all duration-300 ${
                  skillSummary?.is_on_bench
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-slate-800">
                      {skillSummary?.is_on_bench
                        ? "Available for Allocation"
                        : "Currently Assigned"}
                    </h4>

                    <p className="text-sm text-slate-500 mt-1">
                      {skillSummary?.is_on_bench
                        ? "HR can assign you to new projects."
                        : "Click Edit above to change your bench status."}
                    </p>
                  </div>

                  {/* Read-only status indicator — actual toggling happens in the edit modal */}

                  <div
                    className={`w-14 h-8 rounded-full flex items-center px-1 opacity-70 ${
                      skillSummary?.is_on_bench
                        ? "bg-amber-400"
                        : "bg-slate-300"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full bg-white shadow-md transition-all ${
                        skillSummary?.is_on_bench ? "translate-x-6" : ""
                      }`}
                    />
                  </div>
                </div>
              </div>

             
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
