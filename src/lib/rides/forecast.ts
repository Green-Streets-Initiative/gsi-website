/**
 * The forecast for a ride date, and the one rule for calling it wet: ported
 * from the Shift app's shared module (supabase/functions/_shared/ride-weather.ts,
 * weatherReason / rideForecast), which also drives the organizer's evening
 * check-in push and the app's Up Next card. Keep the two in step, so the
 * website, the assistant and the push never disagree about the same ride.
 *
 * Plain TS; the National Weather Service fetch is the site's cached one
 * (lib/commute/weather.ts fetchNwsHours).
 */
export interface HourPeriod {
  startTime: string
  shortForecast: string
  pop: number
  tempF?: number | null
}

export interface RideForecast {
  temp_f: number | null
  /** "Rain likely (60%)" when wet; null when it isn't. */
  label: string | null
  /** NWS's words for the start hour: "Mostly Sunny". */
  short_forecast: string | null
  pop: number
  wet: boolean
}

const NY_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
})
const PRECIP_RE = /rain|shower|snow|sleet|thunder|drizzle|ice|flurr/i
const SNOW_RE = /snow|sleet|ice|flurr/i
const POP_THRESHOLD = 50

function nyParts(d: Date): { date: string; hour: number } {
  const parts: Record<string, string> = {}
  for (const p of NY_FMT.formatToParts(d)) parts[p.type] = p.value
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24 }
}

/** The worst hour in [start−1h, start+1h] on the ride's date, or null when dry. */
export function weatherReason(periods: HourPeriod[], date: string, startHour: number): { label: string; pop: number } | null {
  let worst: { label: string; pop: number } | null = null
  for (const p of periods) {
    const at = nyParts(new Date(p.startTime))
    if (at.date !== date || at.hour < startHour - 1 || at.hour > startHour + 1) continue
    const wet = p.pop >= POP_THRESHOLD || PRECIP_RE.test(p.shortForecast)
    if (!wet) continue
    const kind = SNOW_RE.test(p.shortForecast) ? 'Snow' : 'Rain'
    const label = p.pop >= POP_THRESHOLD ? `${kind} likely (${Math.round(p.pop)}%)` : `${kind} possible`
    if (!worst || p.pop > worst.pop) worst = { label, pop: p.pop }
  }
  return worst
}

/** At the start, plus the worst of the hour either side; null beyond NWS's ~7 days. */
export function rideForecast(periods: HourPeriod[], date: string, startHour: number): RideForecast | null {
  const atStart = periods.find((p) => { const at = nyParts(new Date(p.startTime)); return at.date === date && at.hour === startHour })
  const worst = weatherReason(periods, date, startHour)
  if (!atStart && !worst) return null
  return {
    temp_f: atStart?.tempF ?? null,
    label: worst?.label ?? null,
    short_forecast: atStart?.shortForecast ?? null,
    pop: worst?.pop ?? atStart?.pop ?? 0,
    wet: !!worst,
  }
}

/** One line for a page: "Rain likely (60%) · 48°F" or "Mostly sunny · 52°F". */
export function forecastLine(f: RideForecast): string {
  const temp = f.temp_f != null ? `${Math.round(f.temp_f)}°F` : null
  const words = f.label ?? (f.short_forecast ? f.short_forecast[0].toUpperCase() + f.short_forecast.slice(1).toLowerCase() : null)
  return [words, temp].filter(Boolean).join(' · ')
}
