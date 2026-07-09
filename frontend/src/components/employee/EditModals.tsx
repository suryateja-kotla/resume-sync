import { useState, type KeyboardEvent, type ReactNode } from "react";
import Modal from "../ui/Modal";
import { FormLabel, FormInput, FormTextarea, IconChevron, IconPlus } from "./ui";
import { WorkExpEdit, ProjectInEntry, initials } from "../../types/employee";

export interface EducationEdit {
  institution: string;
  stream: string;
  year: string;
  cgpa: string;
}

// ─── Local icons ────────────────────────────────────────────────────────────────
// Small stroke-based icon set kept local to this file — mirrors the outline
// style used across ui.tsx / navbar.tsx.

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h12"
      />
    </svg>
  );
}

function IconBuilding({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 21h18M5 21V5a1 1 0 011-1h5a1 1 0 011 1v16M15 21v-9a1 1 0 011-1h3a1 1 0 011 1v9M9 7h.01M9 11h.01M9 15h.01"
      />
    </svg>
  );
}

function IconFolder({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7a2 2 0 012-2h4l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}

function IconGraduation({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 9v6m18-6v6M7 12.5V17c0 1.105 2.239 2 5 2s5-.895 5-2v-4.5"
      />
    </svg>
  );
}

function IconAward({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="5" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.5 12.5L7 21l5-2.5L17 21l-1.5-8.5" />
    </svg>
  );
}

function IconTrophy({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 5H4a1 1 0 00-1 1v1a3 3 0 003 3M17 5h3a1 1 0 011 1v1a3 3 0 01-3 3"
      />
    </svg>
  );
}

function IconHeart({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 21s-7.5-4.556-10-9.5C.5 7 3 3.5 6.5 3.5c2 0 3.5 1 5.5 3 2-2 3.5-3 5.5-3C21 3.5 23.5 7 22 11.5 19.5 16.444 12 21 12 21z"
      />
    </svg>
  );
}

function IconClock({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
    </svg>
  );
}

function IconBulb({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 18h6M10 21h4M12 3a6 6 0 00-3.6 10.8c.4.3.6.8.6 1.2v.5h6v-.5c0-.4.2-.9.6-1.2A6 6 0 0012 3z"
      />
    </svg>
  );
}

function IconTag({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20.59 13.41L11 3.83A2 2 0 009.59 3.24L4 3a1 1 0 00-1 1l.24 5.59a2 2 0 00.59 1.41l9.58 9.58a2 2 0 002.82 0l4.36-4.36a2 2 0 000-2.82z"
      />
      <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconXSmall({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ─── Local reusable building blocks ─────────────────────────────────────────────
// Shared across the modals below so repeated patterns (remove buttons, add
// buttons, empty states, icon chips, list rows) stay visually consistent.

function IconChip({
  icon,
  tone = "violet",
  size = "md",
}: {
  icon: ReactNode;
  tone?: "violet" | "slate";
  size?: "md" | "sm";
}) {
  const toneClasses =
    tone === "violet"
      ? "bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-700 ring-1 ring-violet-100"
      : "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
  const sizeClasses = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <div className={`flex flex-shrink-0 items-center justify-center rounded-xl ${sizeClasses} ${toneClasses}`}>
      {icon}
    </div>
  );
}

function RemoveIconButton({
  onClick,
  label = "Remove",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
    >
      <IconTrash />
    </button>
  );
}

function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 px-4 py-3 text-sm font-medium text-violet-700 transition-all duration-200 hover:border-violet-400 hover:bg-violet-50 active:scale-[0.99]"
    >
      <IconPlus />
      {children}
    </button>
  );
}

function EmptyState({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 py-10 text-center">
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-300 ring-1 ring-slate-200">
          {icon}
        </div>
      )}
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  );
}

function FormSelect({
  value,
  onChange,
  children,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm text-slate-700 transition-all duration-200 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100"
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <IconChevron open={false} />
      </div>
    </div>
  );
}

function ListItemRow({
  icon,
  value,
  onChange,
  placeholder,
  onRemove,
}: {
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white py-1 pl-3 pr-2 transition-all duration-200 hover:border-violet-200 focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-500">
        {icon}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
      <RemoveIconButton onClick={onRemove} label="Remove item" />
    </div>
  );
}

function SkillChipsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const skills = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const commitDraft = () => {
    const trimmed = draft.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed].join(", "));
    }
    setDraft("");
  };

  const removeSkill = (idx: number) => {
    onChange(skills.filter((_, i) => i !== idx).join(", "));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
    } else if (e.key === "Backspace" && draft === "" && skills.length > 0) {
      removeSkill(skills.length - 1);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 transition-all duration-200 focus-within:border-violet-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-violet-100">
      {skills.map((skill, idx) => (
        <span
          key={`${skill}-${idx}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-violet-100 bg-violet-50 py-1 pl-3 pr-1.5 text-sm font-medium text-violet-700"
        >
          {skill}
          <button
            type="button"
            onClick={() => removeSkill(idx)}
            aria-label={`Remove ${skill}`}
            className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-violet-400 transition-colors duration-150 hover:bg-violet-200 hover:text-violet-700"
          >
            <IconXSmall />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder={skills.length === 0 ? placeholder : "Add another…"}
        className="min-w-[120px] flex-1 border-0 bg-transparent py-1 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-0"
      />
    </div>
  );
}

// ─── Summary modal ─────────────────────────────────────────────────────────────

interface SummaryModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveMsg: string;
  summary: string;
  experience: number;
  onSummaryChange: (v: string) => void;
  onExperienceChange: (v: number) => void;
}

export function SummaryModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  summary,
  experience,
  onSummaryChange,
  onExperienceChange,
}: SummaryModalProps) {
  return (
    <Modal
      open={open}
      title="Edit Summary"
      subtitle="Tell HR about your professional background."
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
      size="md"
    >
      <div className="space-y-7">
        <div className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 p-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-violet-600 ring-1 ring-violet-100">
            <IconBulb />
          </div>
          <p className="text-sm leading-relaxed text-slate-600">
            Keep your summary concise and highlight your experience, strengths,
            and primary technologies HR should know about.
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <FormLabel>Professional Summary</FormLabel>
            <span className="text-xs text-slate-400">{summary.length} characters</span>
          </div>
          <FormTextarea
            value={summary}
            onChange={onSummaryChange}
            placeholder="Write a short professional summary..."
            rows={10}
          />
          <p className="mt-2 text-xs text-slate-400">
            Aim for 3–5 impactful sentences covering your role, strengths, and key technologies.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <p className="text-sm font-semibold text-slate-700">Total Experience</p>
            <p className="mt-0.5 text-xs text-slate-400">
              Your total professional experience, in years
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <div className="w-24">
              <FormInput
                type="number"
                value={experience}
                onChange={(v) => onExperienceChange(Number(v))}
                min={0}
                step={0.5}
              />
            </div>
            <span className="text-sm font-medium text-slate-400">years</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Skills modal ──────────────────────────────────────────────────────────────

interface SkillRow {
  category: string;
  skills: string;
}

interface SkillsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveMsg: string;
  editSkills: SkillRow[];
  onSkillsChange: (rows: SkillRow[]) => void;
}
export function SkillsModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  editSkills,
  onSkillsChange,
}: SkillsModalProps) {
  return (
    <Modal
      open={open}
      title="Edit Technical Skills"
      subtitle="Add category and type skills — press Enter or comma to add each."
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
      size="md"
    >
      <div className="space-y-4">
        {editSkills.map((skill, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:border-violet-200 hover:shadow-md sm:p-5"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <IconChip icon={<IconTag />} size="sm" />
                <div className="min-w-0 flex-1">
                  <FormLabel>Category Name</FormLabel>
                  <FormInput
                    value={skill.category}
                    onChange={(v) =>
                      onSkillsChange(
                        editSkills.map((s, i) =>
                          i === idx ? { ...s, category: v } : s,
                        ),
                      )
                    }
                    placeholder={`e.g. Category ${idx + 1} — Programming Languages`}
                  />
                </div>
              </div>
              <RemoveIconButton
                onClick={() => onSkillsChange(editSkills.filter((_, i) => i !== idx))}
                label="Remove category"
              />
            </div>

            <div>
              <FormLabel>Skills</FormLabel>
              <SkillChipsInput
                value={skill.skills}
                onChange={(v) =>
                  onSkillsChange(
                    editSkills.map((s, i) =>
                      i === idx ? { ...s, skills: v } : s,
                    ),
                  )
                }
                placeholder="Type a skill and press Enter…"
              />
            </div>
          </div>
        ))}

        {editSkills.length === 0 && (
          <EmptyState
            icon={<IconTag />}
            message="No skill categories added yet. Add one below to get started."
          />
        )}

        <AddButton
          onClick={() =>
            onSkillsChange([
              ...editSkills,
              {
                category: "",
                skills: "",
              },
            ])
          }
        >
          Add Skill Category
        </AddButton>
      </div>
    </Modal>
  );
}

// ─── Experience modal ──────────────────────────────────────────────────────────

interface ExperienceModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveMsg: string;
  editWorkExps: WorkExpEdit[];
  openEntries: Set<number>;
  openProjects: Set<string>;
  onToggleEntry: (i: number) => void;
  onToggleProject: (key: string) => void;
  onUpdateWorkExp: (
    idx: number,
    field: keyof Omit<WorkExpEdit, "projects">,
    value: string,
  ) => void;
  onUpdateProject: (
    entryIdx: number,
    projIdx: number,
    field: keyof ProjectInEntry,
    value: string,
  ) => void;
  onAddEntry: () => void;
  onRemoveEntry: (idx: number) => void;
  onAddProject: (entryIdx: number) => void;
  onRemoveProject: (entryIdx: number, projIdx: number) => void;
}

export function ExperienceModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  editWorkExps,
  openEntries,
  openProjects,
  onToggleEntry,
  onToggleProject,
  onUpdateWorkExp,
  onUpdateProject,
  onAddEntry,
  onRemoveEntry,
  onAddProject,
  onRemoveProject,
}: ExperienceModalProps) {
  return (
    <Modal
      open={open}
      title="Edit Work Experience"
      subtitle="Add or update companies and projects"
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
      wide
    >
      <div className="space-y-3">
        {editWorkExps.map((we, idx) => (
          <div
            key={idx}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-violet-200"
          >
            <div className="flex items-center gap-2 px-4 py-3.5 sm:px-5">
              <button
                type="button"
                onClick={() => onToggleEntry(idx)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <IconChip icon={<IconBuilding />} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {we.designation || we.company
                      ? `${we.designation}${we.designation && we.company ? " @ " : ""}${we.company}`
                      : `Entry ${idx + 1}`}
                  </p>
                  {we.duration && (
                    <p className="truncate text-xs text-slate-400">{we.duration}</p>
                  )}
                </div>
              </button>
              <div className="flex flex-shrink-0 items-center gap-0.5">
                {editWorkExps.length > 1 && (
                  <RemoveIconButton onClick={() => onRemoveEntry(idx)} label="Remove entry" />
                )}
                <button
                  type="button"
                  onClick={() => onToggleEntry(idx)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-violet-50 hover:text-violet-600"
                >
                  <IconChevron open={openEntries.has(idx)} />
                </button>
              </div>
            </div>

            {openEntries.has(idx) && (
              <div className="space-y-5 border-t border-slate-100 bg-slate-50/40 px-4 py-5 sm:px-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <FormLabel>Role / Designation</FormLabel>
                    <FormInput
                      value={we.designation}
                      onChange={(v) => onUpdateWorkExp(idx, "designation", v)}
                      placeholder="e.g. Backend Developer"
                    />
                  </div>
                  <div>
                    <FormLabel>Company</FormLabel>
                    <FormInput
                      value={we.company}
                      onChange={(v) => onUpdateWorkExp(idx, "company", v)}
                      placeholder="e.g. TechNova Solutions"
                    />
                  </div>
                  <div>
                    <FormLabel>Duration</FormLabel>
                    <FormInput
                      value={we.duration}
                      onChange={(v) => onUpdateWorkExp(idx, "duration", v)}
                      placeholder="e.g. Jan 2022 – Present"
                    />
                  </div>
                  <div>
                    <FormLabel>Company Description</FormLabel>
                    <FormInput
                      value={we.companyDescription}
                      onChange={(v) =>
                        onUpdateWorkExp(idx, "companyDescription", v)
                      }
                      placeholder="e.g. Product startup in fintech"
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <IconFolder className="h-3.5 w-3.5" />
                      Projects
                      {we.projects.length > 0 && (
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                          {we.projects.length}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onAddProject(idx)}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-violet-700 transition-all duration-200 hover:border-violet-300 hover:bg-violet-50"
                    >
                      <IconPlus />
                      Add Project
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {we.projects.length === 0 && (
                      <EmptyState icon={<IconFolder />} message="No projects added yet." />
                    )}
                    {we.projects.map((proj, pIdx) => {
                      const key = `${idx}-${pIdx}`;
                      return (
                        <div
                          key={pIdx}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:border-violet-200"
                        >
                          <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                            <button
                              type="button"
                              onClick={() => onToggleProject(key)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            >
                              <IconChip icon={<IconFolder className="h-3.5 w-3.5" />} tone="slate" size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-700">
                                  {proj.name || `Project ${pIdx + 1}`}
                                </p>
                                {proj.client && (
                                  <p className="truncate text-[11px] text-slate-400">{proj.client}</p>
                                )}
                              </div>
                            </button>
                            <div className="flex flex-shrink-0 items-center gap-0.5">
                              <RemoveIconButton
                                onClick={() => onRemoveProject(idx, pIdx)}
                                label="Remove project"
                              />
                              <button
                                type="button"
                                onClick={() => onToggleProject(key)}
                                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-violet-50 hover:text-violet-600"
                              >
                                <IconChevron open={openProjects.has(key)} />
                              </button>
                            </div>
                          </div>

                          {openProjects.has(key) && (
                            <div className="space-y-3 border-t border-slate-100 px-3.5 py-3.5">
                              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                  <FormLabel>Project Name</FormLabel>
                                  <FormInput
                                    value={proj.name}
                                    onChange={(v) =>
                                      onUpdateProject(idx, pIdx, "name", v)
                                    }
                                    placeholder="e.g. Retail AI Platform"
                                  />
                                </div>
                                <div>
                                  <FormLabel>Client</FormLabel>
                                  <FormInput
                                    value={proj.client}
                                    onChange={(v) =>
                                      onUpdateProject(idx, pIdx, "client", v)
                                    }
                                    placeholder="e.g. Acme Corp"
                                  />
                                </div>
                                <div>
                                  <FormLabel>Role in Project</FormLabel>
                                  <FormInput
                                    value={proj.role}
                                    onChange={(v) =>
                                      onUpdateProject(idx, pIdx, "role", v)
                                    }
                                    placeholder="e.g. Backend Developer"
                                  />
                                </div>
                                <div>
                                  <FormLabel>
                                    Technologies (comma-separated)
                                  </FormLabel>
                                  <FormInput
                                    value={proj.technologies}
                                    onChange={(v) =>
                                      onUpdateProject(
                                        idx,
                                        pIdx,
                                        "technologies",
                                        v,
                                      )
                                    }
                                    placeholder="e.g. Python, FastAPI, MongoDB"
                                  />
                                </div>
                              </div>
                              <div>
                                <FormLabel>Project Description</FormLabel>
                                <FormTextarea
                                  value={proj.description}
                                  onChange={(v) =>
                                    onUpdateProject(idx, pIdx, "description", v)
                                  }
                                  placeholder="Brief description…"
                                  rows={2}
                                />
                              </div>
                              <div>
                                <FormLabel>
                                  Responsibilities (one per line)
                                </FormLabel>
                                <FormTextarea
                                  value={proj.responsibilities}
                                  onChange={(v) =>
                                    onUpdateProject(
                                      idx,
                                      pIdx,
                                      "responsibilities",
                                      v,
                                    )
                                  }
                                  placeholder="One responsibility per line…"
                                  rows={3}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <AddButton onClick={onAddEntry}>Add Company / Role</AddButton>
    </Modal>
  );
}

// ─── Certifications / Achievements / Interests modals ──────────────────────────

interface ListModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveMsg: string;
  items: string[];
  onItemsChange: (items: string[]) => void;
  title: string;
  subtitle: string;
  placeholder: string;
  addLabel: string;
  emptyLabel: string;
  icon: ReactNode;
}

function ListModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  items,
  onItemsChange,
  title,
  subtitle,
  placeholder,
  addLabel,
  emptyLabel,
  icon,
}: ListModalProps) {
  return (
    <Modal
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
    >
      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <ListItemRow
            key={idx}
            icon={icon}
            value={item}
            onChange={(v) =>
              onItemsChange(items.map((c, i) => (i === idx ? v : c)))
            }
            placeholder={placeholder}
            onRemove={() => onItemsChange(items.filter((_, i) => i !== idx))}
          />
        ))}
        {items.length === 0 && <EmptyState icon={icon} message={emptyLabel} />}
      </div>
      <AddButton onClick={() => onItemsChange([...items, ""])}>{addLabel}</AddButton>
    </Modal>
  );
}

export function CertsModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  items,
  onItemsChange,
}: Omit<
  ListModalProps,
  "title" | "subtitle" | "placeholder" | "addLabel" | "emptyLabel" | "icon"
>) {
  return (
    <ListModal
      open={open}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
      items={items}
      onItemsChange={onItemsChange}
      title="Edit Certifications"
      subtitle="List your professional certifications"
      placeholder="e.g. AWS Certified Solutions Architect"
      addLabel="Add Certification"
      emptyLabel="No certifications added yet."
      icon={<IconAward />}
    />
  );
}

export function AchievementsModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  items,
  onItemsChange,
}: Omit<
  ListModalProps,
  "title" | "subtitle" | "placeholder" | "addLabel" | "emptyLabel" | "icon"
>) {
  return (
    <ListModal
      open={open}
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
      items={items}
      onItemsChange={onItemsChange}
      title="Edit Achievements"
      subtitle="Recognitions, awards, and notable accomplishments"
      placeholder="e.g. Employee of the Quarter"
      addLabel="Add Achievement"
      emptyLabel="No achievements added yet."
      icon={<IconTrophy />}
    />
  );
}

// ─── Skill Profile modal ───────────────────────────────────────────────────────

interface SkillProfileModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveMsg: string;
  employeeId?: string;
  name?: string;
  email?: string;
  designation: string;
  currentSkill: string;
  totalExp: number;
  skillExp: number;
  primarySkill: string;
  secondarySkill: string;
  isOnBench: boolean;
  skillCategories: string[];
  onDesignationChange: (v: string) => void;
  onCurrentSkillChange: (v: string) => void;
  onTotalExpChange: (v: number) => void;
  onSkillExpChange: (v: number) => void;
  onPrimarySkillChange: (v: string) => void;
  onSecondarySkillChange: (v: string) => void;
  onBenchToggle: () => void;
}

export function SkillProfileModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  employeeId,
  name,
  email,
  designation,
  currentSkill,
  totalExp,
  skillExp,
  primarySkill,
  secondarySkill,
  isOnBench,
  skillCategories,
  onDesignationChange,
  onCurrentSkillChange,
  onTotalExpChange,
  onSkillExpChange,
  onPrimarySkillChange,
  onSecondarySkillChange,
  onBenchToggle,
}: SkillProfileModalProps) {
  return (
    <Modal
      open={open}
      title="Edit Skill Profile"
      subtitle="Used by HR for skill allocation and tracking"
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
      wide
    >
      <div className="space-y-6">
        {/* Profile header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-8 -top-16 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -right-8 -bottom-16 h-32 w-32 rounded-full bg-fuchsia-400/20 blur-3xl" />
          </div>
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-white/15 text-lg font-bold text-white ring-1 ring-white/25 backdrop-blur-md">
              {initials(name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-white">{name || "—"}</p>
              <p className="truncate text-sm text-white/70">{email || "—"}</p>
            </div>
            {employeeId && (
              <span className="inline-flex flex-shrink-0 items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/25">
                ID: {employeeId}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FormLabel>Current Designation</FormLabel>
            <FormInput
              value={designation}
              onChange={onDesignationChange}
              placeholder="e.g. Senior Software Engineer"
            />
          </div>
          <div>
            <FormLabel>Current Skill</FormLabel>
            <FormSelect value={currentSkill} onChange={onCurrentSkillChange} placeholder="Select a skill…">
              {skillCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </FormSelect>
          </div>
          <div>
            <FormLabel>Total Experience (years)</FormLabel>
            <FormInput
              type="number"
              value={totalExp}
              onChange={(v) => onTotalExpChange(Number(v))}
              min={0}
              step={0.5}
            />
          </div>
          <div>
            <FormLabel>Current Skill Experience (years)</FormLabel>
            <FormInput
              type="number"
              value={skillExp}
              onChange={(v) => onSkillExpChange(Number(v))}
              min={0}
              step={0.5}
            />
          </div>
          <div>
            <FormLabel>Primary Skill</FormLabel>
            <FormInput
              value={primarySkill}
              onChange={onPrimarySkillChange}
              placeholder="e.g. Java"
            />
          </div>
          <div>
            <FormLabel>Secondary Skill</FormLabel>
            <FormInput
              value={secondarySkill}
              onChange={onSecondarySkillChange}
              placeholder="e.g. Python"
            />
          </div>
        </div>

        {/* Bench status card */}
        <div
          onClick={onBenchToggle}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onBenchToggle();
          }}
          className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition-all duration-200 sm:p-5 ${
            isOnBench
              ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 shadow-sm"
              : "border-slate-200 bg-slate-50 hover:border-slate-300"
          }`}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
                isOnBench ? "bg-amber-100 text-amber-600" : "bg-white text-slate-400 ring-1 ring-slate-200"
              }`}
            >
              <IconClock />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${isOnBench ? "text-amber-700" : "text-slate-700"}`}>
                Currently on Bench
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Let HR know you're available for new project allocation
              </p>
            </div>
          </div>
          <div
            className={`flex h-6 w-11 flex-shrink-0 items-center rounded-full px-0.5 transition-colors duration-200 ${
              isOnBench ? "bg-amber-400" : "bg-slate-300"
            }`}
          >
            <div
              className={`h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                isOnBench ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Education modal ───────────────────────────────────────────────────────────

interface EducationModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveMsg: string;
  items: EducationEdit[];
  onItemsChange: (items: EducationEdit[]) => void;
}

const blankEdu = (): EducationEdit => ({
  institution: "",
  stream: "",
  year: "",
  cgpa: "",
});

export function EducationModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  items,
  onItemsChange,
}: EducationModalProps) {
  const update = (idx: number, field: keyof EducationEdit, value: string) =>
    onItemsChange(
      items.map((e, i) => (i === idx ? { ...e, [field]: value } : e)),
    );

  return (
    <Modal
      open={open}
      title="Edit Education"
      subtitle="Add or correct your academic background"
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
    >
      <div className="space-y-3">
        {items.map((edu, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-200 hover:border-violet-200 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <IconChip icon={<IconGraduation />} size="sm" />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Education {idx + 1}
                </span>
              </div>
              <RemoveIconButton
                onClick={() => onItemsChange(items.filter((_, i) => i !== idx))}
                label="Remove education"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FormLabel>Institution</FormLabel>
                <FormInput
                  value={edu.institution}
                  onChange={(v) => update(idx, "institution", v)}
                  placeholder="e.g. VIT University"
                />
              </div>
              <div className="sm:col-span-2">
                <FormLabel>Degree / Stream</FormLabel>
                <FormInput
                  value={edu.stream}
                  onChange={(v) => update(idx, "stream", v)}
                  placeholder="e.g. B.Tech Computer Science"
                />
              </div>
              <div>
                <FormLabel>Year of Passing</FormLabel>
                <FormInput
                  value={edu.year}
                  onChange={(v) => update(idx, "year", v)}
                  placeholder="e.g. 2020"
                />
              </div>
              <div>
                <FormLabel>CGPA / Percentage</FormLabel>
                <FormInput
                  value={edu.cgpa}
                  onChange={(v) => update(idx, "cgpa", v)}
                  placeholder="e.g. 8.5"
                />
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <EmptyState icon={<IconGraduation />} message="No education added yet." />
        )}
      </div>
      <AddButton onClick={() => onItemsChange([...items, blankEdu()])}>
        Add Education
      </AddButton>
    </Modal>
  );
}

// ─── Interests modal ───────────────────────────────────────────────────────────

interface InterestsModalProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveMsg: string;
  items: string[];
  onItemsChange: (items: string[]) => void;
}

export function InterestsModal({
  open,
  onClose,
  onSave,
  saving,
  saveMsg,
  items,
  onItemsChange,
}: InterestsModalProps) {
  return (
    <Modal
      open={open}
      title="Edit Interests"
      subtitle="Hobbies and areas of interest"
      onClose={onClose}
      onSave={onSave}
      saving={saving}
      saveMsg={saveMsg}
    >
      <div className="space-y-2.5">
        {items.map((item, idx) => (
          <ListItemRow
            key={idx}
            icon={<IconHeart />}
            value={item}
            onChange={(v) =>
              onItemsChange(items.map((c, i) => (i === idx ? v : c)))
            }
            placeholder="e.g. Open source, Chess, Travelling"
            onRemove={() => onItemsChange(items.filter((_, i) => i !== idx))}
          />
        ))}
        {items.length === 0 && (
          <EmptyState icon={<IconHeart />} message="No interests added yet." />
        )}
      </div>
      <AddButton onClick={() => onItemsChange([...items, ""])}>Add Interest</AddButton>
    </Modal>
  );
}
