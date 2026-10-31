import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { hostPath, hostQualifies } from '@/lib/hosts'

/**
 * Who runs a Shift ride, for its public page, flyer and share card: the
 * organizer's record (event_organizers, the same one behind the events
 * calendar's host pages) with its logo and channels, plus the route's
 * climbing, which the ride's public read leaves out. One read for all three
 * surfaces so they can't disagree about the organizer.
 */

export interface RideHost {
  id: string
  name: string
  url: string | null
  logo_url: string | null
  social_links: Record<string, string>
  /** Their page on the events calendar, when they run enough to have one. */
  href: string | null
}

export interface RideExtras {
  host: RideHost | null
  ascentFt: number | null
}

export async function rideExtras(rideId: string): Promise<RideExtras> {
  const db = createServerSupabaseClient()
  const { data: s } = await db.from('ride_series').select('event_organizer_id, org_verification_status, route_elevation').eq('id', rideId).maybeSingle()
  const row = s as { event_organizer_id: string | null; org_verification_status: string | null; route_elevation: { ascent_ft?: number } | null } | null
  const ascent = typeof row?.route_elevation?.ascent_ft === 'number' ? Math.round(row.route_elevation.ascent_ft) : null
  // The organization's name, logo and links only once the organizer's claim
  // on it is verified (Shift 01563: automatic when their email domain matches
  // its website). Before that anyone could post a ride as any group.
  const orgId = row?.org_verification_status === 'verified' ? row.event_organizer_id : null
  if (!orgId) return { host: null, ascentFt: ascent }
  const [{ data: o }, qualifies] = await Promise.all([
    db.from('event_organizers').select('id, name, url, logo_url, social_links').eq('id', orgId).maybeSingle(),
    hostQualifies(orgId).catch(() => false),
  ])
  const org = o as { id: string; name: string; url: string | null; logo_url: string | null; social_links: Record<string, string> | null } | null
  if (!org) return { host: null, ascentFt: ascent }
  const links = Object.fromEntries(Object.entries(org.social_links ?? {}).filter(([, u]) => typeof u === 'string' && /^https:\/\/\S+$/i.test(u)))
  return {
    host: { id: org.id, name: org.name, url: org.url, logo_url: org.logo_url, social_links: links, href: qualifies ? hostPath(org.id) : null },
    ascentFt: ascent,
  }
}
