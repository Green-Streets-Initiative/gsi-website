import { Mountain } from 'lucide-react'
import type { RoamElevation } from '@/lib/roams/queries'

/**
 * How hilly a Roam is, on the first screen (Keith 2026-10-29: "add elevation
 * data to trail pages"): the hills in a word, the climb each way, and the
 * route's height as a row of bars on one scale for every Roam, so a flat
 * trail looks flat. Bars are teal under a 4% grade, gold to 8%, orange above,
 * as in the app's ride sheet and the assistant's trail card.
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

const barColor = (g: number) => (g >= 8 ? 'bg-fire' : g >= 4 ? 'bg-gold' : 'bg-teal')

export default function RoamHills({ elevation, isLoop }: { elevation: RoamElevation; isLoop: boolean }) {
  const up = Math.round(elevation.ascent_ft)
  const down = Math.round(elevation.descent_ft)
  const climb = isLoop ? `${up} ft of climbing` : `Climbs ${up} ft going, ${down} ft coming back`
  const b = bars(elevation.profile)
  return (
    <div className="mt-3 rounded-[16px] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(25,26,46,0.05),0_0_0_1px_rgba(25,26,46,0.06)] sm:px-5">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.9375rem] leading-snug text-navy">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Mountain size={15} className="shrink-0 self-center text-ink-soft" aria-hidden />
          {hillsWord(elevation)}
        </span>
        <span className="text-ink-soft">{climb}</span>
      </p>
      {b.length > 0 && (
        <>
          <div className="mt-2.5 flex h-12 items-end gap-[2px]" role="img" aria-label={`Height along the route. ${climb}.`}>
            {b.map((x, i) => (
              <div key={i} className={`flex-1 rounded-t-[2px] ${barColor(x.grade)}`} style={{ height: `${Math.round(x.h * 100)}%` }} />
            ))}
          </div>
          {/* The stop names are in the start line above; the chart only needs its ends. */}
          <div className="mt-1.5 flex justify-between text-[0.8125rem] leading-snug text-ink-soft">
            <span>Start</span>
            <span>{isLoop ? 'Back to start' : 'End'}</span>
          </div>
        </>
      )}
    </div>
  )
}
