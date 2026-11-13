import 'server-only'

/**
 * MBTA station parking near a point: the MBTA's own parking facilities with
 * their posted daily fee, spaces and typical weekday use, and the lines that
 * stop at each station. Read by the "Park at the T" finder on guide pages
 * (/api/park-and-ride) and the Shift assistants.
 *
 * The lots come from Shift's park-and-ride-near function, which reads the
 * same MBTA list the Commute Advisor engine ranks its park-and-ride rows
 * from (Shift supabase/functions/_shared/mbta-parking.ts), so the site and
 * the advisor show one set of lots and fees (parity gap-park-and-ride-twice,
 * 2026-11-13). The point is sent in the request body, never in a URL or a
 * cache key.
 */

export interface ParkAndRideLot {
  id: string
  name: string
  station: string
  stationId: string | null
  lat: number
  lng: number
  miles: number
  dailyFee: string | null
  monthlyFee: string | null
  spaces: number | null
  weekdayUsePct: number | null
  lines: string[]
  /** With a destination: extra miles of driving to go by this station (miles on a straight line). */
  outOfWayMiles?: number
}

/**
 * The nearest stations with parking within 25 miles (five unless asked), or
 * null when the lots can't be read. With `toward` (where they're headed),
 * the stations on the way come first: from Lexington to Kendall, Alewife is
 * 10th nearest but on the way (the assistant left it out, 2026-10-28).
 */
export async function parkAndRideNear(lat: number, lng: number, limit = 5, toward?: { lat: number; lng: number }): Promise<ParkAndRideLot[] | null> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!base || !key) return null
  try {
    const res = await fetch(`${base}/functions/v1/park-and-ride-near`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
      body: JSON.stringify({ lat, lng, limit, toward: toward ?? null }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { lots?: ParkAndRideLot[] }
    return Array.isArray(data.lots) ? data.lots : null
  } catch {
    return null
  }
}
