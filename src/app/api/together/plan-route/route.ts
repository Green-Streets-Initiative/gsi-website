import { createClient } from '@supabase/supabase-js'
import { designRouteForPage } from '@/lib/shift-assistant/ride-plan-tools'
import { LESSON_KEY } from '@/lib/together-plan'

/**
 * POST /api/together/plan-route { matchId, goal?, departAt? }: the route for
 * a first trip plan's guide on /together/plan/<match> (parity
 * gap-together-web-carpool-scope). Bike and walk: the route between the
 * newcomer's meeting spot and end spot for a goal (calmest, flattest,
 * shortest), with the spots worth showing. Transit: up to three trips,
 * at departAt when given. `through` { lat, lng, label } adds a stop on the
 * way (bike and walk), as Nearby's "Go through a place" does. The same routing and spots as the Shift
 * assistant's design_ride_plan_route; the page sends with set_ride_plan_route.
 *
 * Signed in as the person: get_ride_plan decides whether they are this
 * plan's guide and whether it is their turn.
 */

export const maxDuration = 120

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const body = (await request.json().catch(() => ({}))) as { matchId?: unknown; goal?: unknown; departAt?: unknown; through?: unknown }
  if (typeof body.matchId !== 'string') return Response.json({ ok: false, reason: 'not_found' }, { status: 400 })
  // A free street lesson's instructor (Shift 01889): the key from their lesson email, no
  // Shift account. get_ride_plan reads it, so the same "is this their plan, their turn"
  // check applies. Routing and spots then run as our own server.
  const lessonKey = request.headers.get('x-lesson-token')
  let ctx: { user: ReturnType<typeof createClient>; token: string }
  if (lessonKey && LESSON_KEY.test(lessonKey)) {
    ctx = {
      user: createClient(url, anonKey, {
        global: { headers: { 'x-lesson-token': lessonKey } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      token: process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey,
    }
  } else {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return Response.json({ ok: false, reason: 'signed_out' }, { status: 401 })
    const { data: { user } } = await createClient(url, anonKey, { auth: { persistSession: false } }).auth.getUser(token)
    if (!user) return Response.json({ ok: false, reason: 'signed_out' }, { status: 401 })
    ctx = {
      user: createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
      token,
    }
  }
  try {
    const out = await designRouteForPage(ctx, body.matchId, { goal: body.goal, departAt: body.departAt, through: body.through })
    return Response.json(out, { status: out.ok ? 200 : out.reason === 'no_route' ? 200 : 403 })
  } catch {
    return Response.json({ ok: false, reason: 'no_route' })
  }
}
