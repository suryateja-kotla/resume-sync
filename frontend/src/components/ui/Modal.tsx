import React from "react";

const IconClose = () => (
  <svg
    className="w-5 h-5"
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

const IconSpinner = () => (
  <svg
    className="w-4 h-4 animate-spin text-white"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
      className="opacity-20"
    />
    <path
      fill="currentColor"
      className="opacity-90"
      d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"
    />
  </svg>
);

type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  saveMsg: string;
  children: React.ReactNode;

  // New API
  size?: ModalSize;

  // Backward compatibility
  wide?: boolean;
}

const modalWidths: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  onSave,
  saving,
  saveMsg,
  children,
  size,
  wide,
}: ModalProps) {
  if (!open) return null;

  const widthClass = size ? modalWidths[size] : wide ? "max-w-3xl" : "max-w-xl";

  return (
    <div
      className="
        fixed
        inset-0
        z-50
        flex
        items-center
        justify-center
        bg-slate-950/45
        backdrop-blur-md
        p-5
      "
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`
  ${widthClass}
  w-full
  max-h-[92vh]
  overflow-hidden
  rounded-3xl
  border
  border-slate-200
  bg-white
  shadow-[0_25px_80px_rgba(15,23,42,0.22)]
  flex
  flex-col
  transition-all
  duration-200
`}
      >
        {/* Header */}

        <div
          className="
            flex
            items-start
            justify-between
            border-b
            border-slate-200
            bg-gradient-to-r
            from-white
            via-violet-50/40
            to-indigo-50/30
            px-8
            py-6
            flex-shrink-0
          "
        >
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-slate-800">
              {title}
            </h2>

            {subtitle && (
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            )}
          </div>

          <button
            onClick={onClose}
            className="
              ml-6
              flex
              h-10
              w-10
              flex-shrink-0
              items-center
              justify-center
              rounded-xl
              border
              border-slate-200
              text-slate-400
              transition-all
              duration-200
              hover:border-violet-200
              hover:bg-violet-50
              hover:text-violet-700
            "
          >
            <IconClose />
          </button>
        </div>

        {/* Body */}

        <div
          className="
            flex-1
            overflow-y-auto
            px-8
            py-7
            space-y-6
          "
        >
          {children}
        </div>

        {/* Footer */}

        <div
          className="
            border-t
            border-slate-200
            bg-white
            px-8
            py-5
            flex-shrink-0
          "
        >
          {saveMsg && (
            <div
              className={`
                mb-4
                rounded-xl
                border
                px-4
                py-3
                text-sm
                ${
                  saveMsg.toLowerCase().includes("success")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }
              `}
            >
              {saveMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="
                rounded-xl
                border
                border-slate-300
                bg-white
                px-5
                py-2.5
                text-sm
                font-medium
                text-slate-600
                transition-all
                duration-200
                hover:bg-slate-50
                hover:border-slate-400
                disabled:opacity-50
                disabled:cursor-not-allowed
              "
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-gradient-to-r
                from-violet-700
                via-indigo-700
                to-fuchsia-700
                px-6
                py-2.5
                text-sm
                font-semibold
                text-white
                shadow-lg
                shadow-indigo-900/20
                transition-all
                duration-200
                hover:scale-[1.02]
                hover:shadow-xl
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              {saving && <IconSpinner />}

              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
