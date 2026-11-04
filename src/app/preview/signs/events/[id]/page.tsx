import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { SignScope } from '@/components/signs/Signs'
import EventSignView from '@/components/signs/EventSignView'
import { isPastEvent } from '@/lib/events-next'
import { buildEventJsonLd, townFromAddress } from '@/lib/events-seo'
import { loadEvent } from '@/app/events/_lib/load'
import { getEventRoams } from '@/lib/roams/queries'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { hostPath, hostQualifies } from '@/lib/hosts'
import { getQualifyingTowns } from '@/lib/towns/queries'

/**
 * Wayfinding prototype of the event page (site review, 2026-11-04). Same
 * loader, same h1 (the event title), same structured data as /events/[id].
 * Unlisted: /preview is noindex (preview/layout.tsx).
 */

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const loaded = await loadEvent(id)
  return { title: loaded ? `Preview: ${loaded.event.title}` : 'Event not found' }
}

export default async function SignsEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const loaded = await loadEvent(id)
  if (!loaded) notFound()
  const { event, nextUp, timezone, sponsorLinks, organizerId } = loaded

  const jsonLd = buildEventJsonLd(event, { timeZone: timezone })
  const townName = townFromAddress(event.location_address)
  const [roamLinks, hasHostPage, towns] = await Promise.all([
    getEventRoams(event.id),
    organizerId ? hostQualifies(organizerId) : Promise.resolve(false),
    townName ? getQualifyingTowns() : Promise.resolve([]),
  ])
  const hostHref = hasHostPage && organizerId ? hostPath(organizerId) : null
  const townMatch = townName ? towns.find((t) => t.town_name.toLowerCase() === townName.toLowerCase()) : undefined
  // In the prototype the town link goes to the town prototype, so both can be
  // looked at together.
  const town = townMatch ? { name: townMatch.town_name, href: `/preview/signs/towns/${townMatch.slug}` } : null
  let rideCode: string | null = null
  if (event.ride_series_id) {
    const { data } = await createServerSupabaseClient()
      .from('ride_series')
      .select('invite_code, kind, status')
      .eq('id', event.ride_series_id)
      .maybeSingle()
    if (data?.kind === 'group_ride' && data.status === 'active') rideCode = data.invite_code
  }

  // "Today" in Boston, so live arrivals only show on the day itself.
  const todayEt = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  return (
    <>
      <Nav variant="light" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SignScope>
        <main style={{ paddingTop: '60px' }}>
          <EventSignView
            event={event}
            nextUp={nextUp}
            isPast={isPastEvent(event.event_date, event.event_end_date)}
            isToday={event.event_date === todayEt}
            sponsorLinks={sponsorLinks}
            roamLinks={roamLinks}
            rideCode={rideCode}
            hostHref={hostHref}
            town={town}
          />
        </main>
      </SignScope>
      <Footer variant="light" />
    </>
  )
}
