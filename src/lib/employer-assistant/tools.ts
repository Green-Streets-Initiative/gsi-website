// What the setup assistant can read and do (Keith 2026-10-20). Every write
// runs as the signed-in admin (their own sign-in token, so their role and the
// database's checks apply: it can do what they could, nothing more). Reads
// use the service client scoped to the workplace the route has already
// checked they belong to.
//
// Tools in NEEDS_APPROVAL never run when the model asks: the route shows the
// admin a card the server writes (approvalCard) and runs the tool only when
// they click Approve, with the inputs and dollar amount on that card.

import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { SURVEY_ACTIVITY, SURVEY_NEEDS_APPROVAL, SURVEY_TOOLS, runSurveyApproved, runSurveyRead, surveyApprovalCard } from './survey-tools'
import { RESULTS_ACTIVITY, RESULTS_TOOLS, runResultsRead } from './results-tools'
import { ADMIN_ACTIVITY, ADMIN_NEEDS_APPROVAL, ADMIN_ONLY, ADMIN_TOOLS, adminApprovalCard, runAdminApproved, runAdminRead } from './admin-tools'

export type ToolCtx = {
  user: SupabaseClient
  admin: SupabaseClient
  token: string
  groupId: string
  groupName: string
  email: string
  userId: string
  role: 'admin' | 'manager' | 'viewer' | 'gsi'
  threadId: string
  origin: string
}

export type ToolResult = {
  /** What the model sees. */
  content: Record<string, unknown>
  isError?: boolean
  /** Shown in the conversation as a button (payment page, a portal page). */
  link?: { href: string; label: string; external?: boolean }
  /** Shown as tap-to-answer buttons. */
  choices?: { question?: string; options: string[] }
}

export type ApprovalCard = {
  title: string
  lines: string[]
  /** The pre-flight checklist and money, for launches. */
  check?: unknown
  confirmCents?: number
  /** An image to look at before approving (a logo). */
  image?: string
  /** Where the looked-up place is, to check it. */
  mapUrl?: string
  /** Irreversible: the admin types this (a name) to confirm. */
  confirmText?: string
  cta: string
  tone: 'primary' | 'danger'
}

const DAY = 86_400_000

const challengeSchema = {
  type: 'object',
  description: 'The whole challenge. Dates are YYYY-MM-DD, Eastern time days.',
  properties: {
    name: { type: 'string' },
    starts_on: { type: 'string', description: 'YYYY-MM-DD' },
    ends_on: { type: 'string', description: 'YYYY-MM-DD; same as starts_on for a one-day challenge' },
    counting_rules: {
      type: ['object', 'null'],
      description:
        'null = the Shift standard (walks of half a mile or more, bike and e-scooter rides, transit, carpools, up to 2 trips a day). To count only trips to or from the office: {"commute_only": true, "offices": [{"address": "...", "lat": 0, "lng": 0, "radius_m": 250}]} using a saved location. To narrow the ways: {"modes": ["walk","bike","escooter","transit_bus","transit_train","transit_commuter_rail","ferry","carpool"]}.',
    },
    description: { type: ['string', 'null'], description: 'One or two sentences staff see with the challenge.' },
    contact_name: { type: ['string', 'null'] },
    contact_email: { type: ['string', 'null'], description: 'Required when there is a first-to-the-goal reward.' },
    template_slug: { type: ['string', 'null'] },
    template_run_id: { type: ['string', 'null'] },
    prizes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: ['string', 'null'], description: 'Only when changing an existing reward on a live challenge.' },
          name: { type: 'string', description: 'Short, e.g. "First to 12 trips", "Monthly drawing", "Top commuters".' },
          award_mode: { type: 'string', enum: ['guaranteed', 'drawing', 'merit'], description: 'guaranteed = first N to reach the goal; drawing = random among those who reach a minimum; merit = top of the leaderboard.' },
          metric: { type: 'string', enum: ['trips', 'active_days', 'miles', 'pct_non_car'], description: 'Use "trips" unless asked otherwise. guaranteed is always trips.' },
          min_threshold: { type: ['number', 'null'], description: 'The trip goal (guaranteed, drawing). Whole number.' },
          winner_count: { type: 'integer', description: 'Spots or winners, 1 to 1000.' },
          funded_from_pool: { type: 'boolean', description: 'true = gift card paid from the rewards balance; false = the employer hands out its own prize.' },
          amount_cents: { type: ['integer', 'null'], description: 'Gift card value in cents, at least 500.' },
          budget_cap_cents: { type: ['integer', 'null'] },
          prize_description: { type: ['string', 'null'], description: 'What winners get, when funded_from_pool is false.' },
          auto_draw: { type: 'boolean' },
          requires_work_email: { type: 'boolean', description: 'Only people who confirm a work email at the company domain can win (guaranteed only).' },
        },
        required: ['name', 'award_mode', 'winner_count', 'funded_from_pool'],
      },
    },
  },
  required: ['name', 'starts_on', 'ends_on', 'prizes'],
} as const

const BASE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_account_overview',
    description:
      "Everything about this workplace's Shift program right now: plan, your role, setup checklist, employees and invitations, email domains, offices, rewards balance, challenges and drafts, year plan, and upcoming dates worth building a challenge around. Call this first, and again after changes.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_seasonal_templates',
    description: "GSI's seasonal challenge templates (name, pitch, suggested rules and prize, tips) with their upcoming dates. Good starting points for a first challenge.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_challenge',
    description: 'One existing challenge in full (the shape save_challenge_changes takes), with its rewards and how they are going.',
    input_schema: { type: 'object', properties: { competition_id: { type: 'string' } }, required: ['competition_id'] },
  },
  {
    name: 'get_draft',
    description: 'One draft challenge as currently saved (someone may have changed it in the builder), with its version.',
    input_schema: { type: 'object', properties: { draft_id: { type: 'string' } }, required: ['draft_id'] },
  },
  {
    name: 'save_challenge_draft',
    description:
      'Create or update a draft challenge. Drafts are invisible to employees, so no approval is needed; save early and keep it updated as the admin answers. Returns the draft id, its version and the pre-flight check. Pass the version you last saw; if someone else changed it, you get theirs back to merge.',
    input_schema: {
      type: 'object',
      properties: {
        draft_id: { type: ['string', 'null'], description: 'Omit or null to create a new draft.' },
        expected_version: { type: ['integer', 'null'] },
        challenge: challengeSchema,
      },
      required: ['challenge'],
    },
  },
  {
    name: 'check_challenge',
    description: "The pre-flight check: what still needs fixing, notes worth knowing, and the money (set aside now, paid at the draw, available, short by). Writes nothing.",
    input_schema: {
      type: 'object',
      properties: {
        draft_id: { type: ['string', 'null'] },
        competition_id: { type: ['string', 'null'], description: 'Checking changes to an existing challenge.' },
        challenge: { ...challengeSchema, type: ['object', 'null'] },
      },
    },
  },
  {
    name: 'launch_challenge',
    description: 'Launch a draft so the team sees it in the Shift app. Needs the admin to approve. Only call when check_challenge passes.',
    input_schema: { type: 'object', properties: { draft_id: { type: 'string' } }, required: ['draft_id'] },
  },
  {
    name: 'fund_and_launch',
    description:
      "When the only thing stopping a launch is the rewards balance: give the admin a button to Stripe's secure page for exactly the missing amount ($25 at least). They enter and confirm the payment there themselves (card or bank transfer); the challenge launches when the money arrives. You never charge anything. Admins only.",
    input_schema: { type: 'object', properties: { draft_id: { type: 'string' } }, required: ['draft_id'] },
  },
  {
    name: 'save_challenge_changes',
    description: 'Change an existing (launched) challenge. Pass the whole challenge as get_challenge returned it, with your changes. Needs approval.',
    input_schema: {
      type: 'object',
      properties: { competition_id: { type: 'string' }, challenge: challengeSchema },
      required: ['competition_id', 'challenge'],
    },
  },
  {
    name: 'discard_draft',
    description: 'Delete a draft, or skip a year-plan suggestion (it won\'t come back; the rest of the plan is unchanged). Needs approval.',
    input_schema: { type: 'object', properties: { draft_id: { type: 'string' } }, required: ['draft_id'] },
  },
  {
    name: 'invite_employees',
    description: 'Email Shift invitations to employees on the workplace\'s behalf (with a reminder a few days later). Needs approval.',
    input_schema: {
      type: 'object',
      properties: { emails: { type: 'array', items: { type: 'string' }, maxItems: 500 } },
      required: ['emails'],
    },
  },
  {
    name: 'set_email_domains',
    description: 'Set the company email domains (e.g. "loomissayles.com"), used to verify who works there. Replaces the list. Needs approval. Admins only.',
    input_schema: {
      type: 'object',
      properties: { domains: { type: 'array', items: { type: 'string' }, maxItems: 10 } },
      required: ['domains'],
    },
  },
  {
    name: 'set_join_policy',
    description: 'Who can join the workplace in the app: "open" (anyone with the code or link), "work_email" (only people who confirm a company email), "approval" (an admin approves each request). Needs approval. Admins only.',
    input_schema: {
      type: 'object',
      properties: { policy: { type: 'string', enum: ['open', 'work_email', 'approval'] } },
      required: ['policy'],
    },
  },
  {
    name: 'set_year_plan',
    description: "Turn the year plan on or off: GSI drafts each seasonal challenge about three weeks ahead; nothing starts until an admin launches it. Needs approval.",
    input_schema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] },
  },
  {
    name: 'ask_gsi',
    description:
      "Send a question to the GSI team (they reply by email) when neither you nor the portal can answer it: pricing, invoices, tax or legal specifics, anything you'd be guessing about. Needs approval.",
    input_schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: "The admin's question, in their words where possible." },
        context: { type: 'string', description: 'What you already know and why you could not answer.' },
      },
      required: ['question'],
    },
  },
  {
    name: 'open_page',
    description: 'Give the admin a button to a portal page, for things you cannot do yourself (billing details, the full team list, anything not covered by your tools).',
    input_schema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: ['dashboard', 'setup', 'employees', 'share-kit', 'challenges', 'impact', 'survey', 'advisor', 'billing', 'settings'],
        },
        label: { type: 'string', description: 'Button text, e.g. "Open the Share Kit".' },
      },
      required: ['page', 'label'],
    },
  },
  {
    name: 'offer_choices',
    description:
      'Ask the admin a question with 2 to 5 short answers they can tap. `message` is your whole reply for this turn: anything you wrote before calling this is not shown, so if you are answering a question or reporting figures, put the answer in `message` first, then the question. Put your recommendation first in options. Then end your turn without further text.',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Your complete reply to the admin (any answer or figures first), ending with the question.' },
        options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 5 },
      },
      required: ['message', 'options'],
    },
  },
]

export const TOOLS: Anthropic.Tool[] = [...BASE_TOOLS, ...RESULTS_TOOLS, ...ADMIN_TOOLS, ...SURVEY_TOOLS]

export const NEEDS_APPROVAL = new Set([
  ...ADMIN_NEEDS_APPROVAL,
  ...SURVEY_NEEDS_APPROVAL,
  'launch_challenge',
  'fund_and_launch',
  'save_challenge_changes',
  'discard_draft',
  'invite_employees',
  'set_email_domains',
  'set_join_policy',
  'set_year_plan',
  'ask_gsi',
])

/** Short "what I'm doing" lines for the conversation. */
export const ACTIVITY: Record<string, string> = {
  ...ADMIN_ACTIVITY,
  ...SURVEY_ACTIVITY,
  ...RESULTS_ACTIVITY,
  get_account_overview: 'Looking over your account',
  list_seasonal_templates: 'Looking at the seasonal challenges',
  get_challenge: 'Reading the challenge',
  get_draft: 'Reading the draft',
  save_challenge_draft: 'Saving the draft',
  check_challenge: 'Running the pre-flight check',
  launch_challenge: 'Launching',
  fund_and_launch: 'Getting the payment page',
  save_challenge_changes: 'Saving the changes',
  discard_draft: 'Removing the draft',
  invite_employees: 'Sending invitations',
  set_email_domains: 'Updating email domains',
  set_join_policy: 'Updating who can join',
  set_year_plan: 'Updating the year plan',
  ask_gsi: 'Sending your question to GSI',
}

// ── Helpers ────────────────────────────────────────────────────────────

const money = (c: number) => (c % 100 === 0 ? `$${(c / 100).toLocaleString('en-US')}` : `$${(c / 100).toFixed(2)}`)
const etToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const etDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
const shortDate = (ymd: string) =>
  new Date(ymd + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

type Body = Record<string, unknown> & { name?: string; starts_on?: string; ends_on?: string; prizes?: Record<string, unknown>[] }

function prizeLine(p: Record<string, unknown>): string {
  const n = Number(p.winner_count ?? 0)
  const goal = p.min_threshold != null ? Number(p.min_threshold) : null
  const own = String(p.prize_description ?? '').trim()
  const reward = p.funded_from_pool && p.amount_cents ? `a ${money(Number(p.amount_cents))} gift card` : own ? own.replace(/^(A|An|The) /, (m) => m.toLowerCase()) : 'a prize you hand out'
  if (p.award_mode === 'guaranteed') return `The first ${n} to log ${goal ?? '?'} trips each win ${reward}`
  if (p.award_mode === 'merit') return `The top ${n} win ${reward}`
  return `${n} ${n === 1 ? 'winner' : 'winners'} drawn from everyone who logs ${goal ?? '?'} trips, each wins ${reward}`
}

function bodyForSave(input: Record<string, unknown>): Body {
  const c = (input.challenge ?? {}) as Body
  return { ...c, v: 1, kind: 'employer', prizes: Array.isArray(c.prizes) ? c.prizes : [] }
}

async function rpc(ctx: ToolCtx, fn: string, args: Record<string, unknown>) {
  const { data, error } = await ctx.user.rpc(fn, args)
  return { data: data as Record<string, unknown> | null, error: error?.message ?? null }
}

async function edgeTopUp(ctx: ToolCtx, payload: Record<string, unknown>) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-top-up-checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
      body: JSON.stringify({ ...payload, origin: ctx.origin }),
    })
    return (await res.json().catch(() => ({}))) as Record<string, unknown>
  } catch {
    return { error: 'The payment service could not be reached.' }
  }
}

async function draftRow(ctx: ToolCtx, draftId: string) {
  const { data } = await ctx.admin
    .from('employer_challenge_drafts')
    .select('id, group_id, status, version, body, source, pending_launch, competition_id')
    .eq('id', draftId)
    .eq('group_id', ctx.groupId)
    .maybeSingle()
  return data as { id: string; status: string; version: number; body: Body | null; source: string; pending_launch: unknown; competition_id: string | null } | null
}

// ── Reads ──────────────────────────────────────────────────────────────

async function accountOverview(ctx: ToolCtx) {
  const a = ctx.admin
  const today = etToday()
  const horizon = new Date(Date.now() + 400 * DAY).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  const [group, members, invites, domains, locations, pool, comps, drafts, yp, obs, wrd, runs] = await Promise.all([
    a.from('groups').select('name, tier, status, access_ends_at, admin_name, admin_phone, website_url, logo_url, invite_code, onboarding, employer_benefits, join_policy').eq('id', ctx.groupId).maybeSingle(),
    a.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', ctx.groupId),
    a.from('employer_invitations').select('status', { count: 'exact' }).eq('group_id', ctx.groupId).is('joined_at', null),
    a.from('employer_email_domains').select('domain').eq('group_id', ctx.groupId),
    a.from('employer_locations').select('id, name, address, sort_order').eq('group_id', ctx.groupId).order('sort_order'),
    a.from('reward_pools').select('balance_cents, held_cents, active').eq('owner_type', 'employer').eq('owner_group_id', ctx.groupId).maybeSingle(),
    a.from('competitions').select('id, name, starts_at, ends_at, counting_rules, employer_challenge_prizes(name, award_mode, min_threshold, winner_count, funded_from_pool, amount_cents, prize_description, published_at, cancelled_at, draw_status)').eq('group_id', ctx.groupId).order('starts_at', { ascending: false }).limit(12),
    a.from('employer_challenge_drafts').select('id, source, status, version, body, updated_at, updated_by_email, pending_launch, run:challenge_template_runs(starts_on, ends_on, template:challenge_templates(title, slug))').eq('group_id', ctx.groupId).eq('status', 'drafted').limit(20),
    a.from('employer_year_plans').select('enabled').eq('group_id', ctx.groupId).maybeSingle(),
    a.from('challenge_observance_dates').select('on_date, observance:challenge_observances!inner(name, active)').eq('observance.active', true).gte('on_date', today).lte('on_date', horizon).order('on_date').limit(30),
    a.from('competitions').select('name, starts_at').eq('series', 'walk_ride_day').eq('is_public', true).gte('starts_at', new Date().toISOString()).order('starts_at').limit(12),
    a.from('challenge_template_runs').select('starts_on, ends_on, template:challenge_templates!inner(title, slug, active)').eq('template.active', true).gte('starts_on', today).lte('starts_on', horizon).order('starts_on').limit(8),
  ])
  const g = group.data as Record<string, unknown> | null
  if (!g) return { error: 'workplace not found' }
  const onboarding = (g.onboarding ?? {}) as Record<string, unknown>
  const benefits = (g.employer_benefits ?? {}) as Record<string, unknown>
  const canRewards = g.tier === 'standard' || g.tier === 'premium'
  const p = pool.data as { balance_cents: number; held_cents: number } | null
  const now = Date.now()
  type CompRow = { id: string; name: string; starts_at: string; ends_at: string; counting_rules: unknown; employer_challenge_prizes: Record<string, unknown>[] }
  const challenges = ((comps.data ?? []) as CompRow[]).map((c) => ({
    id: c.id,
    name: c.name,
    starts_on: etDate(c.starts_at),
    ends_on: etDate(c.ends_at),
    status: now < Date.parse(c.starts_at) ? 'scheduled' : now > Date.parse(c.ends_at) ? 'ended' : 'active',
    rewards: (c.employer_challenge_prizes ?? []).map((pr) => `${prizeLine(pr)}${pr.cancelled_at ? ' (cancelled)' : pr.award_mode === 'guaranteed' && !pr.published_at ? ' (not live)' : ''}`),
  }))
  type DraftRow = { id: string; source: string; version: number; body: Body | null; updated_at: string | null; updated_by_email: string | null; pending_launch: { status?: string } | null; run: { starts_on: string; ends_on: string; template: { title: string; slug: string } | null } | null }
  const draftList = ((drafts.data ?? []) as unknown as DraftRow[]).map((d) => ({
    draft_id: d.id,
    version: d.version,
    kind: d.source === 'year_plan' ? 'year-plan suggestion' : 'draft',
    name: d.body?.name ?? d.run?.template?.title ?? 'Untitled',
    dates: d.body?.starts_on ? `${d.body.starts_on} to ${d.body.ends_on}` : d.run ? `${d.run.starts_on} to ${d.run.ends_on}` : null,
    filled_in: !!d.body,
    last_saved_by: d.updated_by_email,
    payment: d.pending_launch?.status ?? null,
  }))
  const hasChallenge = challenges.some((c) => c.status !== 'ended')
  const advisorDone = !!(benefits.destination_address && Object.entries(benefits).some(([k, v]) => k !== 'destination_address' && !!v))
  return {
    workplace: { name: g.name, plan: g.tier, rewards_included: canRewards, status: g.status, access_ends: g.access_ends_at ?? null, join_code: g.invite_code, join_link: g.invite_code ? `https://shift.gogreenstreets.org/join/${g.invite_code}` : null, join_policy: g.join_policy ?? 'open' },
    you: { email: ctx.email, role: ctx.role, can_add_money: ctx.role === 'admin', can_change_settings: ctx.role === 'admin' || ctx.role === 'gsi' },
    setup_checklist: {
      success_plan: !!(onboarding.goal_type || onboarding.success_definition || onboarding.launch_date),
      company_profile: !!(g.name && g.admin_name && (g.admin_phone || g.website_url)),
      logo: !!g.logo_url,
      commute_advisor: advisorDone,
      employees_joined: (members.count ?? 0) > 0,
      challenge_scheduled: hasChallenge,
    },
    employees: { joined: members.count ?? 0, invited_not_joined: invites.count ?? 0 },
    email_domains: ((domains.data ?? []) as { domain: string }[]).map((d) => d.domain),
    offices: ((locations.data ?? []) as { id: string; name: string | null; address: string; sort_order: number }[]).map((o, i) => ({ location_id: o.id, name: o.name, address: o.address, main: i === 0 })),
    has_logo: !!g.logo_url,
    rewards_balance: canRewards ? { available: money(p ? p.balance_cents - p.held_cents : 0), set_aside_for_live_prizes: money(p?.held_cents ?? 0) } : 'not on this plan',
    challenges,
    drafts: draftList,
    year_plan_on: !!(yp.data as { enabled?: boolean } | null)?.enabled,
    upcoming_dates: [
      ...((wrd.data ?? []) as { name: string; starts_at: string }[]).map((w) => ({ date: etDate(w.starts_at), what: `${w.name} (GSI's monthly statewide day, with drawings)` })),
      ...((obs.data ?? []) as unknown as { on_date: string; observance: { name: string } }[]).map((o) => ({ date: o.on_date, what: o.observance.name })),
    ].sort((x, y) => x.date.localeCompare(y.date)),
    seasonal_challenges_coming: ((runs.data ?? []) as unknown as { starts_on: string; ends_on: string; template: { title: string; slug: string } }[]).map((r) => ({ title: r.template.title, slug: r.template.slug, dates: `${r.starts_on} to ${r.ends_on}` })),
    today,
  }
}

async function seasonalTemplates(ctx: ToolCtx) {
  const today = etToday()
  const { data } = await ctx.admin
    .from('challenge_templates')
    .select('slug, title, season, line, pitch, pairs_with_line, duration_days, counting_rules, prize, tips, challenge_template_runs(id, label, starts_on, ends_on)')
    .eq('active', true)
    .order('sort_order')
  return {
    templates: ((data ?? []) as Record<string, unknown>[]).map((t) => ({
      ...t,
      challenge_template_runs: ((t.challenge_template_runs as { starts_on: string }[]) ?? []).filter((r) => r.starts_on >= today),
    })),
  }
}

async function getChallenge(ctx: ToolCtx, competitionId: string) {
  const { data: c } = await ctx.admin
    .from('competitions')
    .select('id, name, starts_at, ends_at, counting_rules, description, prize_description, contact_name, contact_email, template_slug, template_run_id, group_id, event_type')
    .eq('id', competitionId)
    .eq('group_id', ctx.groupId)
    .maybeSingle()
  if (!c) return { error: 'challenge not found on this account' }
  const { data: prizes } = await ctx.admin
    .from('employer_challenge_prizes')
    .select('id, name, award_mode, metric, min_threshold, winner_count, funded_from_pool, amount_cents, budget_cap_cents, prize_description, auto_draw, requires_work_email, published_at, cancelled_at, closed_at, draw_status, hold_cents')
    .eq('competition_id', competitionId)
    .order('display_order')
  const progress = await rpc(ctx, 'get_challenge_admin_progress', { p_competition_id: competitionId })
  const row = c as Record<string, unknown>
  return {
    competition_id: row.id,
    challenge: {
      name: row.name,
      starts_on: etDate(row.starts_at as string),
      ends_on: etDate(row.ends_at as string),
      counting_rules: row.counting_rules ?? null,
      description: row.description ?? null,
      prize_description: row.prize_description ?? null,
      contact_name: row.contact_name ?? null,
      contact_email: row.contact_email ?? null,
      template_slug: row.template_slug ?? null,
      template_run_id: row.template_run_id ?? null,
      prizes: ((prizes ?? []) as Record<string, unknown>[]).map((p) => ({
        id: p.id, name: p.name, award_mode: p.award_mode, metric: p.metric, min_threshold: p.min_threshold,
        winner_count: p.winner_count, funded_from_pool: p.funded_from_pool, amount_cents: p.amount_cents,
        budget_cap_cents: p.budget_cap_cents, prize_description: p.prize_description, auto_draw: p.auto_draw,
        requires_work_email: p.requires_work_email,
      })),
    },
    reward_status: ((prizes ?? []) as Record<string, unknown>[]).map((p) => ({
      name: p.name, live: !!p.published_at, cancelled: !!p.cancelled_at, closed: !!p.closed_at, draw_status: p.draw_status, money_set_aside: money(Number(p.hold_cents ?? 0)),
    })),
    progress: progress.data ?? null,
  }
}

// ── Running a tool ─────────────────────────────────────────────────────

/** Tools that need no approval run here; approved ones run via runApproved. */
export async function runTool(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_account_overview':
        return { content: await accountOverview(ctx) }
      case 'list_seasonal_templates':
        return { content: await seasonalTemplates(ctx) }
      case 'get_challenge':
        return { content: await getChallenge(ctx, String(input.competition_id ?? '')) }
      case 'get_draft': {
        const d = await draftRow(ctx, String(input.draft_id ?? ''))
        if (!d) return { content: { error: 'draft not found on this account' }, isError: true }
        return { content: { draft_id: d.id, version: d.version, status: d.status, challenge: d.body, payment: d.pending_launch } }
      }
      case 'save_challenge_draft': {
        const body = bodyForSave(input)
        const draftId = (input.draft_id as string | null) ?? null
        const { data, error } = await rpc(ctx, 'save_employer_challenge_draft', {
          p_group_id: ctx.groupId,
          p_body: body,
          p_draft_id: draftId,
          p_version: (input.expected_version as number | null) ?? null,
          p_source: 'assistant',
        })
        if (error || !data) return { content: { error: error ?? 'not saved' }, isError: true }
        if (!data.ok) return { content: data, isError: data.reason !== 'conflict' }
        return {
          content: { ...data, builder_link: `/shift/employers/portal/challenges` },
          link: { href: `/shift/employers/portal/challenges?draft_open=${data.draft_id}`, label: 'Open the draft in the builder' },
        }
      }
      case 'check_challenge': {
        const body = input.challenge ? bodyForSave(input) : null
        const { data, error } = await rpc(ctx, 'check_employer_challenge', {
          p_group_id: ctx.groupId,
          p_body: body,
          p_draft_id: (input.draft_id as string | null) ?? null,
          p_competition_id: (input.competition_id as string | null) ?? null,
        })
        if (error || !data) return { content: { error: error ?? 'check failed' }, isError: true }
        return { content: data }
      }
      case 'open_page':
        return {
          content: { shown: true },
          link: { href: `/shift/employers/portal/${String(input.page ?? 'dashboard')}`, label: String(input.label ?? 'Open') },
        }
      case 'offer_choices':
        return {
          content: { shown: true, note: 'The admin sees your message and these buttons. End your turn now with no more text.' },
          choices: { question: String(input.message ?? ''), options: ((input.options as string[]) ?? []).slice(0, 5) },
        }
      default: {
        if (ADMIN_ONLY.includes(name) && ctx.role !== 'admin' && ctx.role !== 'gsi') {
          return { content: { error: 'only_admins', message: 'Only an admin on this account can do this.' }, isError: true }
        }
        return (await runResultsRead(ctx, name, input)) ?? (await runSurveyRead(ctx, name, input)) ?? (await runAdminRead(ctx, name, input)) ?? { content: { error: `unknown tool ${name}` }, isError: true }
      }
    }
  } catch (e) {
    return { content: { error: e instanceof Error ? e.message : 'tool failed' }, isError: true }
  }
}

/**
 * The card the admin approves, written by the server from the tool's inputs
 * (never the model's words), or a result to hand straight back when the
 * action can't go ahead (the pre-flight check fails, no permission).
 */
export async function approvalCard(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<{ card: ApprovalCard } | { result: ToolResult }> {
  const adminOnly = new Set(['fund_and_launch', 'set_email_domains', 'set_join_policy', ...ADMIN_ONLY])
  if (adminOnly.has(name) && ctx.role !== 'admin' && ctx.role !== 'gsi') {
    return { result: { content: { error: 'only_admins', message: 'Only an admin on this account can do this. Suggest they ask an admin.' }, isError: true } }
  }
  if (ctx.role === 'viewer') {
    return { result: { content: { error: 'viewer', message: 'Viewers can look but not change anything.' }, isError: true } }
  }
  switch (name) {
    case 'launch_challenge':
    case 'fund_and_launch': {
      const d = await draftRow(ctx, String(input.draft_id ?? ''))
      if (!d?.body) return { result: { content: { error: 'draft not found' }, isError: true } }
      const { data: check } = await rpc(ctx, 'check_employer_challenge', { p_group_id: ctx.groupId, p_body: null, p_draft_id: d.id, p_competition_id: null })
      const c = check as { ok: boolean; blockers: { code: string; message: string }[]; money: Record<string, number> } | null
      if (!c) return { result: { content: { error: 'check failed' }, isError: true } }
      const onlyMoney = c.blockers.length > 0 && c.blockers.every((b) => b.code === 'balance_short')
      if (name === 'launch_challenge' && !c.ok) return { result: { content: { error: 'check_failed', check: c }, isError: true } }
      if (name === 'fund_and_launch' && !onlyMoney) return { result: { content: { error: c.ok ? 'not_short' : 'check_failed', check: c }, isError: true } }
      const b = d.body
      const lines = [
        `${b.name} · ${b.starts_on === b.ends_on ? shortDate(b.starts_on!) : `${shortDate(b.starts_on!)} to ${shortDate(b.ends_on!)}`}`,
        ...(b.prizes ?? []).map(prizeLine),
      ]
      if (name === 'launch_challenge') {
        if (c.money.set_aside_now_cents > 0) lines.push(`Sets aside ${money(c.money.set_aside_now_cents)} from your rewards balance now; unused money comes back when it ends.`)
        if (c.money.paid_at_draw_cents > 0) lines.push(`Up to ${money(c.money.paid_at_draw_cents)} is paid from the balance when winners are drawn.`)
        lines.push('Your team sees it in the Shift app right away.')
        return { card: { title: `Launch "${b.name}"?`, lines, check: c, confirmCents: c.money.set_aside_now_cents, cta: 'Launch', tone: 'primary' } }
      }
      // The assistant never moves money (Keith 2026-10-20): it hands the admin
      // Stripe's page for the exact amount, and they pay there themselves.
      lines.push(`Your balance has ${money(c.money.available_cents)} available; this needs ${money(c.money.needed_cents)}.`)
      lines.push(`Opens Stripe's secure page for ${money(c.money.topup_cents)}. You enter and confirm the payment there (card or bank transfer); the challenge launches as soon as the money arrives.`)
      if (c.money.topup_cents > c.money.short_by_cents) lines.push(`Top-ups start at $25, so ${money(c.money.topup_cents - c.money.short_by_cents)} extra stays in your balance.`)
      return {
        card: {
          title: `Get the payment page for ${money(c.money.topup_cents)}?`,
          lines,
          check: c,
          confirmCents: c.money.set_aside_now_cents,
          cta: 'Get the payment page',
          tone: 'primary',
        },
      }
    }
    case 'save_challenge_changes': {
      const body = bodyForSave(input)
      const { data: check } = await rpc(ctx, 'check_employer_challenge', { p_group_id: ctx.groupId, p_body: body, p_draft_id: null, p_competition_id: input.competition_id })
      const c = check as { ok: boolean; money: Record<string, number> } | null
      if (!c?.ok) return { result: { content: { error: 'check_failed', check: c }, isError: true } }
      const before = await getChallenge(ctx, String(input.competition_id))
      const old = (before as { challenge?: Body }).challenge
      const lines: string[] = []
      if (old && old.name !== body.name) lines.push(`Name: "${old.name}" → "${body.name}"`)
      if (old && (old.starts_on !== body.starts_on || old.ends_on !== body.ends_on))
        lines.push(`Dates: ${shortDate(old.starts_on!)} to ${shortDate(old.ends_on!)} → ${shortDate(body.starts_on!)} to ${shortDate(body.ends_on!)}`)
      if (old && JSON.stringify(old.counting_rules ?? null) !== JSON.stringify(body.counting_rules ?? null)) lines.push('Which trips count changes.')
      for (const p of body.prizes ?? []) lines.push(prizeLine(p))
      if (c.money.set_aside_now_cents > 0) lines.push(`Sets aside ${money(c.money.set_aside_now_cents)} more from your rewards balance.`)
      lines.push('Your team sees the changes in the app right away.')
      return { card: { title: `Save changes to "${old?.name ?? body.name}"?`, lines, check: c, confirmCents: c.money.set_aside_now_cents, cta: 'Save changes', tone: 'primary' } }
    }
    case 'discard_draft': {
      const d = await draftRow(ctx, String(input.draft_id ?? ''))
      if (!d) return { result: { content: { error: 'draft not found' }, isError: true } }
      if (d.source === 'year_plan') {
        const { data: run } = await ctx.admin.from('employer_challenge_drafts').select('run:challenge_template_runs(starts_on, ends_on, template:challenge_templates(title))').eq('id', d.id).maybeSingle()
        const r = (run as unknown as { run?: { starts_on: string; ends_on: string; template?: { title: string } } } | null)?.run
        return {
          card: {
            title: `Skip "${d.body?.name ?? r?.template?.title ?? 'this season'}"${r ? ` (${shortDate(r.starts_on)} to ${shortDate(r.ends_on)})` : ''}?`,
            lines: ['It was never launched, so nothing changes for your team. The rest of the year plan stays as it is.'],
            cta: 'Skip it',
            tone: 'danger',
          },
        }
      }
      return { card: { title: `Discard "${d.body?.name ?? 'this draft'}"?`, lines: ['It was never launched, so nothing changes for your team.'], cta: 'Discard', tone: 'danger' } }
    }
    case 'invite_employees': {
      const emails = Array.from(new Set(((input.emails as string[]) ?? []).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))))
      if (emails.length === 0) return { result: { content: { error: 'no valid email addresses' }, isError: true } }
      input.emails = emails
      const shown = emails.slice(0, 8).join(', ') + (emails.length > 8 ? `, and ${emails.length - 8} more` : '')
      return {
        card: {
          title: `Email Shift invitations to ${emails.length} ${emails.length === 1 ? 'person' : 'people'}?`,
          lines: [shown, `Sent from Shift on behalf of ${ctx.groupName}, with your join code, and one reminder a few days later to anyone who hasn't joined.`],
          cta: `Send ${emails.length} ${emails.length === 1 ? 'invitation' : 'invitations'}`,
          tone: 'primary',
        },
      }
    }
    case 'set_email_domains': {
      const domains = Array.from(new Set(((input.domains as string[]) ?? []).map((d) => d.trim().toLowerCase().replace(/^@/, '')).filter(Boolean)))
      input.domains = domains
      return {
        card: {
          title: 'Set your company email domains?',
          lines: [domains.length ? domains.join(', ') : '(none)', 'People confirm an address at one of these in the app to prove they work here. Prizes limited to employees use it.'],
          cta: 'Save domains',
          tone: 'primary',
        },
      }
    }
    case 'set_join_policy': {
      const words: Record<string, string> = {
        open: 'Anyone with your join code or link can join.',
        work_email: 'Only people who confirm a company email can join.',
        approval: 'People ask to join, and an admin approves each one on the Employees page.',
      }
      return { card: { title: 'Change who can join?', lines: [words[String(input.policy)] ?? String(input.policy)], cta: 'Save', tone: 'primary' } }
    }
    case 'set_year_plan':
      return {
        card: {
          title: input.enabled ? 'Turn on the year plan?' : 'Turn off the year plan?',
          lines: [
            input.enabled
              ? 'About three weeks before each GSI seasonal challenge, a draft appears here and in your weekly email. Nothing starts until an admin launches it.'
              : 'No more seasonal drafts will appear. Drafts already here stay until you launch or skip them.',
          ],
          cta: input.enabled ? 'Turn it on' : 'Turn it off',
          tone: 'primary',
        },
      }
    case 'ask_gsi':
      return {
        card: {
          title: 'Send this question to the GSI team?',
          lines: [`"${String(input.question ?? '').slice(0, 600)}"`, `The GSI team replies by email to ${ctx.email}.`],
          cta: 'Send it',
          tone: 'primary',
        },
      }
    default:
      return (await surveyApprovalCard(ctx, name, input)) ?? (await adminApprovalCard(ctx, name, input)) ?? { result: { content: { error: `unknown tool ${name}` }, isError: true } }
  }
}

/** Run an approved action with exactly what was on the card. */
export async function runApproved(ctx: ToolCtx, name: string, input: Record<string, unknown>, card: ApprovalCard): Promise<ToolResult> {
  try {
    switch (name) {
      case 'launch_challenge': {
        const { data, error } = await rpc(ctx, 'launch_employer_challenge', { p_draft_id: input.draft_id, p_confirm_cents: card.confirmCents ?? 0 })
        if (error || !data?.ok) return { content: { launched: false, ...(data ?? {}), error }, isError: true }
        return { content: { launched: true, ...data }, link: { href: '/shift/employers/portal/challenges', label: 'See it on the Challenges page' } }
      }
      case 'fund_and_launch': {
        const r = await edgeTopUp(ctx, { draft_id: input.draft_id, confirm_cents: card.confirmCents ?? 0, mode: 'checkout' })
        if (typeof r.url === 'string') {
          return {
            content: { payment_page_ready: true, note: "The admin has a button to Stripe's page. The challenge launches by itself when the money arrives; the Challenges page shows it." },
            link: { href: r.url, label: 'Pay on Stripe', external: true },
          }
        }
        return { content: { error: r.error ?? r.reason ?? 'could not open the payment page', check: r.check }, isError: true }
      }
      case 'save_challenge_changes': {
        const { data, error } = await rpc(ctx, 'save_employer_challenge_changes', {
          p_competition_id: input.competition_id,
          p_body: bodyForSave(input),
          p_confirm_cents: card.confirmCents ?? 0,
        })
        if (error || !data?.ok) return { content: { saved: false, ...(data ?? {}), error }, isError: true }
        return { content: { saved: true, ...data } }
      }
      case 'discard_draft': {
        const d = await draftRow(ctx, String(input.draft_id ?? ''))
        if (d?.source === 'year_plan') {
          const { data, error } = await rpc(ctx, 'skip_employer_challenge_draft', { p_draft_id: input.draft_id })
          if (error || (data && data.ok === false)) return { content: { skipped: false, ...(data ?? {}), error }, isError: true }
          return { content: { skipped: true } }
        }
        const { data, error } = await rpc(ctx, 'discard_employer_challenge_draft', { p_draft_id: input.draft_id })
        if (error || !data?.ok) return { content: { discarded: false, ...(data ?? {}), error }, isError: true }
        return { content: { discarded: true } }
      }
      case 'invite_employees': {
        const { data, error } = await rpc(ctx, 'add_employer_invitations', { p_group_id: ctx.groupId, p_emails: input.emails, p_invited_by: ctx.email })
        if (error || !data?.ok) return { content: { sent: false, ...(data ?? {}), error }, isError: true }
        // Ask the sender to run now; the hourly run picks them up otherwise.
        try {
          await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-invites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
            body: JSON.stringify({ group_id: ctx.groupId }),
          })
        } catch {}
        return { content: { sent: true, ...data }, link: { href: '/shift/employers/portal/employees', label: 'See invitations' } }
      }
      case 'set_email_domains': {
        const { data, error } = await rpc(ctx, 'set_employer_email_domains', { p_group_id: ctx.groupId, p_domains: input.domains })
        if (error || (data && data.ok === false)) return { content: { saved: false, ...(data ?? {}), error }, isError: true }
        return { content: { saved: true, domains: input.domains } }
      }
      case 'set_join_policy': {
        const { data, error } = await rpc(ctx, 'set_group_join_policy', { p_group_id: ctx.groupId, p_policy: input.policy })
        if (error || (data && data.ok === false)) return { content: { saved: false, ...(data ?? {}), error }, isError: true }
        return { content: { saved: true, policy: input.policy } }
      }
      case 'set_year_plan': {
        const { data: plan } = await ctx.admin.from('employer_year_plans').select('skipped_slugs').eq('group_id', ctx.groupId).maybeSingle()
        const { data, error } = await rpc(ctx, 'set_employer_year_plan', {
          p_group_id: ctx.groupId,
          p_enabled: !!input.enabled,
          p_skipped_slugs: (plan as { skipped_slugs?: string[] } | null)?.skipped_slugs ?? [],
        })
        if (error || (data && data.ok === false)) return { content: { saved: false, ...(data ?? {}), error }, isError: true }
        return { content: { saved: true, year_plan_on: !!input.enabled } }
      }
      case 'ask_gsi': {
        const question = String(input.question ?? '').slice(0, 4000)
        const context = String(input.context ?? '').slice(0, 4000)
        const { data: row, error } = await ctx.admin
          .from('employer_help_requests')
          .insert({ group_id: ctx.groupId, thread_id: ctx.threadId, asked_by_email: ctx.email, question, context })
          .select('id')
          .single()
        if (error) return { content: { sent: false, error: error.message }, isError: true }
        await ctx.admin.from('admin_notifications').insert({
          level: 'info',
          source: 'employer_assistant',
          title: `Question from ${ctx.groupName}`,
          body: `${ctx.email} asked: ${question}`,
          context: { kind: 'employer_help_request', request_id: (row as { id: string }).id, group_id: ctx.groupId, thread_id: ctx.threadId },
        })
        try {
          const resend = new Resend(process.env.RESEND_API_KEY!)
          await resend.emails.send({
            from: 'Shift <noreply@gogreenstreets.org>',
            to: process.env.EMPLOYER_HELP_EMAIL || 'keith@gogreenstreets.org',
            replyTo: ctx.email,
            subject: `Shift question from ${ctx.groupName}`,
            text: `${ctx.email} (${ctx.role}, ${ctx.groupName}) asked the setup assistant something it couldn't answer:\n\n${question}\n\nWhat the assistant knew:\n${context || '(nothing more)'}\n\nReply to this email to answer them directly.\nConversation: ${ctx.origin}/shift/employers/portal (thread ${ctx.threadId})`,
          })
        } catch {}
        return { content: { sent: true } }
      }
      default:
        return (await runSurveyApproved(ctx, name, input)) ?? (await runAdminApproved(ctx, name, input)) ?? { content: { error: `unknown tool ${name}` }, isError: true }
    }
  } catch (e) {
    return { content: { error: e instanceof Error ? e.message : 'action failed' }, isError: true }
  }
}
