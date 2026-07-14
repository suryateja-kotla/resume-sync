import React from "react";

export const IconEdit = () => (
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
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
    />
  </svg>
);

export const IconPlus = () => (
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
      d="M12 4v16m8-8H4"
    />
  </svg>
);

export const IconClose = () => (
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
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

export const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    className={`w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
      open ? "rotate-180" : ""
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

export const IconSpinner = () => (
  <svg
    className="w-4 h-4 animate-spin text-violet-600"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-20"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-90"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
    />
  </svg>
);

export const SectionCard = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`
      rounded-2xl
      border
      border-slate-200/70
      bg-white
      shadow-xl
      shadow-indigo-950/5
      hover:shadow-2xl
      hover:-translate-y-0.5
      transition-all
      duration-200
      overflow-hidden
      ${className}
    `}
  >
    {children}
  </div>
);

export const SectionHead = ({
  icon,
  title,
  action,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  action?: "edit" | "add";
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-white">
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-700 ring-1 ring-violet-100">
        {icon}
      </div>

      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold tracking-tight text-slate-800 sm:text-lg">
          {title}
        </h2>
      </div>
    </div>

    {onAction && (
      <button
        onClick={onAction}
        className="
          inline-flex
          flex-shrink-0
          items-center
          gap-2
          rounded-xl
          border
          border-slate-200
          bg-white
          px-3
          py-1.5
          sm:px-3.5
          sm:py-2
          text-sm
          font-medium
          text-slate-600
          transition-all
          duration-200
          hover:border-violet-200
          hover:bg-violet-50
          hover:text-violet-700
          active:scale-[0.98]
        "
      >
        {action === "add" ? <IconPlus /> : <IconEdit />}

        {actionLabel || (action === "add" ? "Add" : "Edit")}
      </button>
    )}
  </div>
);

export const FormLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="mb-2 block text-sm font-medium text-slate-600">
    {children}
  </label>
);

export const FormInput = ({
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  step,
}: {
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  step?: number;
}) => (
  <input
    type={type}
    min={min}
    step={step}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="
      w-full
      rounded-xl
      border
      border-slate-300
      bg-white
      px-4
      py-3
      text-sm
      text-slate-700
      placeholder:text-slate-400
      transition-all
      duration-200
      focus:border-violet-400
      focus:ring-4
      focus:ring-violet-100
      focus:outline-none
    "
  />
);

export const FormTextarea = ({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) => (
  <textarea
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="
      w-full
      resize-none
      rounded-xl
      border
      border-slate-300
      bg-white
      px-4
      py-3
      text-sm
      leading-6
      text-slate-700
      placeholder:text-slate-400
      transition-all
      duration-200
      focus:border-violet-400
      focus:ring-4
      focus:ring-violet-100
      focus:outline-none
    "
  />
);
