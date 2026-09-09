import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getShortlistRow } from '@/lib/shortlist/server'
import { EDITABLE_SCORE_KEYS, EDITABLE_TEXT_KEYS } from '@/lib/shortlist/types'
import { cleanReviewer, cleanScore, cleanText, guard, readJson } from '../_shared'

export const dynamic = 'force-dynamic'

/**
 * PATCH { reviewer, fields } — autosave of the volunteer's fields on one
 * school. Keys are whitelisted; scores coerced to 0–2 or null. Never touches
 * rank (the ranking endpoint owns it) or volunteer_status beyond
 * not_started → in_progress. An edit after Keith reviewed a submitted school
 * clears reviewed_at so it re-enters his queue.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const denied = await guard(req)
  if (denied) return denied
  const { schoolId } = await params
  const body = await readJson(req)
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  const reviewer = cleanReviewer(body.reviewer)
  if (!reviewer) return NextResponse.json({ error: 'Reviewer name required' }, { status: 400 })
  const fields = body.fields && typeof body.fields === 'object' ? (body.fields as Record<string, unknown>) : null
  if (!fields) return NextResponse.json({ error: 'No fields' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  for (const k of EDITABLE_SCORE_KEYS) {
    if (!(k in fields)) continue
    const v = cleanScore(fields[k], 0, 2)
    if (v === undefined) return NextResponse.json({ error: `Bad value for ${k}` }, { status: 400 })
    patch[k] = v
  }
  for (const k of EDITABLE_TEXT_KEYS) {
    if (!(k in fields)) continue
    const v = cleanText(fields[k])
    if (v === undefined) return NextResponse.json({ error: `Bad value for ${k}` }, { status: 400 })
    patch[k] = v
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()
  const { data: current, error: readErr } = await supabase
    .from('school_shortlist')
    .select('id, volunteer_status, reviewed_at')
    .eq('school_id', schoolId)
    .maybeSingle()
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'Not on the shortlist' }, { status: 404 })

  patch.last_edited_by = reviewer
  patch.updated_at = new Date().toISOString()
  if (current.volunteer_status === 'not_started') patch.volunteer_status = 'in_progress'
  if (current.volunteer_status === 'submitted' && current.reviewed_at) patch.reviewed_at = null

  const { error } = await supabase.from('school_shortlist').update(patch).eq('id', current.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = await getShortlistRow(schoolId)
  return NextResponse.json({ ok: true, row })
}
