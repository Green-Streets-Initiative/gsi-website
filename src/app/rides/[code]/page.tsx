import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import RidePage from '@/components/rides/RidePage'
import AppOnlyRidePage from '@/components/rides/AppOnlyRidePage'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { looksLikeRideCode, scheduleText, type RideLookup } from '@/lib/rides/public'
import { rideExtras } from '@/lib/rides/host'

/**
 * A Shift group ride's public page: the link organizers put in their
 * Instagram bio, Partiful post or group chat. Anyone can say Going / Maybe /
 * Can't go here without the app, and the page always shows the latest from
 * the organizer. Fresh on every request so "is it still on?" is never stale.
 */
export const dynamic = 'force-dynamic'

async function loadRide(code: string, date: string | null = null): Promise<RideLookup | null> {
  if (!looksLikeRideCode(code)) return null
  // With a date (a calendar listing's ?date=), the lookup includes that date
  // even when it's past the first eight (Shift 01564).
  const { data, error } = await createServerSupabaseClient().rpc('get_ride_public', date ? { p_code: code, p_date: date } : { p_code: code })
  if (error) {
    console.error('get_ride_public error:', error)
    return null
  }
  return (data as RideLookup | null) ?? null
}

type Search = Promise<{ date?: string | string[] }>
const dateParam = (v: string | string[] | undefined) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export async function generateMetadata({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Search }): Promise<Metadata> {
  const { code } = await params
  // A link to one date (from its calendar listing) previews that date's own name and description.
  const want = dateParam((await searchParams).date)
  const ride = await loadRide(code, want)
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
  if (!ride) notFound()

  // Who runs it (logo, channels, their calendar page) and the route's climbing.
  const extras = ride.web ? await rideExtras(ride.id).catch(() => null) : null

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {ride.web ? <RidePage ride={ride} host={extras?.host ?? null} ascentFt={extras?.ascentFt ?? null} initialDate={initialDate} /> : <AppOnlyRidePage ride={ride} />}
      </main>
      <Footer variant="light" />
    </>
  )
}
