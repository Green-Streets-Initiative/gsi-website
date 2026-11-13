import { createClient } from '@supabase/supabase-js'
import { designRouteForPage } from '@/lib/shift-assistant/ride-plan-tools'

/**
 * POST /api/together/plan-route { matchId, goal?, departAt? }: the route for
 * a first trip plan's guide on /together/plan/<match> (parity
 * gap-together-web-carpool-scope). Bike and walk: the route between the
 * newcomer's meeting spot and end spot for a goal (calmest, flattest,
 * shortest), with the spots worth showing. Transit: up to three trips,
 * at departAt when given. The same routing and spots as the Shift
 * assistant's design_ride_plan_route; the page sends with set_ride_plan_route.
 *
 * Signed in as the person: get_ride_plan decides whether they are this
 * plan's guide and whether it is their turn.
 */

export const maxDuration = 120

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return Response.json({ ok: false, reason: 'signed_out' }, { status: 401 })
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const { data: { user } } = await createClient(url, anonKey, { auth: { persistSession: false } }).auth.getUser(token)
  if (!user) return Response.json({ ok: false, reason: 'signed_out' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { matchId?: unknown; goal?: unknown; departAt?: unknown }
  if (typeof body.matchId !== 'string') return Response.json({ ok: false, reason: 'not_found' }, { status: 400 })
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    const out = await designRouteForPage({ user: userClient, token }, body.matchId, { goal: body.goal, departAt: body.departAt })
    return Response.json(out, { status: out.ok ? 200 : out.reason === 'no_route' ? 200 : 403 })
  } catch {
    return Response.json({ ok: false, reason: 'no_route' })
  }
}
