import { ReactNode } from 'react'

const highlights = [
  {
    title: 'AI Resume Intelligence',
    description: 'Extract candidate skills, experience and insights in seconds.',
  },
  {
    title: 'Smart Talent Search',
    description: 'Quickly identify the best candidates using AI powered search.',
  },
  {
    title: 'Centralized Hiring',
    description: 'Manage resumes, interviews and employees from one platform.',
  },
]

export function AuthBrandPanel() {
  return (
    <div style={{
      display: 'none',
      width: '50%',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
      background: 'radial-gradient(ellipse 120% 90% at 50% 38%, #7e22ce 0%, #6d28d9 45%, #4338ca 100%)',
      color: '#fff',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '48px 44px',
    }} className="login-left-panel">

      {/* decorative blobs */}
      <div style={{
        position: 'absolute', top: -80, left: -80,
        width: 320, height: 320, borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)', filter: 'blur(48px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -60, right: -60,
        width: 400, height: 400, borderRadius: '50%',
        background: 'rgba(236,72,153,0.12)', filter: 'blur(64px)', pointerEvents: 'none',
      }} />

      {/* top: logo pill */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minHeight: 140, justifyContent: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 12,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 999, padding: '8px 20px 8px 10px', backdropFilter: 'blur(8px)',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,0.9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
          }}>
            <img src="/syncfolio-mark.svg" alt="" style={{ width: '100%', height: '100%' }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>SyncFolio</span>
        </div>

        <h1 style={{ marginTop: 48, fontSize: 'clamp(28px, 3vw, 44px)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.5px' }}>
          Modern Hiring.<br />Smarter Recruitment.
        </h1>
        <p style={{ marginTop: 18, fontSize: 15, color: 'rgba(221,214,254,0.9)', lineHeight: 1.7, maxWidth: 380 }}>
          Manage resumes, employees and recruitment workflows from one intelligent AI-powered platform.
        </p>
      </div>

      {/* bottom: feature cards */}
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {highlights.map(item => (
          <div key={item.title} style={{
            display: 'flex', alignItems: 'flex-start', gap: 16,
            background: 'rgba(255,255,255,0.09)', border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 20, padding: '16px 20px', backdropFilter: 'blur(12px)',
          }}>
            <div style={{
              flexShrink: 0, width: 44, height: 44,
              borderRadius: 14, background: 'rgba(255,255,255,0.18)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width={22} height={22} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{item.title}</div>
              <div style={{ marginTop: 4, fontSize: 13.5, color: 'rgba(221,214,254,0.85)', lineHeight: 1.5 }}>{item.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100dvh', width: '100vw', overflow: 'hidden' }}>
      <AuthBrandPanel />

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f7ff',
        overflowY: 'auto',
        padding: '32px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>

          {/* mobile logo (shown when left panel is hidden) */}
          <div className="login-mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, justifyContent: 'center' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, padding: 6,
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <img src="/syncfolio-mark.svg" alt="" style={{ width: '100%', height: '100%' }} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 17, color: '#1e1b4b' }}>SyncFolio</span>
          </div>

          {/* icon (shown on desktop when left panel is visible) */}
          <div className="login-desktop-icon" style={{ display: 'none', width: 56, height: 56, marginBottom: 20, marginLeft: 'auto', marginRight: 'auto' }}>
            <img src="/syncfolio-mark.svg" alt="" style={{ width: '100%', height: '100%' }} />
          </div>

          {children}

        </div>
      </div>

      {/* responsive styles */}
      <style>{`
        @media (min-width: 768px) {
          .login-left-panel  { display: flex !important; }
          .login-mobile-logo { display: none !important; }
          .login-desktop-icon { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
