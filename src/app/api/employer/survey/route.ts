import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePortalCaller } from '@/lib/employer/portal-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FN = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-survey-invites`

async function surveyGroup(surveyId: string | null): Promise<string | null> {
  if (!surveyId || !/^[0-9a-f-]{36}$/i.test(surveyId)) return null
  const sb = createServerSupabaseClient()
  const { data } = await sb.from('employer_surveys').select('group_id').eq('id', surveyId).maybeSingle()
  return (data?.group_id as string | undefined) ?? null
}

/**
 * The survey invitation and reminder as staff get them, for the portal's
 * "How this looks to them". GET /api/employer/survey?survey_id=<uuid>
 */
export async function GET(request: Request) {
  const surveyId = new URL(request.url).searchParams.get('survey_id')
  const groupId = await surveyGroup(surveyId)
  const check = await requirePortalCaller(request, groupId)
  if (!check.ok) return check.res
  try {
    const res = await fetch(FN(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${check.token}` },
      body: JSON.stringify({ preview: { survey_id: surveyId } }),
    })
    const json = (await res.json().catch(() => null)) as { invite?: unknown; reminder?: unknown } | null
    if (!res.ok || !json?.invite || !json?.reminder) return Response.json({ error: 'Preview unavailable' }, { status: 502 })
    return Response.json({ invite: json.invite, reminder: json.reminder })
  } catch {
    return Response.json({ error: 'Preview unavailable' }, { status: 502 })
  }
}

/**
 * "Send now": asks the employer-survey-invites function to send this survey's
 * due rows (new personal links, and reminders to people who have not
 * answered) right away. The hourly cron does the same if this call fails.
 * POST {survey_id}
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { survey_id?: string } | null
  const surveyId = body?.survey_id ?? null
  const groupId = await surveyGroup(surveyId)
  const check = await requirePortalCaller(request, groupId, { manage: true })
  if (!check.ok) return check.res
  try {
    const res = await fetch(FN(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${check.token}` },
      body: JSON.stringify({ survey_id: surveyId }),
    })
    if (!res.ok) return Response.json({ queued: true })
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return Response.json(json ?? { queued: true })
  } catch {
    return Response.json({ queued: true })
  }
}
