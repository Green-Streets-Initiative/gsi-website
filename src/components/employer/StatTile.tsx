'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { TrendingUp, Info } from 'lucide-react'

/** Plain words for the portal numbers (Keith 2026-09-30: say what each one means). */
export const STAT_HINTS = {
  activeTrips: 'Walks, bike rides, scooter rides and transit trips recorded by Shift',
  miles: 'Miles travelled on those trips',
  /** The legacy kg figure (Home, the weekly email): every mile not driven × 0.404 kg. */
  co2: 'Compared with driving alone the same distance',
  /** The on-screen CO₂e figure on Impact: kilograms, like every ESG framework. */
  co2Kg: 'Kilograms of CO₂e. ESG reports use metric units.',
  /** The legacy kg figure when it appears on Impact, where the sentence already says "compared with driving alone". */
  co2KgLegacy: 'Kilograms of CO₂, at the EPA average for a passenger car. ESG reports use metric units.',
  /** The tonnes figure on the printed report. */
  co2Tonnes:
    'Tonnes of CO₂-equivalent your team avoided compared with driving alone the same distance, using EPA 2025 emission factors and net of the bus or train they took instead',
  shiftRate: 'Share of recorded trips made by walking, biking, scooter or transit instead of driving',
  driveAlone: 'Share of recorded trips that were driving alone. The number MassDEP and commuter programs ask employers to bring down.',
  participation: 'Employees who joined your workplace on Shift, as a share of the headcount you gave on Setup',
  emissionsShifted:
    "Share of your team's recorded miles made without driving alone. Ground trips only; Shift doesn't track flights.",
} as const

/**
 * The info button that carries a hint. A click (or Enter) opens a small
 * popover under the button; it closes on a click anywhere else, on Escape,
 * or on a second click. Pass `className` to recolor the button on a dark
 * panel; the popover itself is always a white card with ink text, so it
 * reads on the forest panel and on white cards alike. `align="right"`
 * hangs the popover from the button's right edge for the last column.
 */
const PANEL_WIDTH = 240

export function StatHint({
  hint,
  className = 'text-ink-icon hover:text-ink',
  align = 'auto',
}: {
  hint: string
  className?: string
  /** `auto` (default) hangs the card from the left edge and flips it to the
   *  right edge when it would run past the viewport. */
  align?: 'auto' | 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [side, setSide] = useState<'left' | 'right'>(align === 'right' ? 'right' : 'left')
  const rootRef = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  // Keep the card on screen: decide at open time whether the card hangs
  // from the button's left edge or, when that would cross the viewport,
  // from its right edge. The card is 240px wide (capped to the viewport).
  function toggle() {
    if (!open && align === 'auto' && rootRef.current) {
      const anchor = rootRef.current.getBoundingClientRect()
      const width = Math.min(PANEL_WIDTH, window.innerWidth - 32)
      const overflowsRight = anchor.left + width > window.innerWidth - 16
      const fitsRight = anchor.right - width >= 16
      setSide(overflowsRight && fitsRight ? 'right' : 'left')
    }
    setOpen((v) => !v)
  }

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="What this means"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        className={`grid h-5 w-5 place-items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${className}`}
      >
        <Info size={13} strokeWidth={1.75} />
      </button>
      {open && (
        <span
          id={panelId}
          role="dialog"
          className={`absolute top-full z-20 mt-1.5 w-[240px] max-w-[calc(100vw-2rem)] whitespace-normal rounded-[10px] border border-line bg-surface px-3 py-2.5 text-left font-sans text-[13px] font-normal normal-case leading-[1.45] tracking-normal text-ink shadow-lg ${
            side === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {hint}
        </span>
      )}
    </span>
  )
}

/**
 * One number with its label. `hint` explains the number in plain words: a
 * small info button opens it as a popover. The delta line is red
 * only for a real drop (`up === false` and a non-zero figure); "0 of 0"
 * stays quiet in the tertiary tone.
 */
export default function StatTile({
  label,
  value,
  unit,
  delta,
  up,
  labelIcon: LabelIcon,
  hint,
  dim = false,
}: {
  label: string
  value: string
  unit?: string
  delta?: string
  up?: boolean
  labelIcon?: LucideIcon
  hint?: string
  /** While fresh numbers are on their way: the tile fades, nothing moves. */
  dim?: boolean
}) {
  const deltaHasFigure = delta ? /[1-9]/.test(delta) : false
  const deltaTone = up ? 'text-accent' : up === false && deltaHasFigure ? 'text-ep-danger' : 'text-ink-tertiary'

  return (
    <div className={`transition-opacity duration-200 ${dim ? 'opacity-50' : ''}`} aria-busy={dim || undefined}>
      <div className="mb-1 flex items-center gap-1.5 text-[12.5px] font-medium text-ink-tertiary">
        {LabelIcon && <LabelIcon size={13} strokeWidth={1.75} />}
        <span>{label}</span>
        {hint && <StatHint hint={hint} />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[30px] font-bold tracking-[-0.02em] text-ink">{value}</span>
        {unit && <span className="text-[16px] text-ink-tertiary">{unit}</span>}
      </div>
      {delta && (
        <div className={`mt-1 flex items-center gap-1 text-[12px] font-medium ${deltaTone}`}>
          {up && <TrendingUp size={13} strokeWidth={2} />}
          {delta}
        </div>
      )}
    </div>
  )
}
