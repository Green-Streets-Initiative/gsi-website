'use client'

import type { BikeComfort, BikeComfortSegment } from '@/lib/types/commute'

const SEGMENT_COLORS: Record<string, string> = {
  protected: '#BAF14D',
  bike_lane: '#2966E5',
  shared_road: '#FF8C35',
}

const SEGMENT_LABELS: Record<string, string> = {
  protected: 'Protected',
  bike_lane: 'Bike lane',
  shared_road: 'Shared',
}

// Roll up a flat segment list into per-rating mileage totals so we can show
// a short numeric breakdown ("4.0 mi protected · 0.7 mi bike lane") instead
// of enumerating every segment.
function rollup(segments: BikeComfortSegment[]) {
  const totals: Record<string, number> = {}
  const flexTotals: Record<string, number> = {}
  for (const s of segments) {
    totals[s.rating] = (totals[s.rating] ?? 0) + (s.distance_mi || 0)
    flexTotals[s.rating] = (flexTotals[s.rating] ?? 0) + (s.distance_mi || 1)
  }
  const totalKnown = Object.values(totals).reduce((a, b) => a + b, 0)
  const totalFlex = Object.values(flexTotals).reduce((a, b) => a + b, 0)
  return ['protected', 'bike_lane', 'shared_road']
    .map((r) => {
      const raw = totals[r] ?? 0
      const flex = flexTotals[r] ?? 0
      if (raw > 0) return { rating: r, miles: raw }
      if (flex > 0 && totalKnown > 0) return { rating: r, miles: +(totalKnown * flex / totalFlex).toFixed(1) }
      return { rating: r, miles: 0 }
    })
    .filter((x) => x.miles > 0)
}

export default function ComfortBar({ rating, segments, theme = 'dark', colors, labels }: Pick<BikeComfort, 'rating' | 'segments'> & {
  theme?: 'dark' | 'light'
  /** Per-rating overrides so host pages can match their own map legend */
  colors?: Record<string, string>
  labels?: Record<string, string>
}) {
  const C = { ...SEGMENT_COLORS, ...colors }
  const L = { ...SEGMENT_LABELS, ...labels }
  const hasSegments = !!segments && segments.length > 0
  const totalDistance = hasSegments
    ? segments!.reduce((sum, s) => sum + (s.distance_mi || 0), 0)
    : 0
  const breakdown = hasSegments ? rollup(segments!) : []

  const a11yLabel = hasSegments
    ? `Route comfort: ${breakdown.map((b) => `${b.miles.toFixed(1)} miles ${L[b.rating] ?? b.rating}`).join(', ')}`
    : rating
      ? `Route comfort: ${L[rating] ?? rating}`
      : 'Route comfort'

  return (
    <div
      aria-label={a11yLabel}
      className={`rounded-lg p-3.5 ${theme === 'light' ? 'border border-[rgba(25,26,46,0.09)] bg-[#FAFBF8]' : 'border border-white/[0.06] bg-white/[0.02]'}`}
    >
      <div className={`mb-1.5 flex items-center justify-between text-[11px] ${theme === 'light' ? 'text-[#5A5C6E]' : 'text-white/75'}`}>
        <span>Route comfort</span>
        {totalDistance > 0 && <span>{totalDistance.toFixed(1)} mi total</span>}
      </div>

      <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-[3px]">
        {hasSegments ? (
          segments!.map((seg, i) => (
            <div
              key={i}
              style={{
                flex: seg.distance_mi || 1,
                backgroundColor: C[seg.rating] ?? '#6B6E85',
              }}
              className="rounded-[3px]"
            />
          ))
        ) : (
          <div
            style={{
              flex: 1,
              backgroundColor: rating ? (C[rating] ?? '#6B6E85') : '#6B6E85',
            }}
            className="rounded-[3px]"
          />
        )}
      </div>

      {breakdown.length > 0 ? (
        <div className={`mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] ${theme === 'light' ? 'text-[#5A5C6E]' : 'text-white/75'}`}>
          {breakdown.map((b) => (
            <div key={b.rating} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: C[b.rating] }}
              />
              {b.miles.toFixed(1)} mi {L[b.rating]?.toLowerCase()}
            </div>
          ))}
        </div>
      ) : (
        <div className={`mt-2.5 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] ${theme === 'light' ? 'text-[#5A5C6E]' : 'text-white/75'}`}>
          {Object.entries(L).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: C[key] }}
              />
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
