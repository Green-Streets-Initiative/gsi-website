import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cleanReviewer, cleanScore, cleanText, guard, readJson } from '../../../_shared'

export const dynamic = 'force-dynamic'

/**
 * POST { reviewer, verdict: 'agree' | 'adjust', walk?, bike?, note? }
 * One review row per (route, reviewer). A changed re-submit goes back to
 * 'pending' for Keith; an identical re-submit is a no-op and keeps whatever
 * decision he already made.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ corridorId: string }> },
) {
  const denied = await guard(req)
  if (denied) return denied
  const { corridorId } = await params
  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const reviewer = cleanReviewer(body.reviewer)
  if (!reviewer) return NextResponse.json({ error: 'Reviewer name required' }, { status: 400 })
  const verdict = body.verdict === 'agree' || body.verdict === 'adjust' ? body.verdict : null
  if (!verdict) return NextResponse.json({ error: 'Pick Agree or Adjust' }, { status: 400 })
  const walk = cleanScore(body.walk, 1, 10)
  const bike = cleanScore(body.bike, 1, 10)
  if (walk === undefined || bike === undefined) {
    return NextResponse.json({ error: 'Scores must be 1–10' }, { status: 400 })
  }
  const note = cleanText(body.note, 2000)
  if (note === undefined) return NextResponse.json({ error: 'Bad note' }, { status: 400 })
  if (verdict === 'adjust' && walk === null && bike === null) {
    return NextResponse.json({ error: 'Give at least one corrected score' }, { status: 400 })
  }
  if (verdict === 'adjust' && !note) {
    return NextResponse.json({ error: 'Say why — Keith reads every reason' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: corridor, error: cErr } = await supabase
    .from('route_corridors')
    .select('id, excluded_at')
    .eq('id', corridorId)
    .maybeSingle()
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  if (!corridor) return NextResponse.json({ error: 'Route not found' }, { status: 404 })
  if (corridor.excluded_at) {
    return NextResponse.json({ error: 'Keith set this route aside; it is not being reviewed.' }, { status: 409 })
  }

  const next = {
    verdict,
    suggested_walk_score: verdict === 'adjust' ? walk : null,
    suggested_bike_score: verdict === 'adjust' ? bike : null,
    note: note ?? null,
  }

  const { data: existing } = await supabase
    .from('route_corridor_reviews')
    .select('*')
    .eq('corridor_id', corridorId)
    .eq('reviewer_name', reviewer)
    .maybeSingle()

  if (existing) {
    const unchanged =
      existing.verdict === next.verdict &&
      existing.suggested_walk_score === next.suggested_walk_score &&
      existing.suggested_bike_score === next.suggested_bike_score &&
      (existing.note ?? null) === next.note
    if (unchanged) return NextResponse.json({ ok: true, review: existing, unchanged: true })
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('route_corridor_reviews')
      .update({
        ...next,
        submitted_at: now,
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        review_note: null,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('*')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, review: data })
  }

  const { data, error } = await supabase
    .from('route_corridor_reviews')
    .insert({ corridor_id: corridorId, reviewer_name: reviewer, ...next })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, review: data })
}
