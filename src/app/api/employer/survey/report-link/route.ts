import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePortalCaller } from '@/lib/employer/portal-auth'
import { signEmployerSurveyReportToken, EMPLOYER_REPORT_TOKEN_TTL_SECONDS, type SurveyReportVariant } from '@/lib/employer-report-token'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORMATS = new Set(['massdep', 'cambridge', 'boston', 'emissions'])

/**
 * POST { surveyId, format, variant } -> { url, expires_at }
 *
 * A one-hour link to the printable survey report (the filing PDF or the
 * one-page leadership summary) for a workplace's commute survey. Anyone on
 * that workplace's portal may ask, as for the impact report; the report
 * page renders with the service role, so this signature is the gate.
 */
export async function POST(request: Request) {
  let body: { surveyId?: unknown; format?: unknown; variant?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'surveyId, format and variant required' }, { status: 400 })
  }
  const surveyId = typeof body.surveyId === 'string' && /^[0-9a-f-]{36}$/i.test(body.surveyId) ? body.surveyId : null
  const format = typeof body.format === 'string' && FORMATS.has(body.format) ? body.format : null
  const variant: SurveyReportVariant | null = body.variant === 'leadership' ? 'leadership' : body.variant === 'filing' ? 'filing' : null
  if (!surveyId || !format || !variant) return Response.json({ error: 'surveyId, format and variant required' }, { status: 400 })

  const sb = createServerSupabaseClient()
  const { data: s } = await sb.from('employer_surveys').select('group_id').eq('id', surveyId).maybeSingle()
  const groupId = (s?.group_id as string | undefined) ?? null
  const check = await requirePortalCaller(request, groupId)
  if (!check.ok) return check.res
  if (!process.env.EMPLOYER_REPORT_TOKEN_SECRET) {
    return Response.json({ error: 'Report links are not configured on this server' }, { status: 500 })
  }
  const t = signEmployerSurveyReportToken({ surveyId, groupId: groupId!, format, variant, email: check.email })
  const origin = new URL(request.url).origin
  const url = `${origin}/shift/employers/survey-report?survey=${encodeURIComponent(surveyId)}&format=${format}&variant=${variant}&t=${t}`
  return Response.json({ url, expires_at: new Date(Date.now() + EMPLOYER_REPORT_TOKEN_TTL_SECONDS * 1000).toISOString() })
}
