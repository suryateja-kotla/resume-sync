interface Props {
  variant?: 'white' | 'color'
  size?: 'sm' | 'md' | 'lg'
}

/* Full-color version — for white/light backgrounds */
const SyncFolioColor = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 680 488.6" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="sf-c-backTop" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#818cf8"/>
        <stop offset="100%" stopColor="#6366f1"/>
      </linearGradient>
      <linearGradient id="sf-c-backFace" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#4f46e5"/>
        <stop offset="100%" stopColor="#4338ca"/>
      </linearGradient>
      <linearGradient id="sf-c-frontTop" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#c4b5fd"/>
        <stop offset="100%" stopColor="#e879f9"/>
      </linearGradient>
      <linearGradient id="sf-c-frontFace" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9333ea"/>
        <stop offset="100%" stopColor="#c026d3"/>
      </linearGradient>
    </defs>
    <polygon points="230,80 380,80 320,140 170,140" fill="url(#sf-c-backTop)" />
    <path d="M170,140 h150 v190 a10 10 0 0 1 -10 10 h-130 a10 10 0 0 1 -10 -10 z" fill="url(#sf-c-backFace)" />
    <polygon points="280,140 460,140 430,180 250,180" fill="url(#sf-c-frontTop)" />
    <path d="M266,180 h300 a16 16 0 0 1 16 16 v210 a16 16 0 0 1 -16 16 h-300 a16 16 0 0 1 -16 -16 v-210 a16 16 0 0 1 16 -16 z" fill="url(#sf-c-frontFace)" />
    <rect x="296" y="212" width="80" height="80" rx="12" fill="#ffffff" fillOpacity="0.92" />
    <circle cx="336" cy="240" r="14" fill="url(#sf-c-frontFace)" />
    <path d="M310 276 a26 26 0 0 1 52 0 z" fill="url(#sf-c-frontFace)" />
    <rect x="392" y="216" width="150" height="20" rx="8" fill="#ffffff" fillOpacity="0.85" />
    <rect x="392" y="248" width="150" height="20" rx="8" fill="#ffffff" fillOpacity="0.6" />
    <rect x="296" y="312" width="246" height="22" rx="8" fill="#ffffff" fillOpacity="0.5" />
    <rect x="296" y="346" width="246" height="22" rx="8" fill="#ffffff" fillOpacity="0.4" />
    <rect x="296" y="380" width="170" height="22" rx="8" fill="#ffffff" fillOpacity="0.4" />
    <polygon points="266,406 296,406 266,436" fill="#7e22ce" />
  </svg>
)

/* White/ghost version — for dark/gradient backgrounds */
const SyncFolioWhite = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 680 488.6" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    {/* Back card — white with low opacity */}
    <polygon points="230,80 380,80 320,140 170,140" fill="rgba(255,255,255,0.35)" />
    <path d="M170,140 h150 v190 a10 10 0 0 1 -10 10 h-130 a10 10 0 0 1 -10 -10 z" fill="rgba(255,255,255,0.18)" />
    {/* Front card — white with higher opacity so it stands out */}
    <polygon points="280,140 460,140 430,180 250,180" fill="rgba(255,255,255,0.7)" />
    <path d="M266,180 h300 a16 16 0 0 1 16 16 v210 a16 16 0 0 1 -16 16 h-300 a16 16 0 0 1 -16 -16 v-210 a16 16 0 0 1 16 -16 z" fill="rgba(255,255,255,0.22)" />
    {/* Profile box */}
    <rect x="296" y="212" width="80" height="80" rx="12" fill="rgba(255,255,255,0.55)" />
    <circle cx="336" cy="240" r="14" fill="rgba(255,255,255,0.9)" />
    <path d="M310 276 a26 26 0 0 1 52 0 z" fill="rgba(255,255,255,0.9)" />
    {/* Name lines */}
    <rect x="392" y="216" width="150" height="20" rx="8" fill="rgba(255,255,255,0.8)" />
    <rect x="392" y="248" width="150" height="20" rx="8" fill="rgba(255,255,255,0.5)" />
    {/* Content lines */}
    <rect x="296" y="312" width="246" height="22" rx="8" fill="rgba(255,255,255,0.45)" />
    <rect x="296" y="346" width="246" height="22" rx="8" fill="rgba(255,255,255,0.35)" />
    <rect x="296" y="380" width="170" height="22" rx="8" fill="rgba(255,255,255,0.35)" />
    {/* Corner accent */}
    <polygon points="266,406 296,406 266,436" fill="rgba(255,255,255,0.6)" />
  </svg>
)

export default function Logo({ variant = 'white', size = 'md' }: Props) {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 48 : 36
  const nameSize = size === 'sm' ? '0.9375rem' : size === 'lg' ? '1.375rem' : '1.0625rem'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
      {variant === 'white'
        ? <SyncFolioWhite size={iconSize} />
        : <SyncFolioColor size={iconSize} />
      }
      <span style={{
        color: variant === 'white' ? '#fff' : '#1e1b4b',
        fontWeight: 800,
        fontSize: nameSize,
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}>
        SyncFolio
      </span>
      {variant === 'white' && (
        <span style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          marginLeft: '0.125rem',
        }}>
          PORTAL
        </span>
      )}
    </div>
  )
}
