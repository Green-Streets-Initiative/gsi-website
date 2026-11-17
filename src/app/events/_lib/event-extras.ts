import 'server-only'
import type { CommunityEvent } from '@/lib/events'
import { townFromAddress } from '@/lib/events-seo'
import { getEventRoams } from '@/lib/roams/queries'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { hostPath, hostQualifies } from '@/lib/hosts'
import { getQualifyingTowns } from '@/lib/towns/queries'
import { loadGoTogether } from './go-together'

/**
 * What an event page shows beside the event itself: the trails it shares a
 * route with, its host's page, its town's page, the groups going together,
 * and the Shift ride it comes from. Shared by the dated page (/events/<slug>)
 * and the series page (/events/series/...), which shows the next date.
 */
export async function loadEventExtras(event: CommunityEvent, organizerId: string | null) {
  // The town in the address, when it has a published town page. Event visitors
  // from search reach the app at 0.6% from the event page and 6.3% from a town
  // page, so the page sends them there (exp-2026-11-1). Only Massachusetts
  // towns publish, so a same-named town elsewhere never matches.
  const townName = townFromAddress(event.location_address)
  const supabase = createServerSupabaseClient()
  const [roamLinks, hasHostPage, towns, goTogether, ride, organizer] = await Promise.all([
    getEventRoams(event.id),
    organizerId ? hostQualifies(organizerId) : Promise.resolve(false),
    townName ? getQualifyingTowns() : Promise.resolve([]),
    loadGoTogether(supabase, event.id),
    // A ride planned in Shift takes RSVPs on its own page (/rides/<code>).
    event.ride_series_id
      ? supabase.from('ride_series').select('invite_code, kind, status').eq('id', event.ride_series_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // The host's logo for the host card (event_organizers.logo_url).
    organizerId
      ? supabase.from('event_organizers').select('logo_url').eq('id', organizerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const townMatch = townName ? towns.find((t) => t.town_name.toLowerCase() === townName.toLowerCase()) : undefined
  const rideRow = ride.data as { invite_code: string | null; kind: string; status: string } | null
  return {
    roamLinks,
    hostHref: hasHostPage && organizerId ? hostPath(organizerId) : null,
    town: townMatch ? { name: townMatch.town_name, href: `/shift/towns/${townMatch.slug}` } : null,
    goTogether,
    rideCode: rideRow?.kind === 'group_ride' && rideRow.status === 'active' ? rideRow.invite_code : null,
    hostLogo: ((organizer.data as { logo_url: string | null } | null)?.logo_url) ?? null,
  }
}
