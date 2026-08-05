import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { renderAsync } from 'docx-preview'
import api from '../api/axios'
import '../styles/resume-preview-fonts.css'

/**
 * Standalone page (not a modal) that the Excel export's resume hyperlinks
 * point at, instead of the raw file endpoint. Fetching the bytes through
 * axios and rendering them in-browser via docx-preview means the resume
 * appears directly on this page — no browser file-download prompt, no
 * "Open/Save" dialog, no separate step to open a downloaded .docx. If HR
 * isn't signed in on whatever browser Excel opens this link in, ProtectedRoute
 * sends them to /login instead of the endpoint's raw 401 JSON.
 */
export default function HrResumeView() {
  const { employeeId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const name = searchParams.get('name') || employeeId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!employeeId) return
    let cancelled = false
    setLoading(true)
    setError('')

    api.get(`/hr/resume-file/${employeeId}`, { responseType: 'blob' })
      .then(async ({ data }) => {
        if (cancelled || !containerRef.current) return
        containerRef.current.innerHTML = ''
        await renderAsync(data, containerRef.current, undefined, {
          useBase64URL: true,
          experimental: true,
        })
      })
      .catch((err) => {
        if (cancelled) return
        const status = err?.response?.status
        setError(
          status === 404 ? 'No resume on file for this employee.' : 'Could not load the resume document.'
        )
      })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [employeeId])

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
        <h1 className="text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
          {name}'s Resume
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Rendered in-browser — formatting (fonts, tables, spacing) may differ slightly from the downloaded file.
        </p>
      </div>

      <div className="relative min-h-[70vh]">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading document…</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        )}
        <div ref={containerRef} className="docx-preview-container px-4 py-6 sm:px-8" />
      </div>
    </div>
  )
}
