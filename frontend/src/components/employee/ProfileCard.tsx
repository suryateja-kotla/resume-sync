import {
  ProfileData,
  SkillSummary,
  groupWorkExperience,
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
  onEditProfile?: () => void;
}

const IconMapPin = () => (
  <svg
    className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const IconCalendar = () => (
  <svg
    className="w-3.5 h-3.5 text-gray-400 flex-shrink-0"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

export default function ProfileCard({
  displayName,
  profile,
  skillSummary,
  skillSummaryLoading,
  completeness,
  completePct,
  onEditSkillProfile,
  onEditProfile,
}: Props) {
  const resume = profile?.resume;

  return (
    <div className="w-full lg:w-[370px] xl:w-[390px] flex-shrink-0 flex flex-col gap-5 lg:sticky lg:top-[84px]">
      {/* Profile Card */}
      <SectionCard className="overflow-hidden p-0 hover:shadow-2xl transition-all duration-300">
        {/* Banner */}
        <div className="relative h-32 bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-600">
          {/* Avatar */}
          <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
            <div className="w-28 h-28 rounded-full bg-white p-1 shadow-xl">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-4xl font-bold">
                {initials(displayName)}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="pt-20 pb-6 px-6">
          {/* Name */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-800 leading-tight">
              {displayName || "Employee"}
            </h2>

            <p className="mt-2 text-lg font-medium text-gray-600">
              {skillSummary?.current_designation ||
                profile?.currentRole ||
                "Software Engineer"}
            </p>

            <p className="text-sm text-gray-400 mt-1">
              {profile?.employeeId || profile?.employee_id || ""}
            </p>
          </div>

          {/* Contact */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <svg
                className="w-5 h-5 text-blue-500"
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
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <svg
                  className="w-5 h-5 text-violet-500"
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

          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {skillSummary?.current_skill && (
              <span className="px-4 py-2 rounded-full bg-blue-100 text-blue-700 font-semibold text-xs">
                {skillSummary.current_skill}
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold ${
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

          <div className="grid grid-cols-3 gap-3 mt-8">
            <div className="rounded-2xl bg-blue-50 p-4 text-center">
              <p className="text-2xl font-bold text-blue-700">
                {skillSummary?.total_exp ?? resume?.total_experience ?? "—"}
              </p>

              <p className="text-xs mt-1 text-gray-500">Experience</p>
            </div>

            <div className="rounded-2xl bg-violet-50 p-4 text-center">
              <p className="text-2xl font-bold text-violet-700">
                {resume?.work_experience
                  ? groupWorkExperience(resume.work_experience).length
                  : "—"}
              </p>

              <p className="text-xs mt-1 text-gray-500">Companies</p>
            </div>

            <div className="rounded-2xl bg-green-50 p-4 text-center">
              <p className="text-2xl font-bold text-green-700">
                {resume?.technical_skills
                  ? Object.values(resume.technical_skills).flat().length
                  : "—"}
              </p>

              <p className="text-xs mt-1 text-gray-500">Skills</p>
            </div>
          </div>
        </div>
      </SectionCard>

{/* Profile Completion */}
<SectionCard className="overflow-hidden">

  <div className="px-6 py-6">

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
      <span className="text-3xl font-extrabold text-slate-800">{completePct}%</span>
      <span className="text-sm text-slate-400">
        · {completeness.filter(c => c.done).length} of {completeness.length} sections
      </span>
    </div>

    {/* Progress */}

    <div className="mt-3 h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 transition-all duration-500"
        style={{ width: `${completePct}%` }}
      />
    </div>

    {/* Checklist — always visible, no expand/collapse */}

    <div className="mt-4 grid grid-cols-2 gap-2">
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
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
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
        <div className="px-6 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-gray-400 font-bold">
                Skill Profile
              </p>

              <h3 className="text-lg font-bold text-gray-800 mt-1">
                Professional Details
              </h3>
            </div>

            <button
              onClick={onEditSkillProfile}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition"
            >
              <IconEdit />
              Edit
            </button>
          </div>

          {skillSummaryLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              {/* Skill Cards */}

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-xs uppercase text-blue-500 font-semibold">
                    Current Skill
                  </p>

                  <p className="mt-2 font-bold text-gray-800 text-lg">
                    {skillSummary?.current_skill || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4">
                  <p className="text-xs uppercase text-violet-500 font-semibold">
                    Skill Experience
                  </p>

                  <p className="mt-2 font-bold text-gray-800 text-lg">
                    {skillSummary?.current_skill_exp ?? "—"} yrs
                  </p>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
                  <p className="text-xs uppercase text-green-600 font-semibold">
                    Primary Skill
                  </p>

                  <p className="mt-2 font-bold text-gray-800">
                    {skillSummary?.primary_skill || "—"}
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <p className="text-xs uppercase text-orange-600 font-semibold">
                    Secondary Skill
                  </p>

                  <p className="mt-2 font-bold text-gray-800">
                    {skillSummary?.secondary_skill || "—"}
                  </p>
                </div>
              </div>

              {/* Divider */}

              <div className="my-6 border-t border-gray-100" />

              {/* Bench Status */}

              <div
                className={`rounded-2xl p-5 border transition-all duration-300 ${
                  skillSummary?.is_on_bench
                    ? "border-amber-200 bg-amber-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-800">
                      {skillSummary?.is_on_bench
                        ? "Available for Allocation"
                        : "Currently Assigned"}
                    </h4>

                    <p className="text-sm text-gray-500 mt-1">
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
