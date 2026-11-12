import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import { BUTTON, CONTAINER, GSI_FONT, H3, SignHero } from '@/app/move-in/sign'
import { supabase } from '@/lib/supabase'
import { bigEventPath, bigEventWhen, loadBigEvent, loadBigEvents } from '@/lib/big-events'
import { feederPlace, isWalkGroup, shortOrganizer } from '@/lib/go-together'
import { eventHref } from '@/lib/events-url'
import { formatTime } from '@/lib/events'
import { getVenue } from '@/lib/venues'
import { Bicycle, CaretRight, PersonSimpleWalk } from '@phosphor-icons/react/dist/ssr'
import Facts from '@/components/Facts'

/*
 * gogreenstreets.org/going/<id>: one game or concert (Go Together phase 2,
 * Shift 01691). Not indexed: the venue page is the one people search for.
 * Says when it is, the group rides going (only when there are some), how to
 * get there (the venue page's facts) and what's next at the same place.
 * Phase 3 adds "I'm going" and the ride home.
 */

export const revalidate = 900

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const e = await loadBigEvent(supabase, decodeURIComponent((await params).id))
  if (!e || e === 'error') return { title: 'Green Streets Initiative', robots: { index: false } }
  return {
    title: `${e.title} at ${e.venue_name}: getting there | Green Streets Initiative`,
    description: `${bigEventWhen(e, { weekday: 'long' })} at ${e.venue_name}. Group rides going, the T, bikes and parking.`,
    robots: { index: false, follow: true },
  }
}

const BODY = 'text-[1.0625rem] leading-[1.6] text-navy'
const GHOST =
  'inline-flex min-h-[44px] items-center justify-center rounded-full border-2 border-navy/20 bg-white px-5 text-[0.9375rem] font-bold text-navy transition-colors hover:border-forest'

export default async function BigEventPage({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id)
  const e = await loadBigEvent(supabase, id)
  if (e === 'error') throw new Error('Could not load this event')
  if (!e) notFound()

  const venue = e.venue_slug ? getVenue(e.venue_slug) : null
  const more = venue ? (await loadBigEvents(supabase, venue.slug, 45)).filter((x) => x.id !== e.id).slice(0, 4) : []
  const past = new Date(e.starts_at).getTime() < Date.now() - 6 * 3600e3
  const planUrl = venue
    ? `/trip?to=${venue.lat},${venue.lng}&toName=${encodeURIComponent(venue.name)}`
    : null

  return (
    <div className="street min-h-screen bg-cream text-navy" style={{ fontFamily: GSI_FONT }}>
      <Nav variant="light" street />
      <SignHero
        title={e.title}
        lede={
          <p>
            {bigEventWhen(e, { weekday: 'long' })} at{' '}
            {venue ? (
              <Link href={`/parking/${venue.slug}`} className="font-bold underline underline-offset-4 hover:opacity-80">{e.venue_name}</Link>
            ) : e.venue_name}
            {!e.time_known && '. The start time isn’t set yet'}
            {e.status === 'postponed' && '. Postponed: check the team for the new date'}
            {e.status === 'canceled' && '. Canceled'}
            {past && e.status === 'scheduled' && '. This one has happened'}.
          </p>
        }
      />

      <div className={`${CONTAINER} flex flex-col gap-6 pb-16`}>
        {e.groups.length > 0 && !past && (
          <section aria-labelledby="groups-title" className="rounded-[20px] border-2 border-forest bg-white p-5 sm:p-6">
            {/* Same rows and words as the event page's Go Together (src/components/events/GoTogether.tsx). */}
            <h2 id="groups-title" className={H3}>Go Together</h2>
            <p className={`mt-1 ${BODY}`}>Meet a group near you and arrive together.</p>
            <ul className="mt-3 flex flex-col gap-1">
              {e.groups.map((g) => {
                const walk = isWalkGroup(g.event_type)
                const Icon = walk ? PersonSimpleWalk : Bicycle
                const details = [
                  g.event_time ? `Leaves ${formatTime(g.event_time)}` : null,
                  g.distance_text ? `${g.distance_text} ${walk ? 'walk' : 'ride'}` : null,
                ].filter((x): x is string => !!x)
                const organizer = shortOrganizer(g.organizer_name)
                return (
                  <li key={g.id}>
                    <Link href={eventHref(g)} className="flex min-h-[56px] items-center gap-3 rounded-[12px] px-2 py-2 transition-colors hover:bg-cream">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest/10 text-forest">
                        <Icon size={20} weight="bold" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[1.0625rem] font-bold text-navy">From {feederPlace(g.title, g.location_name)}</span>
                        {details.length > 0 && <span className="block text-[0.9375rem] text-navy/80"><Facts parts={details} /></span>}
                        {organizer && <span className="block truncate text-[0.9375rem] text-navy/80">{organizer}</span>}
                      </span>
                      <CaretRight size={18} weight="bold" aria-hidden className="shrink-0 text-navy/60" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {venue && (
          <section aria-labelledby="getting-title" className="rounded-[20px] bg-white p-5 sm:p-6">
            <h2 id="getting-title" className={H3}>Getting there</h2>
            <p className={`mt-1 ${BODY}`}>Live trains, bike docks and parking prices for {venue.name}.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {planUrl && <Link href={planUrl} className={BUTTON}>Plan your trip</Link>}
              <Link href={`/parking/${venue.slug}#transit`} className={GHOST}>{venue.shuttles ? 'Shuttles and the T' : 'The T'}</Link>
              <Link href={`/parking/${venue.slug}#bike`} className={GHOST}>{venue.walk ? 'Bike or walk' : venue.bikes ? 'Bike or rideshare' : 'Rideshare'}</Link>
              <Link href={`/parking/${venue.slug}#garages`} className={GHOST}>Parking</Link>
            </div>
          </section>
        )}

        {more.length > 0 && (
          <section aria-labelledby="more-title">
            <h2 id="more-title" className={H3}>Next at {e.venue_name}</h2>
            <ul className="mt-3 divide-y divide-navy/10 rounded-[20px] bg-white px-5 sm:px-6">
              {more.map((m) => (
                <li key={m.id}>
                  <Link href={bigEventPath(m)} className="flex min-h-[56px] items-center gap-3 py-3 hover:opacity-80">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[1.0625rem] font-bold text-navy">{m.title}</span>
                      <span className="block text-[0.9375rem] text-navy/80">{bigEventWhen(m)}</span>
                    </span>
                    <CaretRight size={18} weight="bold" aria-hidden className="shrink-0 text-navy/60" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <Footer />
    </div>
  )
}
