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
  /**
   * The organizer as their Shift profile names them ("Keith A.", or "Shift
   * member" for a private profile), so a ride without a verified
   * organization still says who's hosting it (Keith 2026-11-06).
   */
  person: string | null
  ascentFt: number | null
  /** How the ride's own route rides, street by street (the planner's comfort tiers), for the ride page's comfort bar. */
  comfortSegments: { label: string; rating: string; distance_mi: number }[] | null
  /** Language codes the ride is led in (ride_series.languages, Shift 01697). */
  languages: string[]
}

export async function rideExtras(rideId: string): Promise<RideExtras> {
  const db = createServerSupabaseClient()
  const { data: s } = await db.from('ride_series').select('organizer_user_id, event_organizer_id, org_verification_status, route_elevation, comfort_segments, languages').eq('id', rideId).maybeSingle()
  const row = s as { organizer_user_id: string | null; event_organizer_id: string | null; org_verification_status: string | null; route_elevation: { ascent_ft?: number } | null; comfort_segments: unknown; languages: string[] | null } | null
  const languages = row?.languages ?? []
  const ascent = typeof row?.route_elevation?.ascent_ft === 'number' ? Math.round(row.route_elevation.ascent_ft) : null
  const comfortSegments = Array.isArray(row?.comfort_segments) && row.comfort_segments.length
    ? (row.comfort_segments as { label: string; rating: string; distance_mi: number }[]) : null
  // The same name the ride's people list shows for them (_ride_member_name).
  const person = row?.organizer_user_id
    ? await db.rpc('_ride_member_name', { p_user_id: row.organizer_user_id, p_guest_id: null })
      .then(({ data }) => (typeof data === 'string' && data.trim() ? data.trim() : null), () => null)
    : null
  // The organization's name, logo and links only once the organizer's claim
  // on it is verified (Shift 01563: automatic when their email domain matches
  // its website). Before that anyone could post a ride as any group.
  const orgId = row?.org_verification_status === 'verified' ? row.event_organizer_id : null
  if (!orgId) return { host: null, person, ascentFt: ascent, comfortSegments, languages }
  const [{ data: o }, qualifies] = await Promise.all([
    db.from('event_organizers').select('id, name, url, logo_url, social_links, status').eq('id', orgId).maybeSingle(),
    hostQualifies(orgId).catch(() => false),
  ])
  const org = o as { id: string; name: string; url: string | null; logo_url: string | null; social_links: Record<string, string> | null; status: string | null } | null
  if (!org) return { host: null, person, ascentFt: ascent, comfortSegments, languages }
  const links = Object.fromEntries(Object.entries(org.social_links ?? {}).filter(([, u]) => typeof u === 'string' && /^https:\/\/\S+$/i.test(u)))
  // The host page only opens for an active organization (loadHostPage); an
  // organizer's own new one is still pending_review, so no link to a 404.
  const linkable = qualifies && org.status === 'active'
  return {
    host: { id: org.id, name: org.name, url: org.url, logo_url: org.logo_url, social_links: links, href: linkable ? hostPath(org.id) : null },
    person,
    ascentFt: ascent,
    comfortSegments,
    languages,
  }
}

/**
 * Who to name as the host: the verified organization, else the organizer by
 * their profile name. A private profile reads "a Shift member" in a sentence;
 * `print` drops it where a bare label would read oddly (flyer, share card).
 */
export function hostLabel(extras: Pick<RideExtras, 'host' | 'person'> | null, print = false): string | null {
  if (extras?.host?.name) return extras.host.name
  const p = extras?.person ?? null
  if (!p) return null
  if (p === 'Shift member') return print ? null : 'a Shift member'
  return p
}
