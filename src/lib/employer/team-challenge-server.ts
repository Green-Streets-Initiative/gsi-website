import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { TEAM_CHALLENGE, type TeamResult } from './team-challenge'
import { findCompanyMatch, type CompanyForMatch } from './team-challenge-match'
import type { TeamChallengeSignup } from './team-challenge-token'
import { etEndOfDayIso, etStartOfDayIso } from '@/app/shift/employers/portal/_lib/portal-utils'

// Step 2 of the self-serve team challenge: after the person confirms, make
// the workplace group, its owner and the team challenge, the same rows the
// admin dashboard's "Add employer" and the portal's challenge builder write.
// The group is a Complimentary ('free') prospect, like the trial teams GSI
// sets up by hand, with a year of portal access.

export type { TeamResult }

/** What the existing company is, so info@ knows who to call. */
export type Matched = { groupId: string; name: string; billingType: string | null; tier: string | null; status: string }

export type Lookup =
  | { kind: 'mine'; team: TeamResult }
  | { kind: 'existing_admin'; company: Matched }
  | { kind: 'company_exists'; company: Matched; by: 'domain' | 'name' }
  | { kind: 'none' }

type GroupRow = {
  id: string
  name: string
  slug: string | null
  invite_code: string | null
  status: string
  type: string
  tier: string | null
  billing_type: string | null
  onboarding: Record<string, unknown> | null
}

// A company that is live, paused or lapsed is "already on Shift": a second
// person there, or a lapsed paying customer, goes to GSI, never to a fresh
// free trial. 'inactive' is GSI switching a trial or test off.
const HELD_STATUSES = ['active', 'paused', 'cancelled']

const matched = (g: { id: string; name: string; billing_type: string | null; tier: string | null; status: string }): Matched => ({
  groupId: g.id,
  name: g.name,
  billingType: g.billing_type,
  tier: g.tier,
  status: g.status,
})

async function teamChallengeId(db: SupabaseClient, groupId: string): Promise<string | null> {
  const { data } = await db
    .from('competitions')
    .select('id')
    .eq('group_id', groupId)
    .eq('template_run_id', TEAM_CHALLENGE.templateRunId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/** What already exists for this person and company, before anything is made. */
export async function lookupTeam(db: SupabaseClient, s: TeamChallengeSignup): Promise<Lookup> {
  const email = s.email.toLowerCase()

  // 1. This person already manages a workplace: theirs from this sign-up, or another one.
  const { data: mine } = await db
    .from('group_admins')
    .select('group_id, groups!inner(id, name, slug, invite_code, status, type, tier, billing_type, onboarding)')
    .eq('email', email)
    .limit(10)
  const myGroups = ((mine ?? []) as unknown as { groups: GroupRow }[]).map((r) => r.groups).filter((g) => g.type === 'workplace')
  for (const g of myGroups) {
    const signup = (g.onboarding?.signup ?? null) as { key?: string } | null
    if (signup?.key === TEAM_CHALLENGE.key) {
      return {
        kind: 'mine',
        team: { groupId: g.id, company: g.name, slug: g.slug, code: g.invite_code ?? '', challengeId: await teamChallengeId(db, g.id) },
      }
    }
  }
  const managed = myGroups.find((g) => HELD_STATUSES.includes(g.status))
  if (managed) return { kind: 'existing_admin', company: matched(managed) }

  // 2. The company is already on Shift, as a trial, a comped partner or a
  //    paying customer (rules in team-challenge-match.ts). Workplaces number
  //    in the dozens; this reads them in one capped query and compares here.
  const { data: rows } = await db
    .from('groups')
    .select('id, name, status, tier, billing_type, admin_email, website_url, group_admins(email)')
    .eq('type', 'workplace')
    .in('status', HELD_STATUSES)
    .not('billing_type', 'in', '(demo,internal)')
    .limit(2000)
  const hit = findCompanyMatch((rows ?? []) as unknown as CompanyForMatch[], email, s.company)
  if (hit) return { kind: 'company_exists', company: matched(hit.company), by: hit.by }

  return { kind: 'none' }
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

async function freeSlug(db: SupabaseClient, base: string): Promise<string | null> {
  if (!base) return null
  const { data } = await db.from('groups').select('slug').like('slug', `${base}%`).limit(50)
  const taken = new Set(((data ?? []) as { slug: string | null }[]).map((r) => r.slug))
  if (!taken.has(base)) return base
  for (let i = 2; i < 50; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`
  return null
}

/**
 * Makes the team. Returns the team and a one-time sign-in token for the
 * portal (the same token the portal's emailed links carry), or throws.
 * On a failure part-way, the group is removed so a retry starts clean.
 */
export async function createTeam(db: SupabaseClient, s: TeamChallengeSignup): Promise<{ team: TeamResult; tokenHash: string | null }> {
  const email = s.email.toLowerCase()

  // The portal signs people in as a Shift account; this makes it if needed.
  const { data: link, error: linkErr } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  if (linkErr || !link?.user?.id) throw new Error(`generateLink: ${linkErr?.message ?? 'no user'}`)
  const userId = link.user.id
  const tokenHash = link.properties?.hashed_token ?? null

  const now = new Date()
  const yearOn = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
  const { data: group, error: gErr } = await db
    .from('groups')
    .insert({
      name: s.company,
      slug: await freeSlug(db, slugify(s.company)),
      description: `${s.company} employees`,
      type: 'workplace',
      visibility: 'gated',
      created_by: userId,
      admin_name: s.name || null,
      admin_email: email,
      tier: 'free',
      status: 'active',
      billing_type: 'prospect',
      join_policy: 'open',
      public_leaderboard: false,
      // The portal's setup assistant, offered from day one (Keith 2026-10-26);
      // an admin can turn it off in Settings.
      assistant_enabled: true,
      access_starts_at: now.toISOString(),
      access_ends_at: yearOn.toISOString(),
      onboarding: {
        headcount: s.headcount,
        signup: { key: TEAM_CHALLENGE.key, at: now.toISOString(), source: 'challenge_page' },
      },
    })
    .select('id, name, slug, invite_code')
    .single()
  if (gErr || !group) throw new Error(`group insert: ${gErr?.message ?? 'no row'}`)

  try {
    const { error: aErr } = await db.from('group_admins').insert({
      group_id: group.id,
      email,
      role: 'admin',
      name: s.name || null,
      added_by: userId,
      is_owner: true,
    })
    if (aErr) throw new Error(`group_admins insert: ${aErr.message}`)

    const { data: comp, error: cErr } = await db
      .from('competitions')
      .insert({
        group_id: group.id,
        name: TEAM_CHALLENGE.challengeName,
        description: TEAM_CHALLENGE.description,
        metric: 'pct_non_car',
        duration_type: 'fixed',
        is_public: false,
        event_type: 'employer',
        starts_at: etStartOfDayIso(TEAM_CHALLENGE.startsOn),
        ends_at: etEndOfDayIso(TEAM_CHALLENGE.endsOn),
        contact_name: s.name || null,
        contact_email: email,
        template_slug: TEAM_CHALLENGE.templateSlug,
        template_run_id: TEAM_CHALLENGE.templateRunId,
        created_by: userId,
      })
      .select('id')
      .single()
    if (cErr || !comp) throw new Error(`competition insert: ${cErr?.message ?? 'no row'}`)

    return {
      team: { groupId: group.id, company: group.name, slug: group.slug, code: group.invite_code ?? '', challengeId: comp.id },
      tokenHash,
    }
  } catch (err) {
    await db.from('competitions').delete().eq('group_id', group.id)
    await db.from('group_admins').delete().eq('group_id', group.id)
    await db.from('groups').delete().eq('id', group.id)
    throw err
  }
}
