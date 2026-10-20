// The setup assistant runs the yearly commute survey (Keith 2026-10-20),
// through the same steps as the portal's Survey page (Shift 01170, 01172):
// a draft survey is free to set up; the staff list, opening it (emails go
// out in the admin's name), reminders, closing and deleting wait for an
// approval card. Only when GSI has switched the survey on for the workplace.

import type Anthropic from '@anthropic-ai/sdk'
import { RULE_SET_HELP, RULE_SET_LABEL, type RuleSet } from '@/lib/employer/survey-instrument'
import { massdepBand } from '@/lib/employer/survey-exports'
import type { ApprovalCard, ToolCtx, ToolResult } from './tools'

const SURVEY_LINK_BASE = 'https://www.gogreenstreets.org/survey'
const REASONS: Record<string, string> = {
  forbidden: 'Only an admin or manager can do that.',
  not_enabled: 'The commute survey is not switched on for this workplace yet; GSI turns it on.',
  bad_rule_set: 'Pick at least one filing.',
  week_start_not_monday: 'The survey week has to start on a Monday.',
  closes_before_friday: 'The survey has to stay open at least through the Friday of survey week.',
  week_taken: 'There is already a survey for that week.',
  week_locked: 'People have answered about this week, so the week cannot change now.',
  closed: 'This survey is closed.',
  in_use: 'People have already been emailed or have answered, so it cannot go back to a draft.',
  has_responses: 'This survey has answers, so it cannot be deleted; close it instead.',
  too_many: 'That is more than 2,000 people in one go; split the list.',
}
const shortDate = (ymd: string) => new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export const SURVEY_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_survey_overview',
    description:
      'The commute survey: whether it is on for this workplace, the filings it can produce (MassDEP Rideshare, Cambridge PTDM, Boston TAPA, emissions only) and what each requires, every survey with its dates and status, and for each how many are on the list, how many answered and the response rate against the filing rules. Call before any survey work.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'save_survey_draft',
    description:
      'Create or change a draft survey (no one is emailed until it opens). week_start is the Monday of survey week; closes_on is at least that Friday (two weeks is typical). filings: any of massdep, cambridge, boston, emissions. headcount: total staff it covers; departments optional.',
    input_schema: {
      type: 'object',
      properties: {
        survey_id: { type: ['string', 'null'], description: 'Omit to create a new one.' },
        title: { type: ['string', 'null'] },
        filings: { type: 'array', items: { type: 'string', enum: ['massdep', 'cambridge', 'boston', 'emissions'] }, minItems: 1 },
        week_start: { type: 'string', description: 'YYYY-MM-DD, a Monday' },
        closes_on: { type: 'string', description: 'YYYY-MM-DD' },
        headcount: { type: ['integer', 'null'] },
        departments: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, headcount: { type: ['integer', 'null'] } }, required: ['name'] } },
      },
      required: ['filings', 'week_start', 'closes_on'],
    },
  },
  {
    name: 'add_survey_people',
    description:
      "Add staff to a survey's list (email required; name, department and site optional, site by the office name). Each person gets their own link by email when the survey opens, or within the hour if it is open. Paste-ins of up to 2,000. Needs approval.",
    input_schema: {
      type: 'object',
      properties: {
        survey_id: { type: 'string' },
        people: {
          type: 'array',
          maxItems: 2000,
          items: {
            type: 'object',
            properties: { email: { type: 'string' }, name: { type: 'string' }, department: { type: 'string' }, site: { type: 'string' } },
            required: ['email'],
          },
        },
      },
      required: ['survey_id', 'people'],
    },
  },
  {
    name: 'open_survey',
    description: 'Open a survey: everyone on the list gets their link by email within the hour, in the admin\'s name, with one reminder three days later. Needs approval.',
    input_schema: { type: 'object', properties: { survey_id: { type: 'string' } }, required: ['survey_id'] },
  },
  {
    name: 'send_survey_reminders',
    description: 'Send links to anyone not yet emailed, and the one reminder to people who have not answered after three days, now instead of on the hourly run. Needs approval.',
    input_schema: { type: 'object', properties: { survey_id: { type: 'string' } }, required: ['survey_id'] },
  },
  {
    name: 'close_survey',
    description: 'Close a survey: answers stop and no more reminders go out (it can be reopened). Needs approval.',
    input_schema: { type: 'object', properties: { survey_id: { type: 'string' } }, required: ['survey_id'] },
  },
  {
    name: 'delete_survey',
    description: 'Delete a survey and its staff list; only before anyone has answered. Needs approval.',
    input_schema: { type: 'object', properties: { survey_id: { type: 'string' } }, required: ['survey_id'] },
  },
  {
    name: 'get_survey_report',
    description: "A link to the survey's summary: variant 'filing' (the page for the filing) or 'leadership' (one page for leadership). format is the filing: massdep, cambridge, boston or emissions.",
    input_schema: {
      type: 'object',
      properties: {
        survey_id: { type: 'string' },
        format: { type: 'string', enum: ['massdep', 'cambridge', 'boston', 'emissions'] },
        variant: { type: 'string', enum: ['filing', 'leadership'] },
      },
      required: ['survey_id', 'format', 'variant'],
    },
  },
]

export const SURVEY_NEEDS_APPROVAL = ['add_survey_people', 'open_survey', 'send_survey_reminders', 'close_survey', 'delete_survey']

export const SURVEY_ACTIVITY: Record<string, string> = {
  get_survey_overview: 'Looking at your commute survey',
  save_survey_draft: 'Saving the survey draft',
  add_survey_people: 'Adding people to the survey',
  open_survey: 'Opening the survey',
  send_survey_reminders: 'Sending survey emails',
  close_survey: 'Closing the survey',
  delete_survey: 'Deleting the survey',
  get_survey_report: 'Getting the summary',
}

type SurveyRowLite = { id: string; title: string; rule_set: RuleSet; rule_sets: RuleSet[] | null; week_start: string; closes_on: string; status: string; headcount: number | null; open_token: string }

async function enabled(ctx: ToolCtx) {
  const { data } = await ctx.admin.from('groups').select('commute_survey_enabled').eq('id', ctx.groupId).maybeSingle()
  return !!(data as { commute_survey_enabled?: boolean } | null)?.commute_survey_enabled
}

async function survey(ctx: ToolCtx, id: string): Promise<SurveyRowLite | null> {
  const { data } = await ctx.admin
    .from('employer_surveys')
    .select('id, title, rule_set, rule_sets, week_start, closes_on, status, headcount, open_token')
    .eq('id', id)
    .eq('group_id', ctx.groupId)
    .maybeSingle()
  return (data as SurveyRowLite | null) ?? null
}

async function status(ctx: ToolCtx, id: string) {
  const { data } = await ctx.user.rpc('get_employer_survey_status', { p_survey_id: id })
  return data as {
    ok?: boolean
    invited?: number
    responded_total?: number
    responded_app?: number
    applicable?: number
    by_site?: { name: string; headcount: number | null; invited: number; responded: number | null }[]
    people?: { status: string; responded: boolean }[]
  } | null
}

const filingsOf = (s: SurveyRowLite) => (s.rule_sets && s.rule_sets.length ? s.rule_sets : [s.rule_set])

export async function runSurveyRead(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult | null> {
  if (!(name in SURVEY_ACTIVITY) || SURVEY_NEEDS_APPROVAL.includes(name)) return null
  if (!(await enabled(ctx))) {
    return { content: { enabled: false, note: 'The commute survey is not switched on for this workplace. GSI turns it on; offer ask_gsi.' } }
  }
  switch (name) {
    case 'get_survey_overview': {
      const { data } = await ctx.admin
        .from('employer_surveys')
        .select('id, title, rule_set, rule_sets, week_start, closes_on, status, headcount, open_token')
        .eq('group_id', ctx.groupId)
        .order('week_start', { ascending: false })
        .limit(5)
      const rows = (data ?? []) as SurveyRowLite[]
      const surveys = await Promise.all(
        rows.map(async (s) => {
          const st = await status(ctx, s.id)
          const people = st?.people ?? []
          const responded = st?.responded_total ?? 0
          // As the Survey page measures it: answers against the headcount
          // counted at setup, capped at 100%.
          const rate = s.headcount ? Math.min(100, Math.round((responded / s.headcount) * 1000) / 10) : null
          return {
            survey_id: s.id,
            title: s.title,
            filings: filingsOf(s).map((f) => RULE_SET_LABEL[f]),
            survey_week: `${s.week_start} (Monday)`,
            closes_on: s.closes_on,
            status: s.status,
            headcount: s.headcount,
            on_the_list: st?.invited ?? 0,
            not_emailed_yet: people.filter((p) => p.status === 'pending').length,
            answered: responded,
            answered_in_the_app: st?.responded_app ?? 0,
            counted_for_massdep: st?.applicable ?? null,
            response_rate_pct_of_headcount: rate,
            rate_note: s.headcount ? null : 'No headcount set, so there is no response rate yet; add it to the draft or on the Survey page.',
            massdep_form: filingsOf(s).includes('massdep') && rate != null ? massdepBand(rate).form : null,
            by_site: (st?.by_site ?? []).map((x) => ({ site: x.name, invited: x.invited, answered: x.responded })),
            open_link_for_staff: `${SURVEY_LINK_BASE}/${s.open_token}`,
          }
        }),
      )
      return {
        content: {
          enabled: true,
          filings: Object.fromEntries((Object.keys(RULE_SET_LABEL) as RuleSet[]).map((k) => [k, { name: RULE_SET_LABEL[k], what_it_is: RULE_SET_HELP[k] }])),
          surveys,
          how_it_works:
            'Set up a draft (filings, survey week Monday to Friday, closing date, headcount), add the staff list, then open it: everyone gets their own link by email in your name, with one reminder three days later. Staff who already use Shift can answer in the app. There is also an open link anyone can use. Close it when the window ends and take the summary for the filing. MassDEP needs at least half of applicable commuters (regular daytime commuters) to answer; 75% and 90% get shorter forms. Individual answers stay with GSI; the employer sees totals.',
        },
        link: { href: '/shift/employers/portal/survey', label: 'Open the Survey page' },
      }
    }
    case 'save_survey_draft': {
      const existing = input.survey_id ? await survey(ctx, String(input.survey_id)) : null
      if (input.survey_id && !existing) return { content: { error: 'survey not found on this account' }, isError: true }
      if (existing && existing.status !== 'draft') return { content: { error: 'That survey is already open or closed; change it on the Survey page.' }, isError: true }
      const filings = ((input.filings as string[]) ?? []).filter((f) => f in RULE_SET_LABEL)
      const { data, error } = await ctx.user.rpc('save_employer_survey', {
        p_group_id: ctx.groupId,
        p_id: existing?.id ?? null,
        p_title: (input.title as string | null) ?? null,
        p_rule_set: filings[0] ?? 'massdep',
        p_rule_sets: filings,
        p_week_start: input.week_start,
        p_closes_on: input.closes_on,
        p_headcount: (input.headcount as number | null) ?? null,
        p_site_headcounts: {},
        p_departments: ((input.departments as { name: string; headcount?: number | null }[]) ?? []).filter((d) => d.name?.trim()),
      })
      const res = data as { ok?: boolean; reason?: string; id?: string } | null
      if (error || !res?.ok) return { content: { saved: false, reason: res?.reason, message: REASONS[res?.reason ?? ''] ?? error?.message ?? 'not saved' }, isError: true }
      return {
        content: { saved: true, survey_id: res.id, status: 'draft', note: 'No one is emailed until it opens.' },
        link: { href: '/shift/employers/portal/survey', label: 'See it on the Survey page' },
      }
    }
    case 'get_survey_report': {
      const s = await survey(ctx, String(input.survey_id ?? ''))
      if (!s) return { content: { error: 'survey not found on this account' }, isError: true }
      try {
        const res = await fetch(`${ctx.origin}/api/employer/survey/report-link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
          body: JSON.stringify({ surveyId: s.id, format: input.format, variant: input.variant }),
        })
        const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
        if (!res.ok || !j.url) return { content: { error: j.error ?? 'could not make the report link' }, isError: true }
        return {
          content: { ready: true },
          link: { href: j.url, label: input.variant === 'leadership' ? 'Open the leadership summary' : `Open the ${RULE_SET_LABEL[input.format as RuleSet]} summary`, external: true },
        }
      } catch {
        return { content: { error: 'could not reach the report service' }, isError: true }
      }
    }
    default:
      return null
  }
}

export async function surveyApprovalCard(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<{ card: ApprovalCard } | { result: ToolResult } | null> {
  if (!SURVEY_NEEDS_APPROVAL.includes(name)) return null
  const fail = (message: string) => ({ result: { content: { error: message }, isError: true } as ToolResult })
  if (!(await enabled(ctx))) return fail('The commute survey is not switched on for this workplace; GSI turns it on.')
  const s = await survey(ctx, String(input.survey_id ?? ''))
  if (!s) return fail('survey not found on this account')
  const label = /week of/i.test(s.title) ? `${s.title}, closes ${shortDate(s.closes_on)}` : `${s.title} (survey week of ${shortDate(s.week_start)})`
  const st = await status(ctx, s.id)
  const people = st?.people ?? []
  switch (name) {
    case 'add_survey_people': {
      const raw = (input.people as { email?: string; name?: string; department?: string; site?: string }[]) ?? []
      const valid = raw
        .map((p) => ({ ...p, email: String(p.email ?? '').trim().toLowerCase() }))
        .filter((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email))
      if (!valid.length) return fail('no valid email addresses')
      input.people = valid
      const shown = valid.slice(0, 6).map((p) => (p.name ? `${p.name} <${p.email}>` : p.email)).join(', ')
      return {
        card: {
          title: `Add ${valid.length} ${valid.length === 1 ? 'person' : 'people'} to the survey list?`,
          lines: [
            label,
            shown + (valid.length > 6 ? `, and ${valid.length - 6} more` : ''),
            s.status === 'open' ? 'The survey is open, so their links go out by email within the hour, in your name.' : 'Nobody is emailed until you open the survey.',
          ],
          cta: `Add ${valid.length}`,
          tone: 'primary',
        },
      }
    }
    case 'open_survey': {
      if (s.status === 'open') return fail('it is already open')
      const pending = people.filter((p) => p.status === 'pending').length
      return {
        card: {
          title: `Open "${s.title}"?`,
          lines: [
            `Survey week: ${shortDate(s.week_start)}. Closes ${shortDate(s.closes_on)}.`,
            pending > 0
              ? `${pending} ${pending === 1 ? 'person gets' : 'people get'} their own link by email within the hour, in your name, and one reminder three days later if they haven't answered.`
              : 'No one is on the list yet, so no emails go out; the open link and the app still take answers.',
            'Answers are accepted from now on.',
          ],
          cta: pending > 0 ? 'Open and send' : 'Open',
          tone: 'primary',
        },
      }
    }
    case 'send_survey_reminders': {
      if (s.status !== 'open') return fail('the survey is not open')
      const pending = people.filter((p) => p.status === 'pending').length
      const waiting = people.filter((p) => !p.responded && (p.status === 'sent' || p.status === 'reminded')).length
      return {
        card: {
          title: 'Send survey emails now?',
          lines: [
            label,
            `${pending} not emailed yet get their link; of ${waiting} who haven't answered, those emailed at least three days ago and not yet reminded get the one reminder.`,
          ],
          cta: 'Send now',
          tone: 'primary',
        },
      }
    }
    case 'close_survey':
      if (s.status !== 'open') return fail('the survey is not open')
      return { card: { title: `Close "${s.title}"?`, lines: [`${st?.responded_total ?? 0} answered so far.`, 'Answers stop and no more reminders go out. You can reopen it.'], cta: 'Close it', tone: 'primary' } }
    case 'delete_survey':
      return { card: { title: `Delete "${s.title}"?`, lines: ['The staff list goes with it. Only possible before anyone has answered.', "This can't be undone."], confirmText: s.title, cta: 'Delete', tone: 'danger' } }
    default:
      return null
  }
}

export async function runSurveyApproved(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult | null> {
  if (!SURVEY_NEEDS_APPROVAL.includes(name)) return null
  const rpcResult = async (fn: string, args: Record<string, unknown>, ok: Record<string, unknown>) => {
    const { data, error } = await ctx.user.rpc(fn, args)
    const res = data as { ok?: boolean; reason?: string } & Record<string, unknown> | null
    if (error || !res?.ok) return { content: { done: false, reason: res?.reason, message: REASONS[res?.reason ?? ''] ?? error?.message ?? 'did not go through' }, isError: true } as ToolResult
    return { content: { done: true, ...ok, ...res }, link: { href: '/shift/employers/portal/survey', label: 'See it on the Survey page' } } as ToolResult
  }
  switch (name) {
    case 'add_survey_people': {
      const { data: locs } = await ctx.admin.from('employer_locations').select('id, name, address').eq('group_id', ctx.groupId)
      const sites = (locs ?? []) as { id: string; name: string | null; address: string }[]
      const findSite = (x?: string) => {
        if (!x?.trim()) return undefined
        const t = x.trim().toLowerCase()
        return sites.find((l) => (l.name ?? '').toLowerCase() === t || l.address.toLowerCase().startsWith(t))?.id
      }
      const rows = ((input.people as { email: string; name?: string; department?: string; site?: string }[]) ?? []).map((p) => {
        const row: Record<string, string> = { email: p.email }
        if (p.name?.trim()) row.name = p.name.trim().slice(0, 120)
        if (p.department?.trim()) row.department = p.department.trim().slice(0, 80)
        const loc = findSite(p.site)
        if (loc) row.location_id = loc
        return row
      })
      return rpcResult('add_employer_survey_recipients', { p_survey_id: input.survey_id, p_rows: rows }, {})
    }
    case 'open_survey':
      return rpcResult('set_employer_survey_status', { p_id: input.survey_id, p_status: 'open' }, { opened: true, note: 'Links go out within the hour.' })
    case 'close_survey':
      return rpcResult('set_employer_survey_status', { p_id: input.survey_id, p_status: 'closed' }, { closed: true })
    case 'delete_survey':
      return rpcResult('delete_employer_survey', { p_id: input.survey_id }, { deleted: true })
    case 'send_survey_reminders': {
      try {
        const res = await fetch(`${ctx.origin}/api/employer/survey`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
          body: JSON.stringify({ survey_id: input.survey_id }),
        })
        const j = (await res.json().catch(() => ({}))) as { queued?: boolean; invites?: number; reminders?: number }
        if (!res.ok) return { content: { sent: false, note: 'The hourly run will pick these up.' }, isError: true }
        return { content: j.queued ? { sent: false, queued: true, note: 'Queued; emails go out within the hour.' } : { sent: true, invites: j.invites ?? 0, reminders: j.reminders ?? 0 } }
      } catch {
        return { content: { sent: false, note: 'The hourly run will pick these up.' }, isError: true }
      }
    }
    default:
      return null
  }
}
