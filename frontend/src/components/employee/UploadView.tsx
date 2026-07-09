import { useRef, ChangeEvent } from 'react'
import { IconSpinner } from './ui'

interface Props {
  uploading: boolean
  uploadFile: File | null
  uploadMsg: string
  hasEmployeeId: boolean
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void
  onUpload: () => void
}

export default function UploadView({ uploading, uploadFile, uploadMsg, hasEmployeeId, onFileChange, onUpload }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f8f7ff', padding: '32px 20px',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Logo — centered, gradient bg */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
            padding: 10, marginBottom: 14,
            boxShadow: '0 4px 20px rgba(109,40,217,0.28)',
          }}>
            <img src="/syncfolio-mark.svg" alt="" style={{ width: '100%', height: '100%' }} />
          </div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#1e1b4b' }}>SyncFolio</div>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: '#1e1b4b', margin: 0, letterSpacing: '-0.3px' }}>
            Upload Your Resume
          </h2>
          <p style={{ marginTop: 8, fontSize: 14, color: '#64748b' }}>
            We'll extract your information automatically using AI — PDF or DOCX, max 10 MB.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#fff', borderRadius: 24,
          border: '1px solid #ede9fe',
          boxShadow: '0 8px 40px rgba(109,40,217,0.08)',
          padding: '28px 28px',
        }}>

          {/* Drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${uploadFile ? '#7c3aed' : '#d4d0fb'}`,
              borderRadius: 16,
              background: uploadFile ? '#f5f3ff' : '#faf9ff',
              padding: '32px 20px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={onFileChange} style={{ display: 'none' }} />
            {uploadFile ? (
              <>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 44, borderRadius: 12, background: '#ede9fe', marginBottom: 10,
                }}>
                  <svg width={22} height={22} fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p style={{ fontWeight: 600, fontSize: 14, color: '#1e1b4b', margin: '0 0 4px' }}>{uploadFile.name}</p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{(uploadFile.size / 1024).toFixed(0)} KB · Click to change</p>
              </>
            ) : (
              <>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 44, height: 44, borderRadius: 12, background: '#ede9fe', marginBottom: 10,
                }}>
                  <svg width={22} height={22} fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p style={{ fontWeight: 600, fontSize: 14, color: '#374151', margin: '0 0 4px' }}>Click to upload or drag &amp; drop</p>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>PDF or DOCX</p>
              </>
            )}
          </div>

          {!hasEmployeeId && (
            <div style={{
              marginTop: 16, background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#92400e',
            }}>
              Your account doesn't have an Employee ID. Please contact HR.
            </div>
          )}

          {uploadMsg && (
            <div style={{
              marginTop: 16, borderRadius: 12, padding: '10px 14px', fontSize: 13,
              ...(uploadMsg.toLowerCase().includes('success')
                ? { background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d' }
                : { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }),
            }}>
              {uploadMsg}
            </div>
          )}

          <button
            onClick={onUpload}
            disabled={!uploadFile || uploading || !hasEmployeeId}
            style={{
              width: '100%', marginTop: 20, padding: '14px', borderRadius: 14, border: 'none',
              cursor: (!uploadFile || uploading || !hasEmployeeId) ? 'not-allowed' : 'pointer',
              background: (!uploadFile || uploading || !hasEmployeeId)
                ? '#e5e7eb'
                : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: (!uploadFile || uploading || !hasEmployeeId) ? '#9ca3af' : '#fff',
              fontWeight: 700, fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
          >
            {uploading ? <><IconSpinner /> Processing resume…</> : 'Upload & Process Resume'}
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: 12, marginBottom: 0 }}>
            Processing may take 30–60 seconds.
          </p>
        </div>
      </div>
    </div>
  )
}
