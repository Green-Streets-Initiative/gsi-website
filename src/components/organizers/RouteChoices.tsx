'use client'

import { Check } from 'lucide-react'
import { comfortBreakdown, comfortableShare } from '@/components/commute/calm-route'
import type { PlannedLegOption } from '@/lib/organizers/api'
import { calmer } from '@/lib/organizers/route-plan'
import { PACE_MID_MPH, paceOptionsFor, travelMph, type Activity } from '@/lib/organizers/ride-words'
import { MAP_COMFORT_COLORS, tidyName } from './RouteReview'
import { cx } from './ui'

/**
 * The ways between two stops, side by side (Keith 2026-11-06: "6.1 mi ·
 * Harvard St" chips hid the trade-off). One row per way with the same
 * columns, the way Commute Advisor and the app's planner compare routes:
 * how comfortable it is (the comfort bar and its share on paths, lanes and
 * quiet streets, calm-route.ts), how long it takes at the ride's pace
 * (walking speed for a walk, travelMph), and how far. The calmest way and
 * the quickest carry the app planner's badges (RouteOptionDeck: Calmest,
 * Fastest, or both).
 */

const segs = (o: PlannedLegOption) => o.comfort_segments ?? []

function minutesText(n: number): string {
  const m = Math.max(1, Math.round(n))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} hr ${r} min` : `${h} hr`
}

/** The ways worth showing: a way that reads exactly like an earlier one is the same way to the organizer. */
export function distinctWays(options: PlannedLegOption[], chosen: number): number[] {
  const seen = new Map<string, number>()
  const keep: number[] = []
  options.forEach((o, i) => {
    const key = `${o.distanceMiles.toFixed(1)}|${o.summary}|${Math.round(comfortableShare(segs(o)) * 100)}`
    const first = seen.get(key)
    if (first === undefined) { seen.set(key, i); keep.push(i) } else if (i === chosen) keep[keep.indexOf(first)] = i
  })
  return keep
}

function MiniBar({ o }: { o: PlannedLegOption }) {
  const tiers = comfortBreakdown(segs(o))
  if (tiers.length === 0) return <span className="block h-2.5 w-full rounded-full bg-(--ev-track)" />
  return (
    <span className="flex h-2.5 w-full overflow-hidden rounded-full bg-(--ev-track)" aria-hidden>
      {tiers.map((t) => <span key={t.rating} style={{ width: `${t.pct}%`, background: MAP_COMFORT_COLORS[t.rating] ?? MAP_COMFORT_COLORS.shared_road }} />)}
    </span>
  )
}

export { calmestWay } from '@/lib/organizers/route-plan'

export default function RouteChoices({ label, options, chosen, onChoose, pace, activity }: {
  /** "Start to stop 1" when the route has several legs; null for one. */
  label: string | null
  options: PlannedLegOption[]
  chosen: number
  onChoose: (i: number) => void
  pace: string | null
  activity: Activity
}) {
  const ways = distinctWays(options, chosen)
  if (ways.length < 2) return null
  const walk = activity === 'walk'
  const mph = travelMph(pace, activity) ?? PACE_MID_MPH.relaxed
  const paceName = paceOptionsFor(activity).find((p) => p.key === pace)?.label.toLowerCase()
  const timeHead = walk ? 'Walking' : paceName ? `At ${paceName} pace` : 'At a relaxed pace'
  const mins = (o: PlannedLegOption) => (o.distanceMiles / mph) * 60

  let calmest = ways[0]
  let fastest = ways[0]
  for (const i of ways) {
    if (calmer(options[i], options[calmest])) calmest = i
    const d = Math.round(mins(options[i])) - Math.round(mins(options[fastest]))
    if (d < 0 || (d === 0 && calmer(options[i], options[fastest]))) fastest = i
  }
  // Calmest first, then the quickest, then the rest as the planner ranked them.
  const order = [calmest, ...(fastest !== calmest ? [fastest] : []), ...ways.filter((i) => i !== calmest && i !== fastest)]

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[15px] font-bold text-(--ev-ink)">{label ? `${label} pick a way` : 'Pick a way'}</legend>
      <div className="overflow-hidden rounded-xl border border-(--ev-line-mid) bg-white" role="radiogroup" aria-label={label ?? 'Ways to go'}>
        {/* Column heads: wide screens only; on a phone each row labels itself. */}
        <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_80px] gap-4 border-b border-(--ev-line) bg-(--ev-panel-faint) px-4 py-2 text-[14px] font-semibold text-(--ev-ink-75) sm:grid">
          <span>Way</span>
          <span>On calm streets</span>
          <span>{timeHead}</span>
          <span className="text-right">Distance</span>
        </div>
        {order.map((i, row) => {
          const o = options[i]
          const on = chosen === i
          const pct = Math.round(comfortableShare(segs(o)) * 100)
          const badge = i === calmest && i === fastest ? 'Calmest · Fastest' : i === calmest ? 'Calmest' : i === fastest ? 'Fastest' : null
          const name = o.summary ? `via ${tidyName(o.summary)}` : `Way ${row + 1}`
          return (
            <button key={i} type="button" role="radio" aria-checked={on} onClick={() => onChoose(i)}
              aria-label={`${name}${badge ? `, ${badge.toLowerCase()}` : ''}: ${pct}% on calm streets, about ${minutesText(mins(o))}, ${o.distanceMiles.toFixed(1)} miles`}
              className={cx(
                'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_120px_80px]',
                row > 0 && 'border-t border-(--ev-line)',
                on ? 'bg-(--ev-accent-tint-15)' : 'hover:bg-(--ev-panel-faint)',
              )}>
              <span className="flex min-w-0 items-center gap-3">
                <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full border-2',
                  on ? 'border-(--ev-ink) bg-(--ev-ink) text-white' : 'border-(--ev-line-stronger) bg-white')} aria-hidden>
                  {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold leading-snug text-(--ev-ink)">{name}</span>
                  {badge && (
                    <span className={cx('mt-0.5 inline-block rounded-full px-2 py-px text-[13px] font-bold',
                      i === calmest ? 'bg-[#E2F3E8] text-[#1F6B3F]' : 'bg-[#E3ECFC] text-[#1E4FB8]')}>{badge}</span>
                  )}
                </span>
              </span>
              {/* Phone: time and distance sit to the right of the name; the bar takes the next line. */}
              <span className="text-right sm:hidden">
                <span className="block text-[15px] font-bold text-(--ev-ink)">{minutesText(mins(o))}</span>
                <span className="block text-[14px] text-(--ev-ink-75)">{o.distanceMiles.toFixed(1)} mi</span>
              </span>
              <span className="col-span-2 flex items-center gap-2.5 sm:col-span-1">
                <span className="min-w-0 flex-1"><MiniBar o={o} /></span>
                <span className="w-[86px] shrink-0 text-[15px] font-bold text-(--ev-ink) sm:w-[44px]">{pct}%<span className="font-semibold text-(--ev-ink-75) sm:hidden"> calm</span></span>
              </span>
              <span className="hidden text-[15px] font-bold text-(--ev-ink) sm:block">{minutesText(mins(o))}</span>
              <span className="hidden text-right text-[15px] font-semibold text-(--ev-ink-85) sm:block">{o.distanceMiles.toFixed(1)} mi</span>
            </button>
          )
        })}
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-(--ev-ink-75)">
        {(['path', 'protected', 'bike_lane', 'quiet_street', 'shared_road'] as const).map((r) => (
          <span key={r} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: MAP_COMFORT_COLORS[r] }} aria-hidden />
            {r === 'path' ? 'Path' : r === 'protected' ? 'Protected lane' : r === 'bike_lane' ? 'Bike lane' : r === 'quiet_street' ? 'Quiet street' : walk ? 'Busier street' : 'Shared road'}
          </span>
        ))}
      </p>
    </fieldset>
  )
}
