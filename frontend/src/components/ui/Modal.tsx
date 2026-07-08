const IconClose = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const IconSpinner = () => (
  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
)

export default function Modal({
  open, title, subtitle, onClose, onSave, saving, saveMsg, children, wide,
}: {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  onSave: () => void
  saving: boolean
  saveMsg: string
  children: React.ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-2xl flex flex-col max-h-[90vh] w-full ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-800">{title}</h3>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-gray-600 transition ml-4 flex-shrink-0"
          >
            <IconClose />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {children}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {saveMsg && (
            <p className={`text-xs mb-3 ${saveMsg.includes('success') ? 'text-green-600' : 'text-red-500'}`}>
              {saveMsg}
            </p>
          )}
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 transition flex items-center gap-2"
            >
              {saving && <IconSpinner />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
