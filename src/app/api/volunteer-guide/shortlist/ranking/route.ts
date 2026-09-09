import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { cleanReviewer, guard, readJson } from '../_shared'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST { reviewer, order: schoolId[] } — the whole ranking, top first.
 * The only writer of `rank`. Schools not in `order` get rank NULL.
 * Ranking is not content: it does not bump updated_at, so a submitted
 * school never shows as "edited after submit" just because it moved.
 */
export async function POST(req: NextRequest) {
  const denied = await guard(req)
  if (denied) return denied
  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const reviewer = cleanReviewer(body.reviewer)
  if (!reviewer) return NextResponse.json({ error: 'Reviewer name required' }, { status: 400 })
  const order = Array.isArray(body.order) ? body.order.filter((v): v is string => typeof v === 'string' && UUID.test(v)) : null
  if (!order || order.length === 0 || new Set(order).size !== order.length) {
    return NextResponse.json({ error: 'Bad order' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: rows, error: readErr } = await supabase.from('school_shortlist').select('id, school_id')
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  const byId = new Map((rows ?? []).map((r) => [r.school_id as string, r.id as string]))
  const writes: Promise<string | null>[] = []
  const ranked = new Set<string>()
  order.forEach((schoolId, i) => {
    const id = byId.get(schoolId)
    if (!id) return
    ranked.add(schoolId)
    writes.push(
      (async () => {
        const { error } = await supabase
          .from('school_shortlist')
          .update({ rank: i + 1 })
          .eq('id', id)
        return error?.message ?? null
      })(),
    )
  })
  for (const [schoolId, id] of byId) {
    if (ranked.has(schoolId)) continue
    writes.push(
      (async () => {
        const { error } = await supabase
          .from('school_shortlist')
          .update({ rank: null })
          .eq('id', id)
          .not('rank', 'is', null)
        return error?.message ?? null
      })(),
    )
  }
  const failed = (await Promise.all(writes)).find((m) => m !== null)
  if (failed) return NextResponse.json({ error: failed }, { status: 500 })
  return NextResponse.json({ ok: true })
}
