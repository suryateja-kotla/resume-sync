export const IconEdit = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
)

export const IconPlus = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
)

export const IconClose = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

export const IconChevron = ({ open }: { open: boolean }) => (
  <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}
    fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
)

export const IconSpinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export const SectionCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    {children}
  </div>
)

export const SectionHead = ({
  icon, title, action, actionLabel, onAction,
}: {
  icon: React.ReactNode
  title: string
  action?: 'edit' | 'add'
  actionLabel?: string
  onAction?: () => void
}) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
    <div className="flex items-center gap-2.5">
      <span className="text-blue-600">{icon}</span>
      <span className="text-sm font-bold text-gray-800">{title}</span>
    </div>
    {onAction && (
      <button
        onClick={onAction}
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
      >
        {action === 'add' ? <IconPlus /> : <IconEdit />}
        {actionLabel || (action === 'add' ? 'Add' : 'Edit')}
      </button>
    )}
  </div>
)

export const FormLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-xs font-semibold text-gray-500 mb-1.5">{children}</label>
)

export const FormInput = ({
  value, onChange, placeholder, type = 'text', min, step,
}: {
  value: string | number
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  min?: number
  step?: number
}) => (
  <input
    type={type}
    min={min}
    step={step}
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-800 text-sm bg-white"
  />
)

export const FormTextarea = ({
  value, onChange, placeholder, rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) => (
  <textarea
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    rows={rows}
    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent text-gray-800 text-sm bg-white resize-none"
  />
)
