import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolveSurveyToken } from '@/lib/employer/survey-server'
import { validateAnswers } from '@/lib/employer/survey-instrument'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Store one survey answer (Shift 01170). The token in the URL is the only
 * credential: a personal link answers once for that person; the open link
 * answers as many times as it is used and those count as unmatched. The
 * employer never reads this table; exports are aggregates.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const resolved = await resolveSurveyToken(token)
  if (resolved.kind === 'none') return Response.json({ error: 'not_found' }, { status: 404 })
  const { survey } = resolved
  if (!survey.enabled || survey.status !== 'open') return Response.json({ error: 'closed' }, { status: 409 })
  if (resolved.kind === 'recipient' && resolved.recipient.answered) return Response.json({ error: 'answered' }, { status: 409 })

  const body = (await request.json().catch(() => null)) as { answers?: unknown } | null
  const v = validateAnswers(body?.answers, survey.rule_set)
  if (!v.ok) return Response.json({ error: 'invalid', problems: v.problems }, { status: 400 })

  const siteIds = new Set(survey.sites.map((s) => s.id))
  const locationId = v.answers.location_id && siteIds.has(v.answers.location_id) ? v.answers.location_id : null
  const department = v.answers.department && survey.departments.some((d) => d.toLowerCase() === v.answers.department!.toLowerCase()) ? v.answers.department : null

  const sb = createServerSupabaseClient()
  const row = {
    survey_id: survey.id,
    recipient_id: resolved.kind === 'recipient' ? resolved.recipient.id : null,
    user_id: resolved.kind === 'recipient' ? resolved.recipient.user_id : null,
    source: resolved.kind === 'recipient' ? 'link' : 'open',
    applicable: v.applicable,
    location_id: locationId ?? (resolved.kind === 'recipient' ? resolved.recipient.location_id : null),
    department: department ?? (resolved.kind === 'recipient' ? resolved.recipient.department : null),
    home_zip: v.answers.home_zip ?? null,
    answers: v.answers,
  }
  const { error } = await sb.from('employer_survey_responses').insert(row)
  if (error) {
    // 23505 = this person (or this app account) already answered.
    if (error.code === '23505') return Response.json({ error: 'answered' }, { status: 409 })
    console.error('[survey] insert failed', error.message)
    return Response.json({ error: 'failed' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
