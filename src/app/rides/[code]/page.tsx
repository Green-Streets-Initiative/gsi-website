import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import RidePage from '@/components/rides/RidePage'
import AppOnlyRidePage from '@/components/rides/AppOnlyRidePage'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { looksLikeRideCode, scheduleText, type RideLookup } from '@/lib/rides/public'

/**
 * A Shift group ride's public page: the link organizers put in their
 * Instagram bio, Partiful post or group chat. Anyone can say Going / Maybe /
 * Can't go here without the app, and the page always shows the latest from
 * the organizer. Fresh on every request so "is it still on?" is never stale.
 */
export const dynamic = 'force-dynamic'

async function loadRide(code: string): Promise<RideLookup | null> {
  if (!looksLikeRideCode(code)) return null
  const { data, error } = await createServerSupabaseClient().rpc('get_ride_public', { p_code: code })
  if (error) {
    console.error('get_ride_public error:', error)
    return null
  }
  return (data as RideLookup | null) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const ride = await loadRide(code)
  if (!ride) return { title: 'Ride not found', robots: { index: false } }
  if (!ride.web) return { title: ride.name, robots: { index: false } }
  const where = ride.meetup_name ? ` from ${ride.meetup_name}` : ''
  const description = ride.description?.slice(0, 160) || `${scheduleText(ride)}${where}. RSVP here, no app needed.`
  return {
    title: ride.name,
    description,
    // Invite-only rides are shared by link; only public rides belong in search.
    robots: ride.visibility === 'public' && ride.status === 'active' ? undefined : { index: false, follow: false },
    alternates: { canonical: `/rides/${ride.code}` },
    openGraph: {
      title: ride.name,
      description,
      url: `/rides/${ride.code}`,
      ...(ride.flyer_url ? { images: [{ url: ride.flyer_url }] } : {}),
    },
  }
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const ride = await loadRide(code)
  if (!ride) notFound()

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        {ride.web ? <RidePage ride={ride} /> : <AppOnlyRidePage ride={ride} />}
      </main>
      <Footer variant="light" />
    </>
  )
}
