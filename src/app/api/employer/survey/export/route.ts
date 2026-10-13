import { createServerSupabaseClient } from '@/lib/supabase-server'
import { requirePortalCaller } from '@/lib/employer/portal-auth'
import { exportCsv, exportFor, exportText, type Evidence, type ExportResponse, type ExportSurvey } from '@/lib/employer/survey-exports'
import type { RuleSet, SurveyAnswers } from '@/lib/employer/survey-instrument'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORMATS = new Set(['massdep', 'cambridge', 'boston', 'emissions'])

/**
 * One export for a survey, computed here from the raw answers (service
 * role) and returned as totals only. The caller must be on the company's
 * portal team. GET /api/employer/survey/export?survey_id=<uuid>&format=<rule set>
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const surveyId = url.searchParams.get('survey_id')
  const format = url.searchParams.get('format') ?? ''
  if (!surveyId || !/^[0-9a-f-]{36}$/i.test(surveyId) || !FORMATS.has(format)) {
    return Response.json({ error: 'survey_id and format required' }, { status: 400 })
  }
  const sb = createServerSupabaseClient()
  const { data: s } = await sb
    .from('employer_surveys')
    .select('id, group_id, title, rule_set, week_start, closes_on, headcount, groups(name, created_at, access_starts_at)')
    .eq('id', surveyId)
    .maybeSingle()
  if (!s) return Response.json({ error: 'not_found' }, { status: 404 })
  const check = await requirePortalCaller(request, s.group_id as string)
  if (!check.ok) return check.res

  const g = (Array.isArray(s.groups) ? s.groups[0] : s.groups) as { name: string; created_at: string; access_starts_at: string | null } | null

  const [{ data: responses }, { count: invited }, { data: matchedRows }] = await Promise.all([
    sb.from('employer_survey_responses').select('answers, applicable, source, recipient_id').eq('survey_id', surveyId).limit(10000),
    sb.from('employer_survey_recipients').select('id', { count: 'exact', head: true }).eq('survey_id', surveyId).neq('status', 'unsubscribed'),
    sb.from('employer_survey_responses').select('recipient_id').eq('survey_id', surveyId).not('recipient_id', 'is', null).limit(10000),
  ])
  const rows: ExportResponse[] = (responses ?? []).map((r) => ({
    answers: r.answers as SurveyAnswers,
    applicable: r.applicable as boolean,
    source: r.source as ExportResponse['source'],
    matched: r.recipient_id != null,
  }))
  const matched = (matchedRows ?? []).length
  const survey: ExportSurvey = {
    title: s.title as string,
    rule_set: s.rule_set as RuleSet,
    week_start: s.week_start as string,
    closes_on: s.closes_on as string,
    headcount: (s.headcount as number | null) ?? null,
    invited: invited ?? 0,
    responded_matched: matched,
    responded_unmatched: rows.length - matched,
  }

  const evidence = await shiftEvidence(s.group_id as string, g)
  const doc = exportFor(format as RuleSet, survey, rows, evidence)
  return Response.json({ doc, csv: exportCsv(doc), text: exportText(doc) })
}

/** Shift's year-round numbers for the filing's "measures and response" section. */
async function shiftEvidence(groupId: string, g: { name: string; created_at: string; access_starts_at: string | null } | null): Promise<Evidence | null> {
  if (!g) return null
  const sb = createServerSupabaseClient()
  const now = new Date()
  const year = now.getFullYear()
  const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString()
  const joined = new Date(g.access_starts_at ?? g.created_at)
  const first30End = new Date(joined.getTime() + 30 * 86400000)

  type Dash = {
    member_count?: number
    active_trips_this_period?: number
    shift_rate_trip_pct?: number
    drive_alone_share_pct?: number
    co2_avoided_kg_v2?: number
    trips_this_period?: number
  }
  const [ytd, first30, members, challenges] = await Promise.all([
    sb.rpc('get_employer_dashboard_data', { p_group_id: groupId, p_days: 365, p_starts_at: yearStart, p_ends_at: now.toISOString() }),
    sb.rpc('get_employer_dashboard_data', { p_group_id: groupId, p_days: 30, p_starts_at: joined.toISOString(), p_ends_at: first30End.toISOString() }),
    sb.rpc('get_employer_members', { p_group_id: groupId, p_days: 30 }),
    sb.from('competitions').select('name, starts_at, ends_at').eq('group_id', groupId).gte('ends_at', yearStart).order('starts_at').limit(20),
  ])
  const y = (ytd.data ?? null) as Dash | null
  const f = (first30.data ?? null) as Dash | null
  if (!y || ytd.error) return null
  const activeMembers = Array.isArray(members.data)
    ? (members.data as { trips_in_period?: number }[]).filter((m) => (m.trips_in_period ?? 0) > 0).length
    : 0
  const enough = (d: Dash | null) => !!d && (d.trips_this_period ?? 0) >= 10
  return {
    company: g.name,
    members: y.member_count ?? 0,
    active_members: activeMembers,
    shift_rate_ytd_pct: enough(y) ? Math.round(y.shift_rate_trip_pct ?? 0) : null,
    shift_rate_first_30_pct: enough(f) && first30End < now ? Math.round(f!.shift_rate_trip_pct ?? 0) : null,
    first_30_label: `${joined.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} to ${first30End.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
    active_trips_ytd: y.active_trips_this_period ?? 0,
    co2_avoided_kg_ytd: y.co2_avoided_kg_v2 ?? 0,
    drive_alone_share_ytd_pct: enough(y) && y.drive_alone_share_pct != null ? Math.round(y.drive_alone_share_pct) : null,
    challenges: ((challenges.data ?? []) as { name: string; starts_at: string; ends_at: string }[]).map((c) => ({ name: c.name, starts_at: c.starts_at, ends_at: c.ends_at })),
    year,
  }
}
