import { useEffect, useRef, useState } from 'react'
import { renderAsync } from 'docx-preview'
import { ProfileData } from '../../types/employee'
import api from '../../api/axios'
import '../../styles/resume-preview-fonts.css'

interface Props {
  open: boolean
  onClose: () => void
  displayName: string
  profile: ProfileData | null
}

const IconClose = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

/**
 * Renders the actual generated resume DOCX client-side (docx-preview) from
 * bytes streamed through our own backend. Rendering in-browser rather than
 * embedding an external viewer (e.g. Google Docs Viewer) avoids needing a
 * publicly-reachable URL, which localhost can't offer, and avoids needing
 * GCS signed-URL permissions our service account doesn't have.
 * Not wrapped in the shared Modal component: that component's footer is
 * built around an editable save/cancel flow, which doesn't apply here.
 */
export default function ResumePreview({ open, onClose, displayName, profile }: Props) {
  const [docLoading, setDocLoading] = useState(false)
  const [docError, setDocError] = useState('')
  const [docFetched, setDocFetched] = useState(false)
  const docContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || docFetched) return
    if (!profile?.email) return
    setDocLoading(true)
    setDocError('')
    api.get('/employee-profile/resume-preview-file', {
      responseType: 'blob',
    })
      .then(async ({ data }) => {
        if (docContainerRef.current) {
          docContainerRef.current.innerHTML = ''
          // useBase64URL avoids relying on object-URL blobs for header/body
          // images, which can fail to resolve for the template's logo.
          // experimental enables tab-stop layout calculation so justified
          // text wraps the way it does in the real document.
          await renderAsync(data, docContainerRef.current, undefined, {
            useBase64URL: true,
            experimental: true,
          })
        }
      })
      .catch((err) => {
        const status = err?.response?.status
        setDocError(status === 404 ? 'No resume on file yet.' : 'Could not load document preview.')
      })
      .finally(() => { setDocLoading(false); setDocFetched(true) })
  }, [open, profile?.email, docFetched])

  // Reset each time the overlay closes so the next open fetches fresh
  // rather than reusing a stale render or error from a previous session.
  useEffect(() => {
    if (!open) { setDocError(''); setDocFetched(false) }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-md p-3 sm:p-5"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-4xl h-[92vh] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.22)] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 bg-gradient-to-r from-white via-violet-50/40 to-indigo-50/30 px-5 py-4 sm:px-8 sm:py-6 flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
              {displayName ? `${displayName}'s Resume` : 'Resume Preview'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Rendered in-browser — formatting (fonts, tables, spacing) may differ slightly from the downloaded file.
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-all duration-200 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
          >
            <IconClose />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-100 relative">
          {docLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100">
              <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-400">Loading document…</p>
            </div>
          )}
          {docError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <p className="text-sm text-slate-500">{docError}</p>
            </div>
          )}
          {/* docx-preview renders directly into this container via DOM ref,
              outside React's render tree — must stay mounted regardless of
              loading/error state above it. */}
          <div ref={docContainerRef} className="docx-preview-container px-4 py-6 sm:px-8" />
        </div>
      </div>
    </div>
  )
}
