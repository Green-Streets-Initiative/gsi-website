import { Mountain } from 'lucide-react'
import type { RoamElevation } from '@/lib/roams/queries'

/**
 * How hilly a Roam is, on the first screen (Keith 2026-10-29: "add elevation
 * data to trail pages"): the hills in a word, the climb each way, and the
 * route's height as a row of bars on one scale for every Roam, so a flat
 * trail looks flat. Bars are teal under a 4% grade, gold to 8%, orange above,
 * as in the app's ride sheet and the assistant's trail card.
 *
 * The climb is labelled by where each direction heads, from the stop names in
 * the start line above (Keith 2026-10-29: "going" and "coming back" don't say
 * which way is which), and the chart's ends carry the same names.
 *
 * The word follows the assistant's rule (gsi-website lib/shift-assistant
 * tools hillsFeel): feet climbed per mile under 30 is flat, under 80 is a
 * gentle grade (steepest under 4%) or rolling, more is hilly.
 */

const BARS = 48
/** Feet of rise that fill the chart: Wachusett's 413 ft does, Sudbury's 126 ft is under half. */
const SPAN_FT = 300

export function hillsWord(e: RoamElevation): 'Flat' | 'A gentle grade' | 'Rolling' | 'Hilly' {
  const perMile = Math.max(e.ascent_ft, e.descent_ft) / e.route_miles
  return perMile < 30 ? 'Flat' : perMile < 80 ? (e.max_grade_pct < 4 ? 'A gentle grade' : 'Rolling') : 'Hilly'
}

function bars(profile: [number, number][]): { h: number; grade: number }[] {
  if (profile.length < 2) return []
  const fts = profile.map((p) => p[1])
  const min = Math.min(...fts)
  const span = Math.max(SPAN_FT, Math.max(...fts) - min)
  const stride = Math.max(1, Math.ceil(profile.length / BARS))
  const out: { h: number; grade: number }[] = []
  for (let i = 0; i < profile.length; i += stride) {
    const [mi, ft] = profile[i]
    const prev = profile[Math.max(0, i - stride)]
    const run = (mi - prev[0]) * 5280
    out.push({ h: 0.12 + 0.88 * ((ft - min) / span), grade: run > 0 ? Math.abs(((ft - prev[1]) / run) * 100) : 0 })
  }
  return out
}

/** A stop's name short enough for a label: "South Sudbury Station & Diamond Crossing" reads "South Sudbury Station". */
export function shortStop(label: string): string {
  return label.split(/ \(| & | \/ /)[0].trim()
}

const barColor = (g: number) => (g >= 8 ? 'bg-fire' : g >= 4 ? 'bg-gold' : 'bg-teal')

export default function RoamHills({ elevation, isLoop, from, to }: { elevation: RoamElevation; isLoop: boolean; from: string | null; to: string | null }) {
  const up = Math.round(elevation.ascent_ft)
  const down = Math.round(elevation.descent_ft)
  const start = from ? shortStop(from) : 'Start'
  const end = to ? shortStop(to) : 'End'
  const ways: [string, number][] = isLoop ? [['Around the loop', up]] : [[`Toward ${end}`, up], [`Toward ${start}`, down]]
  const said = ways.map(([w, ft]) => `${w}, ${ft} ft of climbing`).join('. ')
  const b = bars(elevation.profile)
  return (
    <div className="mt-3 rounded-[16px] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] sm:px-5">
      <p className="flex items-center gap-1.5 text-[0.9375rem] font-semibold leading-snug text-navy">
        <Mountain size={15} className="shrink-0 text-ink-soft" aria-hidden />
        {hillsWord(elevation)}
      </p>
      <ul className="mt-1.5 space-y-1 text-[0.9375rem] leading-snug">
        {ways.map(([w, ft]) => (
          <li key={w} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-ink-soft">{w}</span>
            <span className="shrink-0 font-semibold tabular-nums text-navy">{ft} ft up</span>
          </li>
        ))}
      </ul>
      {b.length > 0 && (
        <>
          <div className="mt-2.5 flex h-12 items-end gap-[2px]" role="img" aria-label={`Height along the route from ${start} to ${isLoop ? 'back to the start' : end}. ${said}.`}>
            {b.map((x, i) => (
              <div key={i} className={`flex-1 rounded-t-[2px] ${barColor(x.grade)}`} style={{ height: `${Math.round(x.h * 100)}%` }} />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between gap-4 text-[0.8125rem] leading-snug text-ink-soft">
            <span className="min-w-0">{start}</span>
            <span className="min-w-0 text-right">{isLoop ? 'Back to start' : end}</span>
          </div>
        </>
      )}
    </div>
  )
}
