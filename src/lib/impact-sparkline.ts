/**
 * The Shift Rate trend, shared by the Impact page and the printable report.
 * Pure: takes the RPC's weekly buckets, returns numbers and SVG path data.
 */

export type WeeklyShiftRate = {
  week_start: string
  trips: number
  active_trips: number
  shift_rate_pct: number | null
}

/** How many weeks of real trips a trend needs before it is drawn. */
export const TREND_MIN_WEEKS_WITH_TRIPS = 3

/**
 * The values to plot, oldest first, or null when there isn't enough to show.
 * Weeks with no trips carry a null rate and plot as 0 so the line stays
 * continuous; a brand-new team gets an honest "not yet" instead of a flat line.
 */
export function trendValues(weeks: WeeklyShiftRate[] | null | undefined): number[] | null {
  if (!weeks || weeks.length < 2) return null
  const weeksWithTrips = weeks.filter((w) => w.trips > 0).length
  if (weeksWithTrips < TREND_MIN_WEEKS_WITH_TRIPS) return null
  return weeks.map((w) => w.shift_rate_pct ?? 0)
}

export type Sparkline = {
  W: number
  H: number
  pts: [number, number][]
  line: string
  area: string
  min: number
  max: number
}

/** SVG path data for a line and its area fill, fitted to a W×H box. */
export function sparkline(values: number[], W = 640, H = 150, pad = 8): Sparkline {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((v, i) => {
    const x = pad + (i / Math.max(1, values.length - 1)) * (W - pad * 2)
    const y = pad + (1 - (v - min) / (max - min || 1)) * (H - pad * 2)
    return [x, y] as [number, number]
  })
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = line + ` L${(W - pad).toFixed(1)} ${H - pad} L${pad} ${H - pad} Z`
  return { W, H, pts, line, area, min, max }
}

/** First and last week labels for the axis, e.g. "Jul 6" and "Sep 28". */
export function trendAxisLabels(weeks: WeeklyShiftRate[]): { first: string; last: string } {
  const fmt = (iso: string) =>
    new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  return { first: fmt(weeks[0].week_start), last: fmt(weeks[weeks.length - 1].week_start) }
}
