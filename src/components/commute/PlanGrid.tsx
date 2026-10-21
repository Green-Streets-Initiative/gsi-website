'use client'

import { useId, type ReactNode } from 'react'
import ModeIcon from '@/components/commute/ModeIcon'
import StageStrip from '@/components/commute/StageStrip'
import type { StageLabel, TripStage } from '@/components/commute/trip-stages'
import type { GuideGroup } from '@/components/commute/guide-topics'

/**
 * The decision grid: one row per way in, the same columns for every row
 * (leave by, door to door, a day, emissions shifted), the seven-stage
 * strip under each as its own full-width row, and ONE drawer for the
 * tapped row. Rows are buttons;
 * tapping one opens its drawer and closes the others. On a phone the
 * cost and emissions columns fold into the drawer so nothing scrolls
 * sideways.
 */

export interface PlanGridRow {
  key: string
  /** For the icon and the stage facts: transit, bike, drive, walk, shuttle. */
  mode: string
  name: string
  sub: string | null
  recommended?: boolean
  /** The way they get there now, when they told us. */
  today?: boolean
  /** Formatted ("8:41 AM"); null draws a dash. */
  leaveBy: string | null
  /** Driving: the earlier time that still arrives on time in heavy traffic. */
  leaveByTraffic?: string | null
  minutes: number | null
  minutesMax?: number | null
  /** Null draws a dash (a shuttle with no fare information). */
  costPerDay: number | null
  /** Overrides the cost cell ("Fare" for a shuttle that charges one). */
  costLabel?: string | null
  /** Share of commute emissions shifted; null (under 10%, or driving) draws a dash. */
  emissionsPct: number | null
  stages: TripStage[]
  /** This way in's guides, by the stage they open from; none for driving. */
  stageGuides?: Partial<Record<StageLabel, GuideGroup[]>>
  /** "All biking guides", under an open stage's guides. */
  guidesMore?: { href: string; label: string } | null
  drawer: ReactNode
}

const fmtDay = (n: number) => (n <= 0 ? 'Free' : `$${n.toFixed(2).replace(/\.00$/, '')}`)

/**
 * ONE template for the header and every mode row: the same column widths,
 * the same gutter, the same side padding, so a number sits under its
 * header. The stage strip under each row is its own full-width row
 * (StageStrip) and is not on this template. On a phone the cost and
 * emissions columns fold into the drawer.
 */
const GRID_COLS = 'grid-cols-[28px_minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.8fr)] min-[560px]:grid-cols-[28px_minmax(0,1.3fr)_minmax(0,.9fr)_minmax(0,.8fr)_minmax(0,.75fr)_minmax(0,1fr)]'
export const GRID_CLASS = `${GRID_COLS} gap-x-2.5 px-3`
/** The drawer starts under the "Way in" column: side padding + icon column + gutter. */
const DRAWER_INDENT = 'min-[560px]:pl-[50px]'
/** The site nav is fixed at 60px; the header sticks right under it. */
const STICKY_TOP = 'top-[60px]'

export default function PlanGrid({ rows, expanded, onToggle, stickyTopClass = STICKY_TOP, onGuideEvent }: {
  rows: PlanGridRow[]
  expanded: string | null
  onToggle: (key: string) => void
  onGuideEvent?: (name: 'advisor_stage_guides_opened' | 'advisor_guide_clicked', props: Record<string, unknown>) => void
  /** Where the header sticks: under the site nav on the page, at the top inside the phone sheet. */
  stickyTopClass?: string
}) {
  const base = useId()
  return (
    // overflow-clip, not overflow-hidden: hidden would make this box the
    // header's scroll container and the sticky header would never stick.
    <div className="min-w-0 overflow-clip rounded-[12px] border border-[rgba(25,26,46,0.12)] bg-white shadow-[0_1px_2px_rgba(25,26,46,0.05)]">
      <div className={`sticky ${stickyTopClass} z-[5] grid ${GRID_CLASS} items-center border-b border-[rgba(25,26,46,0.12)] bg-[#FAFBF8] py-2.5 text-[0.8125rem] font-bold uppercase leading-[1.3] tracking-[0.05em] text-[#4A4D68]`} role="row" aria-hidden>
        <span />
        <span>Way in</span>
        <span>Leave by</span>
        <span>Door to door</span>
        <span className="hidden min-[560px]:block">A day</span>
        <span className="hidden min-[560px]:block">Emissions shifted</span>
      </div>

      {rows.map((r, i) => {
        const open = expanded === r.key
        const panelId = `${base}-${r.key.replace(/[^a-zA-Z0-9_-]/g, '_')}`
        const time = r.minutes == null ? '—' : r.minutesMax != null && r.minutesMax > r.minutes ? `${r.minutes}–${r.minutesMax} min` : `${r.minutes} min`
        const cost = r.costLabel ?? (r.costPerDay == null ? '—' : fmtDay(r.costPerDay))
        const pct = r.emissionsPct
        return (
          <div key={r.key} className={i > 0 ? 'border-t border-[rgba(25,26,46,0.12)]' : ''}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => onToggle(r.key)}
              className={`grid ${GRID_CLASS} w-full cursor-pointer items-center py-3 text-left transition-colors ${open ? 'bg-[#E7F0EA]' : 'hover:bg-[#FAFBF8]'}`}
            >
              <span className="flex items-center self-center text-[#2D6A4F]"><ModeIcon mode={r.mode} size={24} /></span>
              <span className="min-w-0 self-center">
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="text-[1.0625rem] font-extrabold leading-tight text-[#191A2E]">{r.name}</span>
                  {r.recommended && (
                    <span className="rounded-full bg-[#BAF14D] px-2 py-0.5 text-[0.8125rem] font-extrabold uppercase tracking-[0.04em] text-[#191A2E]">Our pick</span>
                  )}
                  {r.today && !r.recommended && (
                    <span className="rounded-full bg-[rgba(25,26,46,0.08)] px-2 py-0.5 text-[0.8125rem] font-extrabold uppercase tracking-[0.04em] text-[#4A4D68]">Today</span>
                  )}
                </span>
                {r.sub && <span className="mt-0.5 block truncate text-[0.875rem] leading-snug text-[#4A4D68]">{r.sub}</span>}
              </span>
              <span className="self-center text-[1rem] font-bold leading-tight tabular-nums text-[#191A2E]">
                {r.leaveBy ?? '—'}
                {r.leaveBy && r.leaveByTraffic && r.leaveByTraffic !== r.leaveBy && (
                  <small className="block text-[0.8125rem] font-normal leading-tight text-[#4A4D68]">{r.leaveByTraffic} in traffic</small>
                )}
              </span>
              <span className="self-center text-[1rem] font-bold leading-tight tabular-nums text-[#191A2E]">{time}</span>
              <span className="hidden self-center text-[1rem] font-bold leading-tight tabular-nums text-[#191A2E] min-[560px]:block">
                {cost}
                {r.costPerDay != null && r.costPerDay > 0 && !r.costLabel && <small className="block text-[0.8125rem] font-normal leading-tight text-[#4A4D68]">a day</small>}
              </span>
              <span className="hidden min-w-0 self-center min-[560px]:block">
                {pct != null ? (
                  <>
                    <span className="block h-1.5 overflow-hidden rounded-full bg-[rgba(25,26,46,0.12)]" aria-hidden>
                      <span className="block h-full rounded-full bg-[#2D6A4F]" style={{ width: `${Math.max(4, Math.min(100, pct))}%` }} />
                    </span>
                    <small className="mt-0.5 block text-[0.8125rem] leading-tight text-[#4A4D68]">{pct >= 98 ? 'all of it' : `${pct}%`}</small>
                  </>
                ) : (
                  <small className="text-[0.8125rem] leading-tight text-[#4A4D68]">—</small>
                )}
              </span>
            </button>

            {/* The stage strip belongs to the open row only: under every
                row it was 24 mostly generic cells and three phone screens
                before the map (journey pass, 2026-10-15). */}
            {open && <StageStrip key={r.key} stages={r.stages} open guides={r.stageGuides} more={r.guidesMore} onGuideEvent={onGuideEvent} />}

            {open && (
              <div id={panelId} className={`space-y-3 border-t border-[rgba(25,26,46,0.12)] bg-[#E7F0EA] px-3 py-3.5 ${DRAWER_INDENT}`}>
                {/* On a phone the two folded columns lead the drawer. */}
                {(r.costPerDay != null || pct != null) && (
                  <p className="text-[0.9375rem] font-semibold text-[#191A2E] min-[560px]:hidden">
                    {r.costPerDay != null ? `${cost}${r.costPerDay > 0 && !r.costLabel ? ' a day' : ''}` : ''}
                    {r.costPerDay != null && pct != null ? ' · ' : ''}
                    {pct != null ? (pct >= 98 ? 'shifts all of your commute emissions' : `shifts ${pct}% of your commute emissions`) : ''}
                  </p>
                )}
                {r.drawer}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Shimmer stand-in for the grid while the plan is still being worked out. */
export function PlanGridSkeleton() {
  return (
    <div className="overflow-clip rounded-[12px] border border-[rgba(25,26,46,0.12)] bg-white" aria-hidden>
      <div className="h-8 bg-[#FAFBF8]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className={`grid ${GRID_CLASS} items-center border-t border-[rgba(25,26,46,0.12)] py-3`}>
          <div className="h-6 w-6 animate-pulse rounded-full bg-[rgba(25,26,46,0.06)]" />
          <div className="space-y-1.5"><div className="h-3.5 w-24 animate-pulse rounded bg-[rgba(25,26,46,0.08)]" /><div className="h-3 w-32 animate-pulse rounded bg-[rgba(25,26,46,0.05)]" /></div>
          <div className="h-3.5 w-14 animate-pulse rounded bg-[rgba(25,26,46,0.08)]" />
          <div className="h-3.5 w-12 animate-pulse rounded bg-[rgba(25,26,46,0.08)]" />
          <div className="hidden h-3.5 w-10 animate-pulse rounded bg-[rgba(25,26,46,0.08)] min-[560px]:block" />
          <div className="hidden h-1.5 w-full animate-pulse rounded bg-[rgba(25,26,46,0.08)] min-[560px]:block" />
        </div>
      ))}
    </div>
  )
}
