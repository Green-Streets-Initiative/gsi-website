import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getTripAvoiding, inServiceArea } from '@/lib/server/trip'

/**
 * "Avoid this street" (Around You v2): POST { from, to, avoid, names } with
 * the signed-in person's Supabase token. `avoid` is one list of encoded
 * polylines per street, oldest first, and `names` their names (optional);
 * the answer is { route } (null when there's no reasonable way around), plus
 * `avoided_towns` when a same-named street in another town had to be told
 * apart.
 *
 * Only for people with Around You v2 on (around_you_v2, Shift 01581): each
 * call can cost up to three Google route lookups, so the switch is checked here,
 * not just in the page.
 */

export const maxDuration = 30

const MAX_STREETS = 4
const MAX_STRETCHES = 16
const MAX_POLYLINE_CHARS = 6000

function point(raw: unknown): { lat: number; lng: number } | null {
  const p = raw as { lat?: unknown; lng?: unknown } | null
  const lat = Number(p?.lat)
  const lng = Number(p?.lng)
  return inServiceArea(lat, lng) ? { lat, lng } : null
}

/** Street names, one per avoided street; anything malformed is just left out. */
function streetNames(raw: unknown, count: number): string[] {
  if (!Array.isArray(raw) || raw.length !== count) return []
  return raw.every(s => typeof s === 'string' && s.length <= 120) ? (raw as string[]) : []
}

function streets(raw: unknown): string[][] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_STREETS) return null
  const out: string[][] = []
  for (const g of raw) {
    if (!Array.isArray(g) || g.length === 0 || g.length > MAX_STRETCHES) return null
    if (!g.every(s => typeof s === 'string' && s.length > 0 && s.length <= MAX_POLYLINE_CHARS)) return null
    out.push(g as string[])
  }
  return out
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  // Local preview only (next dev, the page's ?v2=1): no switch check
  if (process.env.NODE_ENV !== 'development') {
    const denied = await gate(token)
    if (denied) return denied
  }

  const body = await req.json().catch(() => null)
  const from = point(body?.from)
  const to = point(body?.to)
  const avoid = streets(body?.avoid)
  if (!from || !to || !avoid) return NextResponse.json({ error: 'from, to and avoid required' }, { status: 400 })

  const result = await getTripAvoiding(from, to, avoid, streetNames(body?.names, avoid.length))
  if (!result) return NextResponse.json({ error: 'route lookup failed' }, { status: 502 })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
}

/** A response when this caller can't use it: signed out, or v2 off. */
async function gate(token: string | undefined): Promise<NextResponse | null> {
  if (!token) return NextResponse.json({ error: 'sign in' }, { status: 401 })
  const { data: { user } } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  ).auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'sign in' }, { status: 401 })
  if (!(await aroundYouV2On(user.id))) return NextResponse.json({ error: 'not available' }, { status: 403 })
  return null
}

/** Same rule as the app's isFlagOnForUser: a user row wins, then the flag's
 *  own switch and rollout (float FNV bucket, never Math.imul). */
async function aroundYouV2On(userId: string): Promise<boolean> {
  const db = createServerSupabaseClient()
  const [flag, mine] = await Promise.all([
    db.from('app_feature_flags').select('enabled, rollout_percent').eq('name', 'around_you_v2').maybeSingle(),
    db.from('app_feature_flag_users').select('user_id').eq('flag_name', 'around_you_v2').eq('user_id', userId).maybeSingle(),
  ])
  if (!mine.error && mine.data) return true
  const f = flag.data as { enabled: boolean; rollout_percent: number | null } | null
  if (flag.error || !f?.enabled) return false
  const pct = f.rollout_percent ?? 0
  if (pct >= 100) return true
  let h = 2166136261
  for (let i = 0; i < userId.length; i++) { h ^= userId.charCodeAt(i); h = (h * 16777619) >>> 0 }
  return pct > 0 && h % 100 < pct
}
