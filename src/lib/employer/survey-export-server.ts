import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exportFor, type Evidence, type ExportDoc, type ExportResponse, type ExportSurvey } from './survey-exports'
import type { RuleSet, SurveyAnswers } from './survey-instrument'

export type SurveyGroupRow = { id: string; name: string; logo_url: string | null; created_at: string; access_starts_at: string | null }

export type BuiltExport = {
  doc: ExportDoc
  survey: ExportSurvey & { id: string; group_id: string; status: string; rule_sets: RuleSet[]; closed_at: string | null }
  group: SurveyGroupRow
  rows: ExportResponse[]
  evidence: Evidence | null
}

/**
 * One filing summary for a survey, built from the raw answers with the
 * service role and returned as totals (Shift 01170). The API route and the
 * printable report page both read from here; neither returns an answer.
 */
export async function buildSurveyExport(surveyId: string, format: RuleSet): Promise<BuiltExport | null> {
  const sb = createServerSupabaseClient()
  const { data: s } = await sb
    .from('employer_surveys')
    .select('id, group_id, title, rule_set, rule_sets, week_start, closes_on, headcount, status, closed_at, groups(id, name, logo_url, created_at, access_starts_at)')
    .eq('id', surveyId)
    .maybeSingle()
  if (!s) return null
  const g = (Array.isArray(s.groups) ? s.groups[0] : s.groups) as SurveyGroupRow | null
  if (!g) return null

  const [{ data: responses }, { count: invited }] = await Promise.all([
    sb.from('employer_survey_responses').select('answers, applicable, source, recipient_id').eq('survey_id', surveyId).limit(10000),
    sb.from('employer_survey_recipients').select('id', { count: 'exact', head: true }).eq('survey_id', surveyId).neq('status', 'unsubscribed'),
  ])
  const rows: ExportResponse[] = (responses ?? []).map((r) => ({
    answers: r.answers as SurveyAnswers,
    applicable: r.applicable as boolean,
    source: r.source as ExportResponse['source'],
    matched: r.recipient_id != null,
  }))
  const matched = rows.filter((r) => r.matched).length
  const ruleSets = ((s.rule_sets as RuleSet[] | null) ?? []).length > 0 ? (s.rule_sets as RuleSet[]) : [s.rule_set as RuleSet]
  const survey: BuiltExport['survey'] = {
    id: s.id as string,
    group_id: s.group_id as string,
    status: s.status as string,
    closed_at: (s.closed_at as string | null) ?? null,
    rule_sets: ruleSets,
    title: s.title as string,
    rule_set: s.rule_set as RuleSet,
    week_start: s.week_start as string,
    // A survey closed by hand before its last day reports the day it closed.
    closes_on: closedOn(s.closes_on as string, s.status as string, (s.closed_at as string | null) ?? null),
    headcount: (s.headcount as number | null) ?? null,
    invited: invited ?? 0,
    responded_matched: matched,
    responded_unmatched: rows.length - matched,
  }
  const evidence = await shiftEvidence(s.group_id as string, g)
  return { doc: exportFor(format, survey, rows, evidence), survey, group: g, rows, evidence }
}

/** Shift's year-round numbers for the filing's "measures and response" section. */
export async function shiftEvidence(groupId: string, g: SurveyGroupRow): Promise<Evidence | null> {
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
  const short = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return {
    company: g.name,
    members: y.member_count ?? 0,
    active_members: activeMembers,
    shift_rate_ytd_pct: enough(y) ? Math.round(y.shift_rate_trip_pct ?? 0) : null,
    shift_rate_first_30_pct: enough(f) && first30End < now ? Math.round(f!.shift_rate_trip_pct ?? 0) : null,
    first_30_label: `${short(joined)} to ${short(first30End)}`,
    active_trips_ytd: y.active_trips_this_period ?? 0,
    co2_avoided_kg_ytd: y.co2_avoided_kg_v2 ?? 0,
    drive_alone_share_ytd_pct: enough(y) && y.drive_alone_share_pct != null ? Math.round(y.drive_alone_share_pct) : null,
    challenges: ((challenges.data ?? []) as { name: string; starts_at: string; ends_at: string }[]).map((c) => ({ name: c.name, starts_at: c.starts_at, ends_at: c.ends_at })),
    year,
  }
}

function closedOn(closesOn: string, status: string, closedAt: string | null): string {
  if (status !== 'closed' || !closedAt) return closesOn
  const day = new Date(closedAt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  return day < closesOn ? day : closesOn
}
