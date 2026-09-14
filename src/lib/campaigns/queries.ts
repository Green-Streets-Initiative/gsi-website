import 'server-only'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { calendarDayET } from './format'
import { FLAGSHIP_REGISTRY, UNLOCK_REGISTRY, type RegistryEntry } from './routes'
import type { Promotable } from './types'
import { synthesizeWalkRideDays } from './walk-ride-series'

/** The hub's lookahead. The nav applies its own, narrower, window on top. */
export const HORIZON_UPCOMING_DAYS = 90
/** How long something stays visible under "Just wrapped". */
export const HORIZON_WRAP_DAYS = 14

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…'
}

function matchFlagship(name: string): RegistryEntry | null {
  return FLAGSHIP_REGISTRY.find((f) => f.match.test(name))?.entry ?? null
}

async function fetchFlagships(now: Date): Promise<{ items: Promotable[]; lastSeeded: Date | null }> {
  const supabase = createServerSupabaseClient()
  const upcoming = new Date(now.getTime() + HORIZON_UPCOMING_DAYS * 86_400_000)
  const wrap = new Date(now.getTime() - HORIZON_WRAP_DAYS * 86_400_000)

  const { data, error } = await supabase
    .from('competitions')
    .select('id, name, description, starts_at, ends_at, sponsor_name, sponsor_logo_url')
    .eq('event_type', 'flagship')
    .eq('is_public', true)
    // Not in the app's version of this query. A group-scoped flagship is an
    // employer's private event and must never reach a public page.
    .is('group_id', null)
    .lte('starts_at', upcoming.toISOString())
    .gte('ends_at', wrap.toISOString())
    .order('starts_at', { ascending: true })

  if (error) throw new Error(`flagships: ${error.message}`)

  const items: Promotable[] = (data ?? []).map((r) => {
    const entry = matchFlagship(r.name)
    return {
      // Unrecognised events still render, keyed by their row id.
      id: `flagship:${entry?.slug ?? r.id}`,
      kind: 'flagship',
      source: 'db',
      title: entry?.title ?? r.name,
      icon: entry?.icon ?? 'flag',
      shortTitle: entry?.shortTitle ?? truncate(r.name, 22),
      blurb: entry?.blurb ?? (r.description ? truncate(r.description, 180) : null),
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      windowKind: 'event',
      singleDay: calendarDayET(r.starts_at) === calendarDayET(r.ends_at),
      phase: 'upcoming', // recomputed by rank.bucket() against a live clock
      href: entry?.href ?? null,
      secondaryHref: entry?.secondaryHref ?? null,
      secondaryLabel: entry?.secondaryLabel ?? null,
      event: {
        sponsorName: r.sponsor_name ?? null,
        sponsorLogoUrl: r.sponsor_logo_url ?? null,
        seriesKey: entry?.seriesKey ?? null,
        seriesNextDates: [],
      },
      mechanic: null,
    }
  })

  // How far the hand-seeded series actually runs, so the synthesizer knows
  // where to take over.
  const { data: tail } = await supabase
    .from('competitions')
    .select('starts_at')
    .eq('event_type', 'flagship')
    .like('name', '%Walk/Ride Day%')
    .order('starts_at', { ascending: false })
    .limit(1)

  const lastSeeded = tail?.[0]?.starts_at ? new Date(tail[0].starts_at) : null
  return { items, lastSeeded }
}

function unlockFrom(
  code: string,
  row: { signup_start: string; signup_end: string; trips_required: number; window_days: number; value_cents?: number | null },
): Promotable | null {
  const entry = UNLOCK_REGISTRY[code]
  if (!entry) {
    // An unreviewed admin-table row does not get to publish itself.
    console.warn('[campaigns] no registry entry for campaign code %s — skipped', code)
    return null
  }
  const dollars = row.value_cents ? Math.round(row.value_cents / 100) : null
  return {
    id: `unlock:${entry.slug}`,
    kind: 'unlock',
    source: 'db',
    title: entry.title ?? entry.shortTitle,
    icon: entry.icon,
    shortTitle: entry.shortTitle,
    blurb: entry.blurb,
    startsAt: row.signup_start,
    endsAt: row.signup_end,
    windowKind: 'signup',
    singleDay: false,
    phase: 'upcoming',
    href: entry.href,
    secondaryHref: entry.secondaryHref ?? null,
    secondaryLabel: entry.secondaryLabel ?? null,
    event: null,
    mechanic: {
      tripsRequired: row.trips_required,
      windowDays: row.window_days,
      rewardLabel: dollars ? `$${dollars} reward` : 'A reward of your choice',
      supplyLabel: entry.supplyLabel ?? null,
      gateLabel: entry.gateLabel ?? null,
    },
  }
}

async function fetchUnlocks(now: Date): Promise<Promotable[]> {
  const supabase = createServerSupabaseClient()
  const upcoming = new Date(now.getTime() + HORIZON_UPCOMING_DAYS * 86_400_000)
  const wrap = new Date(now.getTime() - HORIZON_WRAP_DAYS * 86_400_000)
  const out: Promotable[] = []

  const { data, error } = await supabase
    .from('campaigns')
    .select('code, signup_start, signup_end, trips_required, window_days, value_cents')
    .eq('enabled', true)
    .lte('signup_start', upcoming.toISOString())
    .gte('signup_end', wrap.toISOString())
  if (error) throw new Error(`campaigns: ${error.message}`)
  for (const row of data ?? []) {
    const p = unlockFrom(row.code, row)
    if (p) out.push(p)
  }

  // New Routes predates the campaigns table and still lives in its own
  // single-row config.
  const { data: nr, error: nrError } = await supabase
    .from('newroutes_config')
    .select('enabled, signup_start, signup_end, trips_required, window_days, value_cents')
    .eq('id', true)
    .maybeSingle()
  if (nrError) throw new Error(`newroutes_config: ${nrError.message}`)
  if (nr?.enabled) {
    const within =
      new Date(nr.signup_start).getTime() <= upcoming.getTime() &&
      new Date(nr.signup_end).getTime() >= wrap.getTime()
    if (within) {
      const p = unlockFrom('NEWROUTES', nr)
      if (p) out.push(p)
    }
  }

  return out
}

/** Everything promotable in the window. Throws; index.ts is what catches. */
export async function loadPromotables(now: Date): Promise<Promotable[]> {
  const [{ items, lastSeeded }, unlocks] = await Promise.all([fetchFlagships(now), fetchUnlocks(now)])
  return [...items, ...synthesizeWalkRideDays(now, lastSeeded, HORIZON_UPCOMING_DAYS), ...unlocks]
}
