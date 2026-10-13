import type { RuleSet } from '@/lib/employer/survey-instrument'

export type SurveyStatusValue = 'draft' | 'open' | 'closed'

/** A row of employer_surveys as the portal reads it (RLS: own team). */
export type SurveyRow = {
  id: string
  group_id: string
  title: string
  /** The first filing (MassDEP when ticked); kept for older readers. */
  rule_set: RuleSet
  /** Every filing this survey serves (Shift 01172). */
  rule_sets: RuleSet[]
  week_start: string
  closes_on: string
  status: SurveyStatusValue
  headcount: number | null
  site_headcounts: Record<string, number>
  departments: { name: string; headcount?: number | null }[]
  open_token: string
  created_at: string
  opened_at: string | null
  closed_at: string | null
}

export type SiteStat = {
  location_id: string
  name: string
  headcount: number | null
  invited: number
  responded: number | null
  fewer_than_5: boolean
}

export type DepartmentStat = {
  name: string
  headcount: number | null
  invited: number
  responded: number | null
  fewer_than_5: boolean
}

export type Person = {
  id: string
  name: string | null
  email: string
  department: string | null
  location_id: string | null
  status: 'pending' | 'sent' | 'reminded' | 'responded' | 'unsubscribed' | 'bounced'
  responded: boolean
  has_app: boolean
}

/** get_employer_survey_status (Shift 01170, 01172). */
export type SurveyStatus = {
  ok: true
  survey: SurveyRow
  invited: number
  responded_matched: number
  responded_unmatched: number
  responded_app: number
  responded_total: number
  applicable: number
  by_site: SiteStat[]
  by_department: DepartmentStat[]
  people: Person[]
}

export const SURVEY_PATH = '/shift/employers/portal/survey'
export const SURVEY_LINK_BASE = 'https://www.gogreenstreets.org/survey'

/** rule_sets with a fallback for rows written before 01172. */
export function ruleSetsOf(s: { rule_set: RuleSet; rule_sets?: RuleSet[] | null }): RuleSet[] {
  return s.rule_sets && s.rule_sets.length > 0 ? s.rule_sets : [s.rule_set]
}

export const REASONS: Record<string, string> = {
  forbidden: 'Only an admin or manager on your team can do that.',
  not_enabled: 'The commute survey is not switched on for your workplace yet. Email info@gogreenstreets.org.',
  bad_rule_set: 'Pick at least one filing.',
  week_start_not_monday: 'Survey week must start on a Monday.',
  closes_before_friday: 'The survey has to stay open at least through the Friday of survey week.',
  week_taken: 'There is already a survey for that week.',
  week_locked: 'People have answered about this week, so the week cannot change now.',
  closed: 'This survey is closed.',
  in_use: 'People have already been emailed or have answered, so this cannot go back to a draft.',
  has_responses: 'This survey has answers, so it cannot be deleted. Close it instead.',
  too_many: 'That is more than 2,000 people in one go. Split the list.',
}
