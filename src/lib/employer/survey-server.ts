import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { RuleSet } from './survey-instrument'

/** A survey as the public page needs it: no tokens other than the one used, no answers. */
export type PublicSurvey = {
  id: string
  title: string
  rule_set: RuleSet
  week_start: string
  closes_on: string
  status: 'draft' | 'open' | 'closed'
  departments: string[]
  company: string
  logo_url: string | null
  enabled: boolean
  sites: { id: string; name: string }[]
}

export type ResolvedToken =
  | { kind: 'recipient'; survey: PublicSurvey; recipient: { id: string; name: string | null; department: string | null; location_id: string | null; user_id: string | null; answered: boolean } }
  | { kind: 'open'; survey: PublicSurvey }
  | { kind: 'none' }

const TOKEN_RE = /^[0-9a-f]{32}$/i

type SurveyRow = {
  id: string
  group_id: string
  title: string
  rule_set: RuleSet
  week_start: string
  closes_on: string
  status: 'draft' | 'open' | 'closed'
  departments: { name?: string }[] | null
  groups: { name: string; logo_url: string | null; commute_survey_enabled: boolean } | { name: string; logo_url: string | null; commute_survey_enabled: boolean }[] | null
}

const SURVEY_SELECT = 'id, group_id, title, rule_set, week_start, closes_on, status, departments, groups(name, logo_url, commute_survey_enabled)'

async function publicSurvey(row: SurveyRow): Promise<PublicSurvey> {
  const sb = createServerSupabaseClient()
  const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
  const { data: sites } = await sb
    .from('employer_locations')
    .select('id, name, address, sort_order')
    .eq('group_id', row.group_id)
    .order('sort_order')
  return {
    id: row.id,
    title: row.title,
    rule_set: row.rule_set,
    week_start: row.week_start,
    closes_on: row.closes_on,
    status: row.status,
    departments: (row.departments ?? []).map((d) => d.name?.trim() ?? '').filter(Boolean),
    company: g?.name ?? 'Your employer',
    logo_url: g?.logo_url ?? null,
    enabled: g?.commute_survey_enabled === true,
    sites: (sites ?? []).map((s) => ({ id: s.id as string, name: ((s.name as string | null)?.trim() || (s.address as string).split(',')[0]) })),
  }
}

/** A personal link token, or a survey's open token. Service role; never called from a client. */
export async function resolveSurveyToken(token: string): Promise<ResolvedToken> {
  if (!TOKEN_RE.test(token)) return { kind: 'none' }
  const sb = createServerSupabaseClient()
  const { data: r } = await sb
    .from('employer_survey_recipients')
    .select(`id, name, department, location_id, user_id, status, employer_surveys(${SURVEY_SELECT})`)
    .eq('token', token.toLowerCase())
    .maybeSingle()
  if (r) {
    const s = (Array.isArray(r.employer_surveys) ? r.employer_surveys[0] : r.employer_surveys) as SurveyRow | null
    if (!s) return { kind: 'none' }
    const { count } = await sb
      .from('employer_survey_responses')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', r.id as string)
    return {
      kind: 'recipient',
      survey: await publicSurvey(s),
      recipient: {
        id: r.id as string,
        name: (r.name as string | null) ?? null,
        department: (r.department as string | null) ?? null,
        location_id: (r.location_id as string | null) ?? null,
        user_id: (r.user_id as string | null) ?? null,
        answered: (count ?? 0) > 0,
      },
    }
  }
  const { data: s } = await sb.from('employer_surveys').select(SURVEY_SELECT).eq('open_token', token.toLowerCase()).maybeSingle()
  if (!s) return { kind: 'none' }
  return { kind: 'open', survey: await publicSurvey(s as unknown as SurveyRow) }
}
