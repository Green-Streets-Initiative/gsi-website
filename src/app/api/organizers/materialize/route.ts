import { requireOrganizerCaller, SHIFT_FUNCTIONS } from '@/lib/organizers/server'

/**
 * POST { series_id } — generate a ride's upcoming dates now, as the app does
 * after a save, instead of waiting for the nightly run. The Shift function
 * (materialize-ride-occurrences) has no browser support, so the console asks
 * through here with the organizer's own sign-in; the function checks that the
 * caller organizes the ride.
 */
export async function POST(request: Request) {
  const caller = await requireOrganizerCaller(request)
  if (!caller.ok) return caller.res
  const body = await request.json().catch(() => ({}))
  const seriesId = typeof body?.series_id === 'string' ? body.series_id : ''
  if (!/^[0-9a-f-]{36}$/i.test(seriesId)) return Response.json({ error: 'series_id required' }, { status: 400 })

  const res = await fetch(`${SHIFT_FUNCTIONS}/materialize-ride-occurrences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${caller.token}`,
    },
    body: JSON.stringify({ series_id: seriesId }),
    signal: AbortSignal.timeout(25_000),
  }).catch(() => null)
  if (!res) return Response.json({ error: "Couldn't reach Shift" }, { status: 502 })
  const json = await res.json().catch(() => ({}))
  return Response.json(json, { status: res.status })
}
