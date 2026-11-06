import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import RidePage from '@/components/rides/RidePage'
import AppOnlyRidePage from '@/components/rides/AppOnlyRidePage'
import type { RideCoffeeInfo } from '@/components/rides/RideCoffee'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { looksLikeRideCode, scheduleText, type PublicRide, type RideLookup } from '@/lib/rides/public'
import { hostLabel, rideExtras } from '@/lib/rides/host'
import { bikePerksForPlaces } from '@/lib/server/bike-perks'
import { newInfraForPlaces } from '@/lib/server/new-infra'

/**
 * A Shift group ride's public page: the link organizers put in their
 * Instagram bio, Partiful post or group chat. Anyone can say Going / Maybe /
 * Can't go here without the app, and the page always shows the latest from
 * the organizer. Fresh on every request so "is it still on?" is never stale.
 */
export const dynamic = 'force-dynamic'

/** The ride, null when there is no such ride, or 'error' when the lookup
 *  itself failed: a hiccup must not tell someone their ride doesn't exist. */
async function loadRide(code: string, date: string | null = null): Promise<RideLookup | null | 'error'> {
  if (!looksLikeRideCode(code)) return null
  try {
    // With a date (a calendar listing's ?date=), the lookup includes that date
    // even when it's past the first eight (Shift 01564).
    const { data, error } = await createServerSupabaseClient().rpc('get_ride_public', date ? { p_code: code, p_date: date } : { p_code: code })
    if (error) {
      console.error('get_ride_public error:', error)
      return 'error'
    }
    return (data as RideLookup | null) ?? null
  } catch (e) {
    console.error('get_ride_public threw:', e)
    return 'error'
  }
}

type Search = Promise<{ date?: string | string[] }>
const dateParam = (v: string | string[] | undefined) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export async function generateMetadata({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }): Promise<Metadata> {
  const { code } = await params
  // A link to one date (from its calendar listing) previews that date's own name and description.
  const want = dateParam((await searchParams).date)
  const ride = await loadRide(code, want)
  if (ride === 'error') return { title: 'Group ride', robots: { index: false } }
  if (!ride) return { title: 'Ride not found', robots: { index: false } }
  if (!ride.web) return { title: ride.name, robots: { index: false } }
  const day = want ? ride.occurrences.find((d) => d.date === want) : undefined
  const where = ride.meetup_name ? ` from ${ride.meetup_name}` : ''
  const description = (day?.description || ride.description)?.slice(0, 160) || `${scheduleText(ride)}${where}. RSVP here, no app needed.`
  const title = day?.title ? `${day.title} · ${ride.name}` : ride.name
  const flyer = day?.flyer_url || ride.flyer_url
  return {
    title,
    description,
    // Invite-only rides are shared by link; only public rides belong in search.
    robots: ride.visibility === 'public' && ride.status === 'active' ? undefined : { index: false, follow: false },
    alternates: { canonical: `/rides/${ride.code}` },
    openGraph: {
      title,
      description,
      url: `/rides/${ride.code}`,
      ...(flyer ? { images: [{ url: flyer }] } : {}),
    },
  }
}

export default async function Page({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }) {
  const { code } = await params
  const initialDate = dateParam((await searchParams).date)
  const ride = await loadRide(code, initialDate)
  if (ride === 'error') return <CouldNotLoad href={`/rides/${encodeURIComponent(code)}${initialDate ? `?date=${initialDate}` : ''}`} />
  if (!ride) notFound()

  // Who runs it (logo, channels, their calendar page) and the route's climbing;
  // the Bicycle Benefits members by any of its meeting spots or routes; and
  // what's new on each of its routes (or by each meeting spot).
  // Plus where it ends and who buys the coffee there (Ride Fund, Shift 01596).
  const [extras, perks, newInfra, coffee] = ride.web
    ? await Promise.all([rideExtras(ride.id).catch(() => null), bikePerksForPlaces(ridePlaces(ride)).catch(() => []), newInfraForPlaces(ridePlaces(ride)), rideCoffee(ride.code)])
    : [null, [], [], null]

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {ride.web ? <RidePage ride={ride} host={extras?.host ?? null} hostPerson={hostLabel(extras)} ascentFt={extras?.ascentFt ?? null} comfort={extras?.comfortSegments ?? null} initialDate={initialDate} perks={perks} newInfra={newInfra} coffee={coffee} /> : <AppOnlyRidePage ride={ride} />}
      </main>
      <Footer variant="light" />
    </>
  )
}

/** A missing coffee line is never worth a failed page. */
async function rideCoffee(code: string): Promise<RideCoffeeInfo | null> {
  try {
    const { data, error } = await createServerSupabaseClient().rpc('get_ride_coffee', { p_code: code })
    return error ? null : ((data as RideCoffeeInfo | null) ?? null)
  } catch {
    return null
  }
}

/** Each meeting spot and route the ride page can show: the ride's own and each date's. */
function ridePlaces(ride: PublicRide) {
  const pt = (lat: number | null, lng: number | null) => (lat != null && lng != null ? { lat, lng } : null)
  const line = (w: { lat: number; lng: number }[] | null | undefined) => (w ?? []).filter((p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng))
  return [
    { line: line(ride.route_waypoints), start: pt(ride.meetup_lat, ride.meetup_lng) },
    ...ride.occurrences.map((d) => ({
      line: line(d.own_route && d.route ? d.route.route_waypoints : ride.route_waypoints),
      start: pt(d.meetup_lat, d.meetup_lng),
    })),
  ]
}

/** The lookup failed (not "no such ride"): say so and offer the same page again. */
function CouldNotLoad({ href }: { href: string }) {
  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <div className="mx-auto max-w-[560px] px-4 py-16 sm:px-8">
          <h1 className="font-display text-[30px] font-extrabold leading-tight text-[#191A2E]">Couldn&rsquo;t load this ride</h1>
          <p className="mt-2 text-[16px] text-[#191A2E]/80">Something went wrong on our side. Try again in a moment.</p>
          {/* A full reload, so the lookup runs again. */}
          <a href={href} className="mt-6 inline-flex min-h-[46px] items-center rounded-[10px] bg-[#191A2E] px-5 text-[15px] font-bold text-white hover:opacity-90">
            Try again
          </a>
        </div>
      </main>
      <Footer variant="light" />
    </>
  )
}
