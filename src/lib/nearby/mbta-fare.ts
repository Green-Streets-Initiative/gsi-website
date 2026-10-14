/**
 * MBTA fare for a multi-leg trip under the two-hour transfer pilot.
 *
 * From September 1, 2026 for six months, a rider who taps the same card or
 * phone the whole way gets unlimited transfers between subway, bus and ferry
 * within two hours and pays only the highest single fare
 * (https://www.mbta.com/fares/transfers). Google's transitFare still adds the
 * legs up — Union Square → Seaport by Green Line + bus 4 read "$4.10" when the
 * trip costs $2.40 — and sometimes returns no fare at all.
 *
 * Pure: no imports, so `node --test` runs it without a bundler. Callers pass
 * the prices and pilot end from src/lib/facts/prices.json.
 */

export interface FareLine {
  name?: string
  nameShort?: string
  agencies?: Array<{ name?: string }>
}

export interface MbtaFareInputs {
  subwaySingle: number
  busSingle: number
  /** First day the pilot no longer applies, YYYY-MM-DD (Eastern). */
  pilotEnds: string
}

type LegKind = 'subway' | 'bus'

/** Subway or bus fare class for an MBTA line; null for anything the pilot
 *  rule can't price (commuter rail, ferry, other agencies). */
export function mbtaLegKind(line: FareLine): LegKind | null {
  const isMbta = (line.agencies ?? []).some((a) => /\bMBTA\b|massachusetts bay/i.test(a.name ?? ''))
  if (!isMbta) return null
  const name = line.name ?? ''
  const short = (line.nameShort ?? '').trim()
  if (/^(Red|Orange|Blue|Green) Line\b|^Mattapan\b/.test(name)) return 'subway'
  // SL1/SL2/SL3 take subway fares; SL4/SL5 take bus fares.
  const sl = (short.match(/^SL(\d)$/) ?? name.match(/\bSL(\d)\b/))?.[1]
  if (sl) return Number(sl) <= 3 ? 'subway' : 'bus'
  // Local, crosstown and express buses (express is at the local fare during
  // the separate premium-fare pilot).
  if (/^(\d+[A-Z]?|CT\d)$/.test(short)) return 'bus'
  return null
}

/**
 * The pilot fare for a trip that departs at `departure`, or null when the
 * pilot rule doesn't apply: fewer than two transit legs, any leg the rule
 * can't price, or a departure on or after the pilot's end.
 */
export function mbtaPilotFare(lines: FareLine[], departure: Date, p: MbtaFareInputs): number | null {
  if (lines.length < 2) return null
  // Midnight Eastern on the end date; 05:00 UTC is close enough across DST
  // for a rule that ends at the start of a day.
  if (departure.getTime() >= Date.parse(`${p.pilotEnds}T05:00:00Z`)) return null
  let fare = 0
  for (const line of lines) {
    const kind = mbtaLegKind(line)
    if (!kind) return null
    fare = Math.max(fare, kind === 'subway' ? p.subwaySingle : p.busSingle)
  }
  return fare
}
