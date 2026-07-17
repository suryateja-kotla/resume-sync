import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getSkillBadgeClass } from '../../types/hr'

interface Props {
  value?: string
  /**
   * Caps how many chips render before collapsing the rest into a "+N more"
   * indicator (hover to see the full list via a tooltip). Leave unset to
   * always show every chip — used where card height isn't a constraint
   * (e.g. the Skill Dashboard's full detail view).
   */
  maxChips?: number
  /**
   * When true (default when maxChips is set), each chip's own text is
   * truncated with an ellipsis instead of wrapping onto multiple lines, so a
   * single long skill name can't make one card taller than its neighbors
   * either.
   */
  truncateChips?: boolean
}

const TOOLTIP_WIDTH = 220
const VIEWPORT_MARGIN = 8

/**
 * App-styled hover tooltip for the "+N more" indicator — the one place a
 * chip genuinely hides information. Colored to match the violet chip palette
 * instead of a plain white/black box, so it reads as part of the same chip
 * family rather than a foreign popup.
 *
 * Position is measured on hover/focus (not pure CSS centering) and rendered
 * as `fixed`, then clamped to stay inside the viewport — plain
 * `left-1/2 -translate-x-1/2` centering has no awareness of nearby screen
 * edges, so a chip near the sidebar or window edge got its tooltip clipped
 * off-screen.
 *
 * Rendered via a portal into document.body rather than inline: several
 * cards (e.g. Talent Pool) apply a hover `transform` (translate/scale) to
 * lift the card, and per the CSS spec a `transform` on any ancestor turns
 * that ancestor into the containing block for `position: fixed`
 * descendants — so an inline-rendered tooltip would anchor to the
 * transformed card instead of the viewport, landing far from the trigger
 * chip. Portaling to body sidesteps that entirely.
 */
function MoreTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; arrowLeft: number } | null>(null)
  const [visible, setVisible] = useState(false)

  const show = () => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2

    let left = centerX - TOOLTIP_WIDTH / 2
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - VIEWPORT_MARGIN))

    setPos({ left, top: rect.top, arrowLeft: centerX - left })
    setVisible(true)
  }
  const hide = () => setVisible(false)

  return (
    <span
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {pos && createPortal(
        <span
          role="tooltip"
          style={{
            left: pos.left,
            top: pos.top,
            width: TOOLTIP_WIDTH,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(calc(-100% - 8px)) scale(1)' : 'translateY(calc(-100% - 4px)) scale(0.95)',
          }}
          className="pointer-events-none fixed z-20 whitespace-normal rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 shadow-xl shadow-indigo-950/10 transition-all duration-150"
        >
          {text}
          <span
            style={{ left: pos.arrowLeft }}
            className="absolute top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-violet-200 bg-violet-50"
          />
        </span>,
        document.body
      )}
    </span>
  )
}

/**
 * Renders a skill value as one or more chips. Primary/secondary/current skill
 * values sometimes arrive as a comma-separated list (e.g. "ASP.NET Core/ .NET
 * API, Development") or contain long multi-word names (e.g. "Automation
 * Testing (Playwright – JavaScript)") — a single rounded-full pill wraps those
 * mid-word and looks cut-off, so we split on commas and let each chip wrap
 * cleanly onto its own line instead.
 *
 * When maxChips is set, employees with many skills no longer stretch their
 * card taller than employees with few — the overflow collapses into a
 * "+N more" chip instead, with the full list available on hover. Individual
 * visible chips truncate with CSS ellipsis only (no tooltip) — the "+N more"
 * indicator is the only chip that ever hides information, so it's the only
 * one that needs a hover popup.
 */
export default function SkillChips({ value, maxChips, truncateChips }: Props) {
  const parts = (value || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return <span className="text-sm font-medium text-slate-400">—</span>
  }

  const visible = maxChips ? parts.slice(0, maxChips) : parts
  const hidden = maxChips ? parts.slice(maxChips) : []
  const truncate = truncateChips ?? maxChips !== undefined

  return (
    <div className="flex min-w-0 flex-wrap gap-1.5">
      {visible.map((part, i) => (
        <span
          key={i}
          className={`inline-block rounded-lg px-2 py-0.5 text-xs font-medium leading-snug ${
            truncate ? 'max-w-[9.5rem] truncate' : 'max-w-full break-words'
          } ${getSkillBadgeClass(part)}`}
        >
          {part}
        </span>
      ))}
      {hidden.length > 0 && (
        <MoreTooltip text={hidden.join(', ')}>
          <span
            tabIndex={0}
            className="inline-block flex-shrink-0 cursor-default rounded-lg border border-dashed border-violet-200 bg-violet-50/60 px-2 py-0.5 text-xs font-medium text-violet-600 outline-none"
          >
            +{hidden.length} more
          </span>
        </MoreTooltip>
      )}
    </div>
  )
}
