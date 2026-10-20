// The setup assistant reads the program's results (Keith 2026-10-20: "cannot
// answer questions about data?"): the same figures the Dashboard, Impact,
// Challenges and Survey pages show, read with the signed-in person's own
// permissions. Totals and names only, as the portal shows them; individual
// trips and survey answers stay private.

import type Anthropic from '@anthropic-ai/sdk'
import { buildSurveyExport } from '@/lib/employer/survey-export-server'
import type { RuleSet } from '@/lib/employer/survey-instrument'
import type { ToolCtx, ToolResult } from './tools'

export const RESULTS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_results',
    description:
      "How the program is doing, as the Dashboard and Impact pages show it: people who joined and were active, trips, the share of trips on foot, by bike, transit or carpool (the shift rate), miles by mode, CO2 avoided, week by week, the previous period for comparison, similar workplaces (benchmark), each office, the most active people (names and totals), and Commute Advisor visits. Give days (7, 30, 90 or 365) or start_date and end_date (YYYY-MM-DD) for a custom range; the default is the last 30 days.",
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'integer', enum: [7, 30, 90, 365] },
        start_date: { type: 'string', description: 'YYYY-MM-DD, with end_date, for a custom range.' },
        end_date: { type: 'string', description: 'YYYY-MM-DD, inclusive.' },
      },
    },
  },
  {
    name: 'get_challenge_results',
    description:
      "How a launched challenge is going or went: the standings as the app's leaderboard shows them (trips that count under its rules), how many joined and were active, totals over its dates, goal-reward progress, and winners once drawn. competition_id from get_account_overview.",
    input_schema: { type: 'object', properties: { competition_id: { type: 'string' } }, required: ['competition_id'] },
  },
  {
    name: 'get_survey_results',
    description:
      "A commute survey's results as totals: how people commute, mode shares and the filing's figures, as on the filing summary. format is the filing (massdep, cambridge, boston or emissions); survey_id from get_survey_overview.",
    input_schema: {
      type: 'object',
      properties: { survey_id: { type: 'string' }, format: { type: 'string', enum: ['massdep', 'cambridge', 'boston', 'emissions'] } },
      required: ['survey_id', 'format'],
    },
  },
]

export const RESULTS_ACTIVITY: Record<string, string> = {
  get_results: 'Looking at your results',
  get_challenge_results: 'Looking at the challenge results',
  get_survey_results: 'Reading the survey results',
}

const isYmd = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

/** Midnight in Boston on a calendar day, as an instant. */
function etMidnight(ymd: string): Date {
  for (const off of ['-04:00', '-05:00']) {
    const d = new Date(`${ymd}T00:00:00${off}`)
    if (d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hourCycle: 'h23' }).startsWith('00:00')) return d
  }
  return new Date(`${ymd}T05:00:00Z`)
}
const etDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const round = (n: unknown, d = 1) => (typeof n === 'number' ? Math.round(n * 10 ** d) / 10 ** d : n ?? null)

/** The dashboard figures, trimmed to what a person would ask about. */
function summarize(d: Record<string, unknown> | null) {
  if (!d) return null
  const prior = d.prior_period as Record<string, unknown> | null | undefined
  return {
    from: d.window_start ? etDate(String(d.window_start)) : null,
    to: d.window_end ? etDate(String(d.window_end)) : null,
    people_joined: d.member_count,
    headcount: d.headcount ?? null,
    participation_pct: round(d.participation_pct),
    trips: d.trips_this_period,
    trips_on_foot_bike_transit_or_carpool: d.active_trips_this_period,
    shift_rate_pct: round(d.shift_rate_trip_pct),
    drive_alone_share_pct: round(d.drive_alone_share_pct),
    trips_by_mode: d.mode_breakdown,
    miles_by_mode: d.miles_by_mode ?? null,
    active_miles: round(d.active_miles),
    co2_avoided_kg: round(d.co2_avoided_kg_v2 ?? d.co2_avoided_kg, 0),
    emissions_shifted_pct: round(d.emissions_shifted_pct),
    how_co2_is_counted: (d.co2 as { method?: string } | undefined)?.method ?? null,
    week_by_week: d.weekly_shift_rates ?? null,
    previous_period: prior
      ? {
          from: etDate(String(prior.window_start)),
          to: etDate(String(prior.window_end)),
          people_joined: prior.member_count,
          trips: prior.trips,
          trips_on_foot_bike_transit_or_carpool: prior.active_trips,
          shift_rate_pct: round(prior.shift_rate_trip_pct),
          co2_avoided_kg: round(prior.co2_avoided_kg_v2, 0),
        }
      : null,
  }
}

export async function runResultsRead(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult | null> {
  if (!(name in RESULTS_ACTIVITY)) return null
  switch (name) {
    case 'get_results': {
      const custom = isYmd(input.start_date) && isYmd(input.end_date)
      let params: Record<string, unknown>
      let days: number
      if (custom) {
        const start = etMidnight(String(input.start_date))
        const end = new Date(etMidnight(String(input.end_date)).getTime() + 86_400_000 - 1)
        if (end <= start) return { content: { error: 'end_date must be on or after start_date' }, isError: true }
        days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000))
        params = { p_group_id: ctx.groupId, p_days: days, p_starts_at: start.toISOString(), p_ends_at: end.toISOString() }
      } else {
        days = [7, 30, 90, 365].includes(Number(input.days)) ? Number(input.days) : 30
        params = { p_group_id: ctx.groupId, p_days: days }
      }
      const [dash, bench, locs, members, advisor] = await Promise.all([
        ctx.user.rpc('get_employer_dashboard_data', params),
        ctx.user.rpc('get_employer_peer_benchmark', { p_group_id: ctx.groupId, p_days: days }),
        ctx.user.rpc('get_employer_location_breakdown', { p_group_id: ctx.groupId, p_days: days }),
        // Per-person totals only come as rolling windows (as on the Employees page).
        custom ? Promise.resolve({ data: null }) : ctx.user.rpc('get_employer_members', { p_group_id: ctx.groupId, p_days: days }),
        ctx.user.rpc('get_advisor_usage', { p_group_id: ctx.groupId, p_days: Math.min(days, 365) }),
      ])
      if (dash.error) return { content: { error: dash.error.message }, isError: true }
      const people = (members.data ?? []) as { display_name: string | null; active_trips_in_period: number; trips_in_period: number }[]
      const active = people.filter((p) => (p.trips_in_period ?? 0) > 0)
      return {
        content: {
          period: custom ? `${input.start_date} to ${input.end_date}` : `last ${days} days`,
          results: summarize(dash.data as Record<string, unknown>),
          people_who_logged_a_trip: custom ? null : active.length,
          most_active: custom
            ? 'Per-person totals are only for the last 7, 30, 90 or 365 days.'
            : [...active]
                .sort((a, b) => (b.active_trips_in_period ?? 0) - (a.active_trips_in_period ?? 0))
                .slice(0, 10)
                .map((p) => ({ name: p.display_name, trips_on_foot_bike_transit_or_carpool: p.active_trips_in_period, all_trips: p.trips_in_period })),
          compared_with_similar_workplaces: bench.data ?? null,
          by_office: locs.data ?? null,
          commute_advisor: advisor.data ?? null,
          notes:
            'Shift rate = share of recorded trips on foot, by bike, scooter, transit or carpool. Offices with fewer than 5 people are folded into "everyone else". Individual trips are private.',
        },
        link: { href: '/shift/employers/portal/impact', label: 'Open the Impact page' },
      }
    }
    case 'get_challenge_results': {
      const id = String(input.competition_id ?? '')
      const { data: c } = await ctx.admin
        .from('competitions')
        .select('id, name, starts_at, ends_at')
        .eq('id', id)
        .eq('group_id', ctx.groupId)
        .maybeSingle()
      if (!c) return { content: { error: 'challenge not found on this account' }, isError: true }
      const comp = c as { id: string; name: string; starts_at: string; ends_at: string }
      const now = Date.now()
      const started = new Date(comp.starts_at).getTime() <= now
      const ended = new Date(comp.ends_at).getTime() < now
      const windowEnd = new Date(Math.min(new Date(comp.ends_at).getTime(), now))
      const days = Math.max(1, Math.ceil((windowEnd.getTime() - new Date(comp.starts_at).getTime()) / 86_400_000))
      const [standings, dash, progress, recap] = await Promise.all([
        ctx.user.rpc('get_competition_standings', { p_competition_id: comp.id }),
        started
          ? ctx.user.rpc('get_employer_dashboard_data', { p_group_id: ctx.groupId, p_days: days, p_starts_at: comp.starts_at, p_ends_at: windowEnd.toISOString() })
          : Promise.resolve({ data: null }),
        ctx.user.rpc('get_challenge_admin_progress', { p_competition_id: comp.id }),
        ended ? ctx.user.rpc('get_challenge_awards_recap', { p_competition_id: comp.id }) : Promise.resolve({ data: null }),
      ])
      const rows = (standings.data ?? []) as { display_name: string; total_trips: number; non_car_trips: number }[]
      const counted = rows.filter((r) => r.non_car_trips > 0)
      return {
        content: {
          challenge: comp.name,
          dates: `${etDate(comp.starts_at)} to ${etDate(comp.ends_at)}`,
          state: !started ? 'not started yet' : ended ? 'ended' : 'running',
          joined: rows.length,
          logged_a_counting_trip: counted.length,
          counting_trips_total: counted.reduce((n, r) => n + r.non_car_trips, 0),
          standings: rows.slice(0, 15).map((r, i) => ({ place: i + 1, name: r.display_name, counting_trips: r.non_car_trips })),
          standings_note: 'Names as the app leaderboard shows them (people who keep their profile private show as "Shift user"). Trips that count under this challenge\'s rules.',
          workplace_totals_over_these_dates: summarize(dash.data as Record<string, unknown> | null),
          goal_rewards: progress.data ?? null,
          awards: recap.data ?? null,
        },
        link: { href: '/shift/employers/portal/challenges', label: 'Open Challenges' },
      }
    }
    case 'get_survey_results': {
      const { data: s } = await ctx.admin.from('employer_surveys').select('id').eq('id', String(input.survey_id ?? '')).eq('group_id', ctx.groupId).maybeSingle()
      if (!s) return { content: { error: 'survey not found on this account' }, isError: true }
      const built = await buildSurveyExport(String(input.survey_id), String(input.format) as RuleSet)
      if (!built) return { content: { error: 'no results yet' }, isError: true }
      return {
        content: {
          survey: built.survey.title,
          status: built.survey.status,
          answers: built.rows.length,
          summary: built.doc.sections.map((sec) => ({ heading: sec.heading, note: sec.note ?? null, rows: sec.rows ?? null, text: sec.paragraphs ?? null })),
          note: 'Totals only; individual answers stay with GSI.',
        },
      }
    }
  }
  return null
}
