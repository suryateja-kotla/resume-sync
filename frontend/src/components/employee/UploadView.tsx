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
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 max-w-md w-full">
        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-800 text-center mb-1">Upload Your Resume</h2>
        <p className="text-sm text-gray-400 text-center mb-7">
          We'll extract your information automatically using AI — PDF or DOCX, max 10 MB.
        </p>

        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
            uploadFile ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
        >
          <input ref={fileRef} type="file" accept=".pdf,.docx" onChange={onFileChange} className="hidden" />
          {uploadFile ? (
            <>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="font-semibold text-gray-700 text-sm">{uploadFile.name}</p>
              <p className="text-gray-400 text-xs mt-1">{(uploadFile.size / 1024).toFixed(0)} KB · Click to change</p>
            </>
          ) : (
            <>
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-gray-500">Click to upload or drag &amp; drop</p>
            </>
          )}
        </div>

        {!hasEmployeeId && (
          <div className="mt-4 bg-amber-50 border border-amber-100 text-amber-700 text-xs px-4 py-3 rounded-xl">
            Your account doesn't have an Employee ID. Please contact HR.
          </div>
        )}
        {uploadMsg && (
          <div className={`mt-4 text-xs px-4 py-3 rounded-xl border ${
            uploadMsg.includes('success')
              ? 'bg-green-50 text-green-700 border-green-100'
              : 'bg-red-50 text-red-700 border-red-100'
          }`}>{uploadMsg}</div>
        )}
        <button
          onClick={onUpload}
          disabled={!uploadFile || uploading || !hasEmployeeId}
          className="w-full mt-5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 text-sm"
        >
          {uploading ? <><IconSpinner />Processing resume...</> : 'Upload & Process Resume'}
        </button>
        <p className="text-gray-400 text-xs text-center mt-3">
          Processing may take 30–60 seconds.
        </p>
      </div>
    </div>
  )
}
