import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getShortlistRow } from '@/lib/shortlist/server'
import { CRITERIA } from '@/lib/shortlist/types'
import { cleanReviewer, guard, readJson } from '../../_shared'

export const dynamic = 'force-dynamic'

/**
 * POST { reviewer } — the volunteer says "this school is done". Requires a
 * PTO score and a reason for every override that is set. Re-submitting is
 * allowed (updates the stamp).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ schoolId: string }> },
) {
  const denied = await guard(req)
  if (denied) return denied
  const { schoolId } = await params
  const body = await readJson(req)
  const reviewer = cleanReviewer(body?.reviewer)
  if (!reviewer) return NextResponse.json({ error: 'Reviewer name required' }, { status: 400 })

  const row = await getShortlistRow(schoolId)
  if (!row) return NextResponse.json({ error: 'Not on the shortlist' }, { status: 404 })

  const missing: string[] = []
  if (row.pto_score === null) missing.push('PTO score')
  for (const c of CRITERIA) {
    if (c.key === 'pto') continue
    const override = row[`override_${c.key}` as keyof typeof row] as number | null
    const note = row[`override_${c.key}_note` as keyof typeof row] as string | null
    if (override !== null && !note) missing.push(`Reason for the ${c.label} override`)
  }
  if (missing.length > 0) {
    return NextResponse.json({ error: 'A few things are missing', missing }, { status: 422 })
  }

  const supabase = createServerSupabaseClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('school_shortlist')
    .update({
      volunteer_status: 'submitted',
      submitted_at: now,
      submitted_by: reviewer,
      last_edited_by: reviewer,
      updated_at: now,
      reviewed_at: null,
    })
    .eq('id', row.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, row: await getShortlistRow(schoolId) })
}
