import { useEffect, useRef, useState } from 'react'
import { initials } from '../../types/employee'

interface Props {
  fullName?: string
  email?: string
  employeeId?: string
  onChangePassword: () => void
  onLogout: () => void
}

export default function Navbar({ fullName, email, employeeId, onChangePassword, onLogout }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const displayName = fullName || email || ''

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-violet-700 via-indigo-700 to-fuchsia-700 shadow-lg shadow-indigo-950/20">
      {/* Decorative glow — clipped to the header, doesn't affect the dropdown below */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -left-10 -top-24 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-16 -bottom-24 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      <div className="relative max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-white/90 ring-1 ring-white/25 backdrop-blur-md flex items-center justify-center flex-shrink-0 p-1.5 transition-all duration-200 hover:bg-white hover:scale-105 hover:rotate-3">
            <img src="/syncfolio-mark.svg" alt="" className="h-full w-full" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="font-bold text-white text-base truncate">SyncFolio</p>
            <p className="hidden sm:block text-[10px] font-medium uppercase tracking-widest text-white/60 truncate">Employee Portal</p>
          </div>
        </div>

        {/* Avatar / user menu */}
        <div className="relative flex-shrink-0" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            aria-expanded={menuOpen}
            className={`flex items-center gap-2 rounded-full pl-1 pr-2 sm:pr-3 py-1 bg-white/10 ring-1 ring-white/20 backdrop-blur-md transition-all duration-200 hover:bg-white/20 hover:ring-white/40 active:scale-[0.97] ${menuOpen ? 'bg-white/20 ring-white/40' : ''}`}
          >
            <span className="w-8 h-8 rounded-full bg-white/20 ring-1 ring-white/30 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {initials(displayName)}
            </span>
            <span className="hidden sm:flex flex-col items-start leading-tight max-w-[140px]">
              <span className="text-white text-xs font-semibold truncate w-full text-left">{displayName}</span>
              <span className="text-white/60 text-[10px] truncate w-full text-left">{employeeId}</span>
            </span>
            <svg className={`w-3.5 h-3.5 text-white/70 flex-shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          <div
            className={`absolute right-0 mt-2 w-60 origin-top-right rounded-2xl bg-white shadow-2xl shadow-indigo-950/20 ring-1 ring-black/5 overflow-hidden transition-all duration-150 ${
              menuOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
            }`}
          >
            <div className="px-4 py-3 bg-gradient-to-br from-violet-50 to-indigo-50">
              <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
              <p className="text-xs text-slate-500 truncate">{email}</p>
            </div>
            <div className="py-1.5">
              <button
                onClick={() => { setMenuOpen(false); onChangePassword() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-violet-50 hover:text-violet-700 transition-colors text-left"
              >
                <svg className="w-4 h-4 text-violet-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                Change Password
              </button>
              <button
                onClick={() => { setMenuOpen(false); onLogout() }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors text-left"
              >
                <svg className="w-4 h-4 text-rose-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
