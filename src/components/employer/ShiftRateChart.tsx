import type { WeeklyShiftRate } from '@/lib/impact-sparkline'

/**
 * Shift Rate by week, read like a business chart (Keith 2026-10-01): a fixed
 * 0–100% scale with labelled gridlines, each week's value printed on its
 * point, the week dates along the bottom, and a gap for a week with no
 * recorded trips (it is not a 0% week). No hooks, so the server-rendered
 * report and the client Impact page both use it.
 *
 * The SVG keeps its aspect ratio and scales with its container, so pass a
 * `width` close to the width it renders at; type stays at its stated size.
 */
export default function ShiftRateChart({
  weeks,
  width = 680,
  height = 250,
  color = '#2D6A4F',
  ink = '#191A2E',
  muted = '#4A4D68',
}: {
  weeks: WeeklyShiftRate[]
  width?: number
  height?: number
  color?: string
  ink?: string
  muted?: string
}) {
  const left = 42
  const right = 18
  const top = 24
  const bottom = 46
  const plotW = width - left - right
  const plotH = height - top - bottom
  const n = weeks.length
  // Points sit inside the gridlines, clear of the scale labels on the left.
  const inset = 16
  const x = (i: number) => left + inset + (n <= 1 ? (plotW - inset * 2) / 2 : (i / (n - 1)) * (plotW - inset * 2))
  const y = (pct: number) => top + (1 - Math.max(0, Math.min(100, pct)) / 100) * plotH

  const points = weeks.map((w, i) => ({
    i,
    x: x(i),
    value: w.trips > 0 && w.shift_rate_pct != null ? Math.round(w.shift_rate_pct) : null,
  }))

  // Runs of consecutive weeks with trips; a week without trips breaks the line.
  const segments: { x: number; y: number }[][] = []
  let run: { x: number; y: number }[] = []
  for (const p of points) {
    if (p.value == null) {
      if (run.length) segments.push(run)
      run = []
    } else {
      run.push({ x: p.x, y: y(p.value) })
    }
  }
  if (run.length) segments.push(run)

  const step = n > 1 ? (plotW - inset * 2) / (n - 1) : plotW
  const labelEvery = step < 44 ? 2 : 1
  const weekLabel = (iso: string) =>
    new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    })
  const withTrips = points.filter((p) => p.value != null)
  const lastWithTrips = withTrips[withTrips.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      className="block h-auto"
      role="img"
      aria-label={`Shift Rate by week: ${points
        .map((p) => `${weekLabel(weeks[p.i].week_start)} ${p.value == null ? 'no trips' : `${p.value}%`}`)
        .join(', ')}`}
      style={{ fontFamily: 'inherit' }}
    >
      {/* Gridlines and the y-axis scale */}
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line
            x1={left}
            x2={width - right}
            y1={y(g)}
            y2={y(g)}
            stroke={ink}
            strokeOpacity={g === 0 ? 0.35 : 0.1}
            strokeWidth={1}
          />
          <text x={left - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill={muted}>
            {g}%
          </text>
        </g>
      ))}

      {/* The line, broken where a week had no trips */}
      {segments.map((seg, k) =>
        seg.length > 1 ? (
          <polyline
            key={k}
            points={seg.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null,
      )}

      {/* Points with their values; a week without trips shows a dash on the baseline */}
      {points.map((p) =>
        p.value == null ? (
          <text key={p.i} x={p.x} y={y(0) - 6} textAnchor="middle" fontSize="11" fill={muted}>
            –
          </text>
        ) : (
          <g key={p.i}>
            <circle
              cx={p.x}
              cy={y(p.value)}
              r={p === lastWithTrips ? 5 : 3.5}
              fill={color}
              stroke="#fff"
              strokeWidth={p === lastWithTrips ? 2 : 1.5}
            />
            <text
              x={p.x}
              y={y(p.value) - 10}
              textAnchor="middle"
              fontSize="11"
              fontWeight={p === lastWithTrips ? 700 : 600}
              fill={ink}
            >
              {p.value}%
            </text>
          </g>
        ),
      )}

      {/* Week dates along the bottom, and the axis title */}
      {points.map((p) =>
        p.i % labelEvery === (n - 1) % labelEvery ? (
          <text key={`x${p.i}`} x={p.x} y={height - 24} textAnchor="middle" fontSize="11" fill={muted}>
            {weekLabel(weeks[p.i].week_start)}
          </text>
        ) : null,
      )}
      <text x={left + plotW / 2} y={height - 4} textAnchor="middle" fontSize="11" fontWeight={600} fill={muted}>
        Week starting
      </text>
    </svg>
  )
}
