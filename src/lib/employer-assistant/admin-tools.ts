// The setup assistant's second batch (Keith 2026-10-20: "anything the admin
// could do"): plans, employees, prizes on live challenges, the team, and
// settings. Same rules as tools.ts: reads are scoped to the workplace, every
// change runs as the signed-in admin and waits for an approval card.

import type Anthropic from '@anthropic-ai/sdk'
import { NONPROFIT_RATE, PLAN_TERMS, PLANS, priceLabel } from '@/lib/employer/plans'
import type { ApprovalCard, ToolCtx, ToolResult } from './tools'

const money = (c: number) => (c % 100 === 0 ? `$${(c / 100).toLocaleString('en-US')}` : `$${(c / 100).toFixed(2)}`)
const ROLE_WORDS: Record<string, string> = {
  admin: 'Admins can do everything: challenges, inviting employees, settings, billing and the team.',
  manager: 'Managers run challenges and prizes, invite employees and edit the Commute Advisor, but not settings, billing or the team.',
  viewer: 'Viewers can see everything and change nothing.',
}
const BENEFIT_FIELDS: Record<string, string> = {
  transit_subsidy_monthly: 'Monthly transit benefit',
  transit_subsidy_type: 'Transit benefit type',
  bluebikes_subsidized: 'Bluebikes membership covered',
  bluebikes_subsidy_type: 'Bluebikes coverage',
  bike_parking: 'Bike parking',
  bike_parking_details: 'Bike parking details',
  showers: 'Showers',
  shower_details: 'Shower details',
  free_parking: 'Free car parking',
  parking_cost_monthly: 'Monthly parking cost',
  other_benefits: 'Other benefits',
  hr_contact_name: 'Benefits contact name',
  hr_contact_email: 'Benefits contact email',
}

export const ADMIN_TOOLS: Anthropic.Tool[] = [
  {
    name: 'guide_top_up',
    description:
      "Help an admin add money to the rewards balance outside of launching a challenge. You never add money yourself: this gives them a button to the Billing page with the amount filled in, and they choose and pay there. Explain what the money is for first.",
    input_schema: {
      type: 'object',
      properties: { amount_dollars: { type: ['integer', 'null'], description: 'A suggested amount, $25 to $10,000, from what their rewards need' } },
    },
  },
  {
    name: 'set_office',
    description:
      'Add an office (or change the main one) from an address in plain words. It is looked up on the map, and the approval card shows exactly what was found. The main office (first) is where the Commute Advisor opens and what office-only challenges use. Needs approval.',
    input_schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Street address, as the admin gave it' },
        name: { type: ['string', 'null'], description: 'Short name, e.g. "Back Bay office"' },
        replace_location_id: { type: ['string', 'null'], description: 'An existing office to replace (from get_account_overview offices); omit to add a new one' },
        make_main: { type: 'boolean', description: 'Make it the main office' },
        arrive_by: { type: ['string', 'null'], description: 'When people usually need to be in, HH:MM 24h' },
      },
      required: ['address'],
    },
  },
  {
    name: 'remove_office',
    description: 'Remove an office from the list (not the only one). Needs approval.',
    input_schema: { type: 'object', properties: { location_id: { type: 'string' } }, required: ['location_id'] },
  },
  {
    name: 'set_logo',
    description: "Make an image the admin attached in this conversation the company logo (shown on the join page, the Commute Advisor and in the app). Use the URL from their attachment. Needs approval.",
    input_schema: { type: 'object', properties: { image_url: { type: 'string' } }, required: ['image_url'] },
  },
  {
    name: 'remove_logo',
    description: 'Remove the company logo. Needs approval.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_plans',
    description: "Shift's plans and prices, what each adds, the nonprofit rate, this workplace's plan, and how to change it. Use for any plan or pricing question.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'open_plan_change',
    description: "Give the admin a button to Stripe's plan-change page for this account (Stripe shows the new price before anything changes). Admins only.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_employees',
    description: 'Who has joined (names as the portal shows them, with recent activity), pending join requests, and invitations not yet accepted.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'decide_join_request',
    description: 'Let someone in, or turn down their request to join. Needs approval.',
    input_schema: {
      type: 'object',
      properties: { request_id: { type: 'string' }, approve: { type: 'boolean' } },
      required: ['request_id', 'approve'],
    },
  },
  {
    name: 'remove_invitation',
    description: 'Withdraw an invitation that has not been accepted. Needs approval.',
    input_schema: { type: 'object', properties: { invitation_id: { type: 'string' } }, required: ['invitation_id'] },
  },
  {
    name: 'nudge_employee',
    description: "Email one employee who has joined a friendly encouragement from Shift on the workplace's behalf. Needs approval.",
    input_schema: { type: 'object', properties: { user_id: { type: 'string' } }, required: ['user_id'] },
  },
  {
    name: 'get_prize_winners',
    description: "A reward's winners so far: names as the portal shows them, what they logged, whether their gift card was sent or the prize handed out.",
    input_schema: { type: 'object', properties: { prize_id: { type: 'string' } }, required: ['prize_id'] },
  },
  {
    name: 'add_prize_spots',
    description: 'Change the number of spots on a live first-to-the-goal reward (more spots set aside more money; after the start, spots can only go up). Needs approval.',
    input_schema: {
      type: 'object',
      properties: { prize_id: { type: 'string' }, spots: { type: 'integer' } },
      required: ['prize_id', 'spots'],
    },
  },
  {
    name: 'cancel_prize',
    description: 'Cancel a live first-to-the-goal reward. People who already won keep their prize; unused money goes back to the balance. Cannot be undone. Needs approval.',
    input_schema: { type: 'object', properties: { prize_id: { type: 'string' } }, required: ['prize_id'] },
  },
  {
    name: 'draw_winners',
    description: 'Draw the winners of a drawing or leaderboard reward after the challenge has ended (they are also drawn automatically). Gift cards are paid from the balance. Needs approval.',
    input_schema: { type: 'object', properties: { prize_id: { type: 'string' } }, required: ['prize_id'] },
  },
  {
    name: 'mark_prize_handed_out',
    description: "Record that a winner of a prize the employer hands out (not a gift card) got it, or undo that. Needs approval.",
    input_schema: {
      type: 'object',
      properties: { winner_id: { type: 'string' }, handed_out: { type: 'boolean' } },
      required: ['winner_id', 'handed_out'],
    },
  },
  {
    name: 'get_team',
    description: 'Everyone who can open this portal, with their role, and who owns the account.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'add_team_member',
    description: 'Give a colleague access to this portal; they get a sign-in link by email. Admins only. Needs approval.',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string' }, role: { type: 'string', enum: ['admin', 'manager', 'viewer'] } },
      required: ['email', 'role'],
    },
  },
  {
    name: 'change_team_role',
    description: "Change a team member's role. The owner stays an admin, and a portal always keeps one admin. Admins only. Needs approval.",
    input_schema: {
      type: 'object',
      properties: { member_id: { type: 'string' }, role: { type: 'string', enum: ['admin', 'manager', 'viewer'] } },
      required: ['member_id', 'role'],
    },
  },
  {
    name: 'remove_team_member',
    description: 'Remove someone from the portal team (not the owner, not the last admin). Admins only. Needs approval.',
    input_schema: { type: 'object', properties: { member_id: { type: 'string' } }, required: ['member_id'] },
  },
  {
    name: 'update_company_profile',
    description: 'Change the company name, contact name, phone or website shown on the join page and Commute Advisor. Admins only. Needs approval. (The logo is uploaded on the Settings page.)',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        admin_name: { type: 'string', description: 'The main contact person' },
        admin_phone: { type: 'string' },
        website_url: { type: 'string' },
      },
    },
  },
  {
    name: 'update_commute_benefits',
    description:
      "Set the commute benefits and facilities the Commute Advisor page shows employees. Only pass fields that change. The office address is set on the Commute Advisor page (it needs the map). Needs approval.",
    input_schema: {
      type: 'object',
      properties: {
        transit_subsidy_monthly: { type: ['number', 'null'] },
        transit_subsidy_type: { type: ['string', 'null'], enum: ['pre_tax', 'direct', null] },
        bluebikes_subsidized: { type: 'boolean' },
        bluebikes_subsidy_type: { type: ['string', 'null'], enum: ['full', 'partial', null] },
        bike_parking: { type: 'boolean' },
        bike_parking_details: { type: ['string', 'null'] },
        showers: { type: 'boolean' },
        shower_details: { type: ['string', 'null'] },
        free_parking: { type: 'boolean' },
        parking_cost_monthly: { type: ['number', 'null'] },
        other_benefits: { type: ['string', 'null'] },
        hr_contact_name: { type: ['string', 'null'] },
        hr_contact_email: { type: ['string', 'null'] },
      },
    },
  },
  {
    name: 'set_success_plan',
    description:
      'Save what success looks like: the goal (participation, mode_shift, parking, wellness, benefit_uptake), a target percent, the date, the launch date, headcount and any notes. Drives the Impact page and setup checklist. Needs approval.',
    input_schema: {
      type: 'object',
      properties: {
        goal_type: { type: 'string', enum: ['participation', 'mode_shift', 'parking', 'wellness', 'benefit_uptake'] },
        goal_target_pct: { type: ['integer', 'null'], description: '1-100' },
        goal_target_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        launch_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
        headcount: { type: ['integer', 'null'] },
        success_definition: { type: ['string', 'null'], description: 'Anything else, in their words' },
      },
      required: ['goal_type'],
    },
  },
  {
    name: 'set_public_listing',
    description: "Show or hide the workplace's team name and logo on public leaderboards. Admins only. Needs approval.",
    input_schema: { type: 'object', properties: { public: { type: 'boolean' } }, required: ['public'] },
  },
]

export const ADMIN_NEEDS_APPROVAL = [
  'set_office',
  'remove_office',
  'set_logo',
  'remove_logo',
  'decide_join_request',
  'remove_invitation',
  'nudge_employee',
  'add_prize_spots',
  'cancel_prize',
  'draw_winners',
  'mark_prize_handed_out',
  'add_team_member',
  'change_team_role',
  'remove_team_member',
  'update_company_profile',
  'update_commute_benefits',
  'set_success_plan',
  'set_public_listing',
]

export const ADMIN_ONLY = ['set_logo', 'remove_logo', 'open_plan_change', 'add_team_member', 'change_team_role', 'remove_team_member', 'update_company_profile', 'set_public_listing']

export const ADMIN_ACTIVITY: Record<string, string> = {
  set_office: 'Saving the office',
  remove_office: 'Removing the office',
  set_logo: 'Setting your logo',
  remove_logo: 'Removing your logo',
  guide_top_up: 'Getting the Billing page ready',
  get_plans: 'Looking at the plans',
  open_plan_change: 'Opening plan changes',
  get_employees: 'Looking at your employees',
  decide_join_request: 'Answering the join request',
  remove_invitation: 'Withdrawing the invitation',
  nudge_employee: 'Sending the nudge',
  get_prize_winners: 'Looking at the winners',
  add_prize_spots: 'Changing the spots',
  cancel_prize: 'Cancelling the reward',
  draw_winners: 'Drawing winners',
  mark_prize_handed_out: 'Recording the hand-out',
  get_team: 'Looking at your team',
  add_team_member: 'Adding to your team',
  change_team_role: 'Changing the role',
  remove_team_member: 'Removing from your team',
  update_company_profile: 'Updating your profile',
  update_commute_benefits: 'Updating the Commute Advisor',
  set_success_plan: 'Saving your success plan',
  set_public_listing: 'Updating the public listing',
}

// ── Lookups (scoped to the workplace) ──────────────────────────────────

/** Google Places text search, biased to Greater Boston (as the portal's address picker). */
async function geocode(address: string): Promise<{ formatted: string; lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_ROUTES_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.formattedAddress,places.location' },
      body: JSON.stringify({
        textQuery: address,
        maxResultCount: 1,
        locationBias: { circle: { center: { latitude: 42.36, longitude: -71.06 }, radius: 50000 } },
      }),
    })
    if (!res.ok) return null
    const j = (await res.json()) as { places?: { formattedAddress?: string; location?: { latitude: number; longitude: number } }[] }
    const p = j.places?.[0]
    if (!p?.location || !p.formattedAddress) return null
    return { formatted: p.formattedAddress, lat: p.location.latitude, lng: p.location.longitude }
  } catch {
    return null
  }
}

type Office = { id: string; name: string | null; address: string; lat: number; lng: number; radius_m: number; sort_order: number; typical_start_time?: string | null }

async function offices(ctx: ToolCtx): Promise<Office[]> {
  const { data } = await ctx.admin.from('employer_locations').select('*').eq('group_id', ctx.groupId).order('sort_order')
  return (data ?? []) as Office[]
}

const officePayload = (o: Pick<Office, 'name' | 'address' | 'lat' | 'lng'> & { id?: string | null; typical_start_time?: string | null }) => ({
  id: o.id ?? null,
  name: o.name ?? null,
  address: o.address,
  lat: o.lat,
  lng: o.lng,
  typical_start_time: o.typical_start_time ?? '09:00',
})

const logoPrefix = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/employer-logos/`

async function prize(ctx: ToolCtx, id: string) {
  const { data } = await ctx.admin
    .from('employer_challenge_prizes')
    .select('id, name, award_mode, winner_count, amount_cents, funded_from_pool, published_at, cancelled_at, closed_at, draw_status, hold_cents, budget_cap_cents, competition:competitions(name, starts_at, ends_at)')
    .eq('id', id)
    .eq('group_id', ctx.groupId)
    .maybeSingle()
  return data as unknown as {
    id: string; name: string; award_mode: string; winner_count: number; amount_cents: number | null; funded_from_pool: boolean
    published_at: string | null; cancelled_at: string | null; closed_at: string | null; draw_status: string; hold_cents: number
    budget_cap_cents: number | null; competition: { name: string; starts_at: string; ends_at: string } | null
  } | null
}

async function members(ctx: ToolCtx) {
  const { data } = await ctx.user.rpc('get_employer_members', { p_group_id: ctx.groupId, p_days: 30 })
  return ((data ?? []) as Record<string, unknown>[])
}

async function teamRow(ctx: ToolCtx, id: string) {
  const { data } = await ctx.admin.from('group_admins').select('id, email, name, role, is_owner').eq('id', id).eq('group_id', ctx.groupId).maybeSingle()
  return data as { id: string; email: string; name: string | null; role: string; is_owner: boolean | null } | null
}

const who = (m: Record<string, unknown> | undefined) => String(m?.display_name ?? m?.name ?? 'this person')

async function joinRequests(ctx: ToolCtx): Promise<Record<string, unknown>[]> {
  const { data } = await ctx.user.rpc('get_group_join_requests', { p_group_id: ctx.groupId })
  const res = data as { ok?: boolean; rows?: Record<string, unknown>[] } | null
  return res?.ok ? (res.rows ?? []) : []
}

// ── Reads ──────────────────────────────────────────────────────────────

export async function runAdminRead(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult | null> {
  switch (name) {
    case 'guide_top_up': {
      if (ctx.role !== 'admin' && ctx.role !== 'gsi') {
        return { content: { error: 'only_admins', message: 'Only an admin can add money; suggest they ask one.' }, isError: true }
      }
      const n = Number(input.amount_dollars)
      const amount = Number.isFinite(n) && n >= 25 && n <= 10000 ? Math.round(n) : null
      const { data: pool } = await ctx.admin.from('reward_pools').select('balance_cents, held_cents').eq('owner_type', 'employer').eq('owner_group_id', ctx.groupId).maybeSingle()
      const p = pool as { balance_cents: number; held_cents: number } | null
      return {
        content: {
          shown: true,
          available_now: money(p ? p.balance_cents - p.held_cents : 0),
          set_aside_for_live_rewards: money(p?.held_cents ?? 0),
          steps:
            "On the Billing page: check the amount (filled in), click 'Add funds', and pay on Stripe's secure page by card or bank transfer. A card shows up right away; a bank payment takes 3 to 5 business days. $25 to $10,000 per top-up.",
          note: 'Money is only spent when someone wins; unused money set aside for a goal reward comes back when the challenge ends.',
        },
        link: { href: `/shift/employers/portal/billing${amount ? `?amount=${amount}` : ''}`, label: amount ? `Add $${amount.toLocaleString('en-US')} on the Billing page` : 'Add funds on the Billing page' },
      }
    }
    case 'get_plans': {
      const { data: g } = await ctx.admin.from('groups').select('tier, access_ends_at, status, stripe_subscription_id').eq('id', ctx.groupId).maybeSingle()
      const row = g as { tier?: string; access_ends_at?: string | null; status?: string; stripe_subscription_id?: string | null } | null
      const order = PLANS.map((p) => p.id as string)
      const current = row?.tier ?? 'starter'
      return {
        content: {
          plans: PLANS.map((p) => ({ plan: p.name, price_per_year: priceLabel(p), for: p.tagline, includes: p.features })),
          terms: PLAN_TERMS,
          nonprofit_rate: NONPROFIT_RATE,
          this_workplace: {
            plan: current === 'free' ? 'Complimentary' : (PLANS.find((p) => p.id === current)?.name ?? current),
            access_runs_through: row?.access_ends_at ?? null,
            upgrades_available: order.slice(order.indexOf(current) + 1).map((id) => PLANS.find((p) => p.id === id)!.name),
          },
          how_to_change:
            row?.stripe_subscription_id
              ? "An admin can change plans online: open_plan_change gives them Stripe's plan-change page, which shows the new price before anything changes. The Billing page has the same 'Change plan' link."
              : 'This account is not on an online subscription (invoiced or complimentary), so plan changes go through GSI: offer ask_gsi, or info@gogreenstreets.org.',
          custom: 'Custom packages, multi-year discounts and the nonprofit rate are arranged with GSI (ask_gsi or info@gogreenstreets.org).',
        },
      }
    }
    case 'open_plan_change': {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-billing-portal`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx.token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ return_url: `${ctx.origin}/shift/employers/portal/billing`, flow: 'update' }),
        })
        const j = (await res.json().catch(() => ({}))) as { url?: string; unavailable?: string; error?: string }
        if (j.url) return { content: { ready: true, note: 'The admin has a button to Stripe. Nothing changes until they confirm there.' }, link: { href: j.url, label: 'Change plan on Stripe', external: true } }
        if (j.unavailable) return { content: { ready: false, reason: 'This account can\'t change plans online (invoiced or complimentary). Offer ask_gsi.' } }
        return { content: { ready: false, error: j.error ?? 'could not open Stripe' }, isError: true }
      } catch {
        return { content: { ready: false, error: 'could not reach billing' }, isError: true }
      }
    }
    case 'get_employees': {
      const [list, reqs, inv] = await Promise.all([
        members(ctx),
        joinRequests(ctx),
        ctx.admin.from('employer_invitations').select('id, email, status, sent_at, reminded_at, created_at').eq('group_id', ctx.groupId).is('joined_at', null).order('created_at', { ascending: false }).limit(100),
      ])
      return {
        content: {
          // Names and totals, as the Employees page shows them; no addresses.
          joined: list.slice(0, 200).map((m) => ({
            user_id: m.user_id,
            name: m.display_name,
            joined: m.joined_at,
            trips_last_30_days: m.trips_in_period,
            active_trips_last_30_days: m.active_trips_in_period,
            last_active: m.last_active_at,
          })),
          join_requests: reqs.map((r) => ({ request_id: r.id, name: r.name, requested: r.requested_at })),
          invited_not_joined: (inv.data ?? []) as unknown[],
          note: 'Individual trips are private; the portal shows names and totals only.',
        },
      }
    }
    case 'get_prize_winners': {
      const p = await prize(ctx, String(input.prize_id ?? ''))
      if (!p) return { content: { error: 'reward not found on this account' }, isError: true }
      const [{ data: rows }, list] = await Promise.all([
        ctx.admin
          .from('employer_prize_winners')
          .select('id, user_id, metric_value, reached_at, drawn_at, fulfillment_status, handed_out_at, received_at, amount_cents')
          .eq('prize_id', p.id)
          .order('reached_at', { ascending: true, nullsFirst: false }),
        members(ctx),
      ])
      const byUser = new Map(list.map((m) => [String(m.user_id), m]))
      return {
        content: {
          reward: p.name,
          challenge: p.competition?.name,
          kind: p.award_mode,
          spots: p.winner_count,
          live: !!p.published_at,
          cancelled: !!p.cancelled_at,
          draw_status: p.draw_status,
          winners: ((rows ?? []) as Record<string, unknown>[]).map((w) => ({
            winner_id: w.id,
            name: who(byUser.get(String(w.user_id))),
            logged: w.metric_value,
            gift_card: w.amount_cents ? money(Number(w.amount_cents)) : null,
            status: w.handed_out_at ? 'handed out' : w.received_at ? 'received' : (w.fulfillment_status ?? 'pending'),
          })),
        },
      }
    }
    case 'get_team': {
      const { data } = await ctx.admin.from('group_admins').select('id, email, name, role, is_owner, created_at').eq('group_id', ctx.groupId).order('created_at')
      return { content: { team: (data ?? []).map((r) => ({ member_id: r.id, email: r.email, name: r.name, role: r.role, owner: !!r.is_owner })), roles: ROLE_WORDS } }
    }
    default:
      return null
  }
}

// ── Approval cards ─────────────────────────────────────────────────────

export async function adminApprovalCard(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<{ card: ApprovalCard } | { result: ToolResult } | null> {
  const fail = (message: string) => ({ result: { content: { error: message }, isError: true } as ToolResult })
  switch (name) {
    case 'set_office': {
      const found = await geocode(String(input.address ?? ''))
      if (!found) return fail("That address couldn't be found on the map. Ask for the full street address, or add it on the Commute Advisor page.")
      input._lat = found.lat
      input._lng = found.lng
      input._formatted = found.formatted
      const list = await offices(ctx)
      const replacing = input.replace_location_id ? list.find((o) => o.id === input.replace_location_id) : null
      if (input.replace_location_id && !replacing) return fail('that office is not on this account')
      const main = !!input.make_main || list.length === 0 || (replacing && replacing.sort_order === 0)
      return {
        card: {
          title: replacing ? `Change "${replacing.name || replacing.address}" to this address?` : 'Add this office?',
          lines: [
            `${input.name ? `${input.name}: ` : ''}${found.formatted}`,
            main ? 'This is your main office: the Commute Advisor opens here, and office-only challenges count trips to it.' : 'Added to your offices; trips to it count in office-only challenges.',
            ...(input.arrive_by ? [`People usually need to be in by ${input.arrive_by}.`] : []),
          ],
          mapUrl: `https://www.google.com/maps/search/?api=1&query=${found.lat},${found.lng}`,
          cta: 'Save the office',
          tone: 'primary',
        },
      }
    }
    case 'remove_office': {
      const list = await offices(ctx)
      const o = list.find((x) => x.id === input.location_id)
      if (!o) return fail('that office is not on this account')
      if (list.length === 1) return fail('it is the only office; change it instead of removing it')
      return { card: { title: `Remove "${o.name || o.address}"?`, lines: [o.address, ...(o.sort_order === 0 ? ['The next office becomes the main one.'] : [])], cta: 'Remove', tone: 'danger' } }
    }
    case 'set_logo': {
      const url = String(input.image_url ?? '')
      if (!url.startsWith(logoPrefix())) return fail('Use an image the admin attached in this conversation (the paperclip next to the message box).')
      return {
        card: {
          title: 'Use this as your company logo?',
          lines: ['It shows on your join page, the Commute Advisor, and in the Shift app for your team.'],
          image: url,
          cta: 'Use this logo',
          tone: 'primary',
        },
      }
    }
    case 'remove_logo':
      return { card: { title: 'Remove your logo?', lines: ['Employees see your company name without a logo in the app and on your join page.'], cta: 'Remove logo', tone: 'danger' } }
    case 'decide_join_request': {
      const r = (await joinRequests(ctx)).find((x) => String(x.id) === String(input.request_id))
      if (!r) return fail('join request not found')
      const nm = String(r.name ?? r.email ?? 'this person')
      return input.approve
        ? { card: { title: `Let ${nm} join?`, lines: ['Their trips start counting toward your team.'], cta: 'Let them in', tone: 'primary' } }
        : { card: { title: `Turn down ${nm}'s request?`, lines: ["They won't join your workplace in the app."], cta: 'Turn down', tone: 'danger' } }
    }
    case 'remove_invitation': {
      const { data } = await ctx.admin.from('employer_invitations').select('email').eq('id', String(input.invitation_id)).eq('group_id', ctx.groupId).maybeSingle()
      if (!data) return fail('invitation not found')
      return { card: { title: `Withdraw the invitation to ${(data as { email: string }).email}?`, lines: ['No more reminders go to them. They can still join with your code.'], cta: 'Withdraw', tone: 'danger' } }
    }
    case 'nudge_employee': {
      const m = (await members(ctx)).find((x) => String(x.user_id) === String(input.user_id))
      if (!m) return fail('that person is not a member of this workplace')
      return { card: { title: `Email ${who(m)} a nudge?`, lines: [`A short, friendly note from Shift on behalf of ${ctx.groupName}, encouraging them to log a trip this week.`], cta: 'Send the nudge', tone: 'primary' } }
    }
    case 'add_prize_spots': {
      const p = await prize(ctx, String(input.prize_id ?? ''))
      if (!p || p.award_mode !== 'guaranteed') return fail('that is not a first-to-the-goal reward on this account')
      const spots = Number(input.spots)
      if (!Number.isInteger(spots) || spots < 1 || spots > 1000) return fail('spots must be 1 to 1000')
      const delta = p.published_at && p.funded_from_pool && p.amount_cents ? (spots - p.winner_count) * p.amount_cents : 0
      const lines = [`"${p.name}" in ${p.competition?.name ?? 'the challenge'}: ${p.winner_count} → ${spots} spots.`]
      if (delta > 0) lines.push(`Sets aside ${money(delta)} more from your rewards balance.`)
      if (delta < 0) lines.push(`${money(-delta)} goes back to your rewards balance.`)
      return { card: { title: `Change "${p.name}" to ${spots} spots?`, lines, cta: 'Change spots', tone: 'primary' } }
    }
    case 'cancel_prize': {
      const p = await prize(ctx, String(input.prize_id ?? ''))
      if (!p || p.award_mode !== 'guaranteed') return fail('that is not a first-to-the-goal reward on this account')
      return {
        card: {
          title: `Cancel "${p.name}"?`,
          lines: [
            'People who already won keep their prize; no one else can win it.',
            p.hold_cents > 0 ? `${money(p.hold_cents)} set aside for it goes back to your rewards balance.` : 'No money is set aside for it.',
            "This can't be undone.",
          ],
          cta: 'Cancel the reward',
          tone: 'danger',
        },
      }
    }
    case 'draw_winners': {
      const p = await prize(ctx, String(input.prize_id ?? ''))
      if (!p || p.award_mode === 'guaranteed') return fail('that is not a drawing or leaderboard reward on this account')
      if (p.draw_status !== 'pending') return fail('winners have already been drawn')
      if (p.competition && Date.parse(p.competition.ends_at) > Date.now()) return fail('the challenge has not ended yet; winners are drawn after it ends')
      const most = p.funded_from_pool && p.amount_cents ? Math.min(p.winner_count * p.amount_cents, p.budget_cap_cents ?? Infinity) : 0
      return {
        card: {
          title: `Draw the winners of "${p.name}"?`,
          lines: [
            p.award_mode === 'merit' ? `The top ${p.winner_count} win.` : `${p.winner_count} drawn at random from everyone who reached the goal.`,
            most > 0 ? `Up to ${money(most)} in gift cards is paid from your rewards balance; winners pick their card in the app.` : 'Winners get the prize you hand out.',
          ],
          cta: 'Draw winners',
          tone: 'primary',
        },
      }
    }
    case 'mark_prize_handed_out': {
      const { data: w } = await ctx.admin.from('employer_prize_winners').select('id, user_id, prize_id').eq('id', String(input.winner_id)).maybeSingle()
      const p = w ? await prize(ctx, String((w as { prize_id: string }).prize_id)) : null
      if (!w || !p) return fail('winner not found on this account')
      const m = (await members(ctx)).find((x) => String(x.user_id) === String((w as { user_id: string }).user_id))
      return {
        card: input.handed_out
          ? { title: `Mark ${who(m)}'s prize as handed out?`, lines: [`"${p.name}"`], cta: 'Mark handed out', tone: 'primary' }
          : { title: `Undo the hand-out for ${who(m)}?`, lines: [`"${p.name}"`], cta: 'Undo', tone: 'primary' },
      }
    }
    case 'add_team_member': {
      const email = String(input.email ?? '').trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('that email address does not look right')
      input.email = email
      const role = String(input.role)
      return { card: { title: `Add ${email} as ${role === 'admin' ? 'an admin' : `a ${role}`}?`, lines: [ROLE_WORDS[role] ?? role, 'They get a sign-in link by email. The account owner is told.'], cta: 'Add them', tone: 'primary' } }
    }
    case 'change_team_role': {
      const r = await teamRow(ctx, String(input.member_id ?? ''))
      if (!r) return fail('team member not found')
      if (r.is_owner) return fail('the account owner always stays an admin; to change the owner, email info@gogreenstreets.org')
      const role = String(input.role)
      return { card: { title: `Make ${r.name || r.email} ${role === 'admin' ? 'an admin' : `a ${role}`}?`, lines: [ROLE_WORDS[role] ?? role], cta: 'Change role', tone: 'primary' } }
    }
    case 'remove_team_member': {
      const r = await teamRow(ctx, String(input.member_id ?? ''))
      if (!r) return fail('team member not found')
      if (r.is_owner) return fail('the account owner cannot be removed')
      return { card: { title: `Remove ${r.name || r.email} from the team?`, lines: ['They lose access to this portal. Their own Shift app account is not affected.'], cta: 'Remove', tone: 'danger' } }
    }
    case 'update_company_profile': {
      const keys = ['name', 'admin_name', 'admin_phone', 'website_url'].filter((k) => typeof input[k] === 'string' && String(input[k]).trim())
      if (!keys.length) return fail('nothing to change')
      const label: Record<string, string> = { name: 'Company name', admin_name: 'Contact name', admin_phone: 'Phone', website_url: 'Website' }
      return { card: { title: 'Update your company profile?', lines: keys.map((k) => `${label[k]}: ${String(input[k]).trim()}`), cta: 'Save', tone: 'primary' } }
    }
    case 'update_commute_benefits': {
      const keys = Object.keys(input).filter((k) => k in BENEFIT_FIELDS)
      if (!keys.length) return fail('nothing to change')
      const v = (k: string) => input[k]
      const line = (k: string): string => {
        const x = v(k)
        if (x == null || x === '') return `${BENEFIT_FIELDS[k]}: removed`
        switch (k) {
          case 'transit_subsidy_monthly':
            return `Transit benefit: $${x} a month`
          case 'parking_cost_monthly':
            return `Parking: $${x} a month`
          case 'transit_subsidy_type':
            return `Transit benefit is ${x === 'pre_tax' ? 'pre-tax' : 'paid directly'}`
          case 'bluebikes_subsidy_type':
            return `Bluebikes membership: ${x === 'full' ? 'fully' : 'partly'} covered`
          case 'bluebikes_subsidized':
          case 'bike_parking':
          case 'showers':
          case 'free_parking':
            return `${BENEFIT_FIELDS[k]}: ${x ? 'yes' : 'no'}`
          default:
            return `${BENEFIT_FIELDS[k]}: ${String(x)}`
        }
      }
      return {
        card: {
          title: 'Update your Commute Advisor page?',
          lines: [...keys.map(line), 'Employees see it on the Commute Advisor page right away.'],
          cta: 'Save',
          tone: 'primary',
        },
      }
    }
    case 'set_success_plan': {
      const goals: Record<string, string> = {
        participation: 'Getting employees to join and log trips',
        mode_shift: 'A mode-shift number for an ESG or sustainability report',
        parking: 'Less pressure on parking',
        wellness: 'A wellness benefit people actually use',
        benefit_uptake: 'More use of commuter benefits',
      }
      const lines = [`Goal: ${goals[String(input.goal_type)] ?? input.goal_type}`]
      if (input.goal_target_pct) lines.push(`Target: ${input.goal_target_pct}%${input.goal_target_date ? ` by ${input.goal_target_date}` : ''}`)
      if (input.launch_date) lines.push(`Launch: ${input.launch_date}`)
      if (input.headcount) lines.push(`Headcount: ${input.headcount}`)
      if (input.success_definition) lines.push(`Notes: ${input.success_definition}`)
      lines.push('Only your team sees this; it sets the target on the Impact page.')
      return { card: { title: 'Save your success plan?', lines, cta: 'Save', tone: 'primary' } }
    }
    case 'set_public_listing':
      return {
        card: input.public
          ? { title: 'Show your team on public leaderboards?', lines: ['Your team name and logo appear on public leaderboards for flagship events. Individual employees are never shown.'], cta: 'Show it', tone: 'primary' }
          : { title: 'Hide your team from public leaderboards?', lines: ['Your team name and logo come off public leaderboards.'], cta: 'Hide it', tone: 'primary' },
      }
    default:
      return null
  }
}

// ── Running an approved action ─────────────────────────────────────────

export async function runAdminApproved(ctx: ToolCtx, name: string, input: Record<string, unknown>): Promise<ToolResult | null> {
  const viaRpc = async (fn: string, args: Record<string, unknown>, ok: Record<string, unknown>) => {
    const { data, error } = await ctx.user.rpc(fn, args)
    const d = data as Record<string, unknown> | null
    if (error || (d && d.ok === false)) return { content: { done: false, ...(d ?? {}), error: error?.message }, isError: true } as ToolResult
    return { content: { done: true, ...ok, ...(d ?? {}) } } as ToolResult
  }
  switch (name) {
    case 'set_office': {
      const list = await offices(ctx)
      const entry = {
        id: (input.replace_location_id as string | null) ?? null,
        name: (input.name as string | null)?.trim() || null,
        address: String(input._formatted),
        lat: Number(input._lat),
        lng: Number(input._lng),
        typical_start_time: (input.arrive_by as string | null) ?? list.find((o) => o.id === input.replace_location_id)?.typical_start_time ?? '09:00',
      }
      let next = list.map((o) => (o.id === entry.id ? { ...o, ...entry } : o)).map(officePayload)
      if (!entry.id) next = [...next, officePayload(entry)]
      if (input.make_main) {
        const i = next.findIndex((o) => (entry.id ? o.id === entry.id : o.address === entry.address && o.id == null))
        if (i > 0) next = [next[i], ...next.slice(0, i), ...next.slice(i + 1)]
      }
      const r = await viaRpc('set_employer_locations', { p_group_id: ctx.groupId, p_locations: next }, { saved: true, address: entry.address })
      return r.isError ? r : { ...r, link: { href: '/shift/employers/portal/advisor', label: 'See the Commute Advisor page' } }
    }
    case 'remove_office': {
      const next = (await offices(ctx)).filter((o) => o.id !== input.location_id).map(officePayload)
      return viaRpc('set_employer_locations', { p_group_id: ctx.groupId, p_locations: next }, { removed: true })
    }
    case 'set_logo': {
      const { error } = await ctx.user.from('groups').update({ logo_url: input.image_url }).eq('id', ctx.groupId)
      return error ? { content: { saved: false, error: error.message }, isError: true } : { content: { saved: true }, link: { href: '/shift/employers/portal/settings', label: 'See it in Settings' } }
    }
    case 'remove_logo': {
      const { error } = await ctx.user.from('groups').update({ logo_url: null }).eq('id', ctx.groupId)
      return error ? { content: { removed: false, error: error.message }, isError: true } : { content: { removed: true } }
    }
    case 'decide_join_request':
      return viaRpc('decide_group_join_request', { p_request_id: input.request_id, p_approve: !!input.approve }, { approved: !!input.approve })
    case 'remove_invitation':
      return viaRpc('remove_employer_invitation', { p_id: input.invitation_id }, { withdrawn: true })
    case 'nudge_employee': {
      try {
        const res = await fetch(`${ctx.origin}/api/employer/nudge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ctx.token}` },
          body: JSON.stringify({ userId: input.user_id, groupId: ctx.groupId }),
        })
        const j = (await res.json().catch(() => ({}))) as Record<string, unknown>
        return res.ok ? { content: { sent: true, ...j } } : { content: { sent: false, ...j }, isError: true }
      } catch {
        return { content: { sent: false, error: 'could not send' }, isError: true }
      }
    }
    case 'add_prize_spots':
      return viaRpc('set_guaranteed_prize_spots', { p_prize_id: input.prize_id, p_spots: input.spots }, { spots: input.spots })
    case 'cancel_prize':
      return viaRpc('cancel_guaranteed_prize', { p_prize_id: input.prize_id }, { cancelled: true })
    case 'draw_winners':
      return viaRpc('draw_employer_challenge_prizes', { p_prize_id: input.prize_id }, { drawn: true })
    case 'mark_prize_handed_out':
      return viaRpc('mark_employer_prize_handed_out', { p_winner_id: input.winner_id, p_handed_out: !!input.handed_out }, { handed_out: !!input.handed_out })
    case 'add_team_member': {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/employer-invite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ctx.token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ group_id: ctx.groupId, email: input.email, role: input.role }),
        })
        const j = (await res.json().catch(() => ({}))) as { admin_row?: unknown; email_sent?: boolean; error?: string }
        if (!res.ok || !j.admin_row) return { content: { added: false, error: j.error ?? 'could not add' }, isError: true }
        return { content: { added: true, email_sent: !!j.email_sent }, link: { href: '/shift/employers/portal/settings#team', label: 'See your team' } }
      } catch {
        return { content: { added: false, error: 'could not reach the invite service' }, isError: true }
      }
    }
    case 'change_team_role': {
      const { error } = await ctx.user.from('group_admins').update({ role: input.role }).eq('id', input.member_id).eq('group_id', ctx.groupId)
      return error ? { content: { changed: false, error: error.message }, isError: true } : { content: { changed: true, role: input.role } }
    }
    case 'remove_team_member': {
      const { error } = await ctx.user.from('group_admins').delete().eq('id', input.member_id).eq('group_id', ctx.groupId)
      return error ? { content: { removed: false, error: error.message }, isError: true } : { content: { removed: true } }
    }
    case 'update_company_profile': {
      const patch: Record<string, string> = {}
      for (const k of ['name', 'admin_name', 'admin_phone', 'website_url']) if (typeof input[k] === 'string' && String(input[k]).trim()) patch[k] = String(input[k]).trim()
      const { error } = await ctx.user.from('groups').update(patch).eq('id', ctx.groupId)
      return error ? { content: { saved: false, error: error.message }, isError: true } : { content: { saved: true, ...patch } }
    }
    case 'update_commute_benefits': {
      const { data: g } = await ctx.admin.from('groups').select('employer_benefits').eq('id', ctx.groupId).maybeSingle()
      const current = ((g as { employer_benefits?: Record<string, unknown> } | null)?.employer_benefits ?? {}) as Record<string, unknown>
      const patch = Object.fromEntries(Object.entries(input).filter(([k]) => k in BENEFIT_FIELDS))
      const { error } = await ctx.user.from('groups').update({ employer_benefits: { ...current, ...patch } }).eq('id', ctx.groupId)
      return error
        ? { content: { saved: false, error: error.message }, isError: true }
        : { content: { saved: true }, link: { href: '/shift/employers/portal/advisor', label: 'See the Commute Advisor page' } }
    }
    case 'set_success_plan': {
      const { data: g } = await ctx.admin.from('groups').select('onboarding').eq('id', ctx.groupId).maybeSingle()
      const current = ((g as { onboarding?: Record<string, unknown> } | null)?.onboarding ?? {}) as Record<string, unknown>
      const next: Record<string, unknown> = { ...current }
      for (const k of ['goal_type', 'goal_target_pct', 'goal_target_date', 'launch_date', 'headcount', 'success_definition']) if (k in input) next[k] = input[k]
      // The weekly digest still reads target_signup_pct for sign-up goals.
      next.target_signup_pct = next.goal_type === 'participation' ? (next.goal_target_pct ?? null) : null
      const { error } = await ctx.user.from('groups').update({ onboarding: next }).eq('id', ctx.groupId)
      return error ? { content: { saved: false, error: error.message }, isError: true } : { content: { saved: true } }
    }
    case 'set_public_listing':
      return viaRpc('sync_group_public_leaderboard', { p_group_id: ctx.groupId, p_wants_public: !!input.public }, { public: !!input.public })
    default:
      return null
  }
}
