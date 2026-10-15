import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/*
 * Commute Advisor v2 "Tag Along" (Keith 2026-10-05): one row per tap of
 * "Want a commute partner for this trip?", so the employer program can
 * pair people up through the company. Records the employer, the office,
 * the way in and the distance band. No person, no address, no coordinates.
 *
 * Writes with the service role into tag_along_requests (Shift migration
 * 01134, held in supabase/migrations-pending until the v2 push). The
 * browser holds no policy on the table. Until the table exists the ask is
 * still counted (PostHog advisor_tag_along_clicked fires client-side) and
 * this answers ok with recorded:false, so the page can be tried end to end.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MODES = new Set(['walk', 'bike', 'ebike', 'transit', 'bus', 'drive', 'carpool', 'shuttle'])
const DISTANCE = new Set(['short', 'medium', 'long'])

const uuidOrNull = (v: unknown): string | null => (typeof v === 'string' && UUID_RE.test(v) ? v : null)

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  const mode = typeof body.mode === 'string' && MODES.has(body.mode) ? body.mode : null
  if (!mode) return NextResponse.json({ ok: false, error: 'mode required' }, { status: 400 })
  const row = {
    group_id: uuidOrNull(body.group_id),
    location_id: uuidOrNull(body.location_id),
    mode,
    distance_category: typeof body.distance_category === 'string' && DISTANCE.has(body.distance_category) ? body.distance_category : null,
    variant: body.variant === 'public' ? 'public' : 'employer',
  }

  try {
    const admin = createServerSupabaseClient()
    const { error } = await admin.from('tag_along_requests').insert(row)
    if (!error) return NextResponse.json({ ok: true, recorded: true })
    // The table arrives with the held migration; until then the ask is
    // logged here and counted in PostHog, not lost.
    const missing = error.code === '42P01' || error.code === 'PGRST205' || /tag_along_requests/.test(error.message)
    if (missing) {
      console.warn('[tag-along] tag_along_requests not yet migrated; ask not stored', row)
      return NextResponse.json({ ok: true, recorded: false })
    }
    console.error('[tag-along] insert failed:', error.message)
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
  } catch (err) {
    console.error('[tag-along] failed:', err)
    return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
  }
}
