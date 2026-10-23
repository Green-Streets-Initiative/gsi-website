import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import HostFollowCard from '@/components/hosts/HostFollowCard'
import FixListingLink from '@/components/hosts/FixListingLink'
import '@/components/events/events-tone.css'
import OrganizerChannels from '@/components/rides/OrganizerChannels'
import { loadHostPage, hostPath } from '@/lib/hosts'
import { eventPath } from '@/lib/events-url'
import { formatTime, getTagMeta, getTypeMeta, parseEventDate } from '@/lib/events'
import { SITE_URL } from '@/lib/seo'
import type { CommunityEvent } from '@/lib/events'

/**
 * A host's page: every walk and ride a group has coming up, how to follow
 * them, and a way to correct anything. Built from the group's own public
 * posts; no account. Only hosts that run often get one (see lib/hosts.ts).
 */
export const revalidate = 1800

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const page = await loadHostPage(decodeURIComponent(slug))
  if (!page) return { title: 'Host not found', robots: { index: false } }
  const { host, upcoming } = page
  const description = host.description?.slice(0, 160)
    || `${upcoming.length > 0 ? `${upcoming.length} upcoming` : 'Recent'} group rides and walks with ${host.name}. Add them to your calendar or join one.`
  return {
    title: `${host.name}: group rides and walks`,
    description,
    alternates: { canonical: hostPath(host.id) },
    openGraph: { title: `${host.name} on the walk and bike calendar`, description, url: hostPath(host.id) },
  }
}

function monthDay(d: string) {
  const dt = parseEventDate(d)
  return {
    wk: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    md: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

function EventRow({ ev }: { ev: CommunityEvent }) {
  const { wk, md } = monthDay(ev.event_date)
  const time = ev.event_time ? formatTime(ev.event_time) : null
  const place = ev.location_name && ev.location_name !== 'See event page for details' ? ev.location_name : null
  return (
    <li>
      <Link href={eventPath(ev)} className="flex gap-4 rounded-2xl border border-(--ev-line) bg-(--ev-card) px-4 py-3 transition-colors hover:border-(--ev-line-stronger)">
        <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-(--ev-panel) py-1.5">
          <span className="text-[12px] font-semibold text-(--ev-ink-75)">{wk}</span>
          <span className="text-[15px] font-bold text-(--ev-ink)">{md}</span>
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug text-(--ev-ink)">{ev.title}</p>
          <p className="mt-0.5 text-[14px] text-(--ev-ink-75)">
            {[getTypeMeta(ev.event_type).label, time, place].filter(Boolean).join(' · ')}
          </p>
        </div>
      </Link>
    </li>
  )
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await loadHostPage(decodeURIComponent(slug))
  if (!page) notFound()
  const { host, upcoming, recent, pastYearCount } = page

  const socials = Object.entries(host.social_links ?? {}).filter(([, u]) => typeof u === 'string' && /^https?:\/\//.test(u))
  const noDrop = host.rides_no_drop === true || host.ride_tags.includes('no_drop')
  const chips = [noDrop ? 'No-drop' : null, ...host.ride_tags.filter((t) => t !== 'no_drop').map((t) => getTagMeta(t).label)].filter(Boolean) as string[]
  const pageUrl = `${SITE_URL}${hostPath(host.id)}`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: host.name,
    url: host.url ?? pageUrl,
    ...(host.description ? { description: host.description } : {}),
    ...(socials.length ? { sameAs: socials.map(([, u]) => u) } : {}),
    event: upcoming.slice(0, 10).map((ev) => ({
      '@type': 'Event',
      name: ev.title,
      startDate: ev.event_time ? `${ev.event_date}T${ev.event_time.slice(0, 5)}` : ev.event_date,
      url: `${SITE_URL}${eventPath(ev)}`,
      ...(ev.location_name ? { location: { '@type': 'Place', name: ev.location_name, address: ev.location_address ?? ev.location_name } } : {}),
    })),
  }

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <div className={`min-h-screen bg-(--ev-bg) px-4 pb-24 pt-6 sm:px-8 sm:pt-10 events-tone events-tone-light`}>
          <div className="mx-auto max-w-[1040px]">
            <Link href="/events" className="text-[14px] font-semibold text-(--ev-accent) hover:underline">All events</Link>

            {host.logo_url && /^https:\/\//.test(host.logo_url) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={host.logo_url} alt="" className="mt-4 h-20 w-auto max-w-[240px] rounded-lg object-contain" />
            )}
            <h1 className="mt-3 font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-[1.08] tracking-tight text-(--ev-ink)">
              {host.name}
            </h1>
            <p className="mt-2 text-[15px] font-medium text-(--ev-ink-80)">
              {upcoming.length > 0
                ? `${upcoming.length} upcoming on the calendar`
                : 'Nothing on the calendar right now'}
              {pastYearCount > 0 ? ` · ${pastYearCount} in the past year` : ''}
            </p>
            {host.description && <p className="mt-3 max-w-[720px] text-[15px] leading-relaxed text-(--ev-ink-80)">{host.description}</p>}

            {chips.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {chips.map((c) => (
                  <span key={c} className="rounded-full bg-(--ev-accent-tint-15) px-3 py-1 text-[14px] font-semibold text-(--ev-accent)">{c}</span>
                ))}
              </div>
            )}
            {/* The same channel buttons as their rides' pages. */}
            <OrganizerChannels links={host.social_links ?? {}} website={host.url} className="mt-4" />

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">

              <section className="lg:col-start-1 lg:row-start-1" aria-labelledby="up-h">
                <h2 id="up-h" className="font-display text-[22px] font-extrabold text-(--ev-ink)">Coming up</h2>
                {upcoming.length === 0 ? (
                  <p className="mt-2 text-[15px] text-(--ev-ink-75)">
                    Nothing scheduled yet. Follow the calendar on the right and new dates show up on their own.
                  </p>
                ) : (
                  <ol className="mt-3 space-y-2">{upcoming.slice(0, 20).map((ev) => <EventRow key={ev.id} ev={ev} />)}</ol>
                )}
                {upcoming.length > 20 && (
                  <p className="mt-3 text-[14px] text-(--ev-ink-75)">Plus {upcoming.length - 20} more. The calendar feed has them all.</p>
                )}
              </section>

              <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
                <HostFollowCard hostId={host.id} hostName={host.name} />
              </aside>

              {recent.length > 0 && (
                <section className="lg:col-start-1" aria-labelledby="past-h">
                  <h2 id="past-h" className="font-display text-[22px] font-extrabold text-(--ev-ink)">Recently</h2>
                  <ol className="mt-3 space-y-2">{recent.map((ev) => <EventRow key={ev.id} ev={ev} />)}</ol>
                </section>
              )}
            </div>

            <div className="mt-10 border-t border-(--ev-line) pt-6">
              <FixListingLink host={{ id: host.id, name: host.name }} />
            </div>
          </div>
        </div>
      </main>
      <Footer variant="light" />
    </>
  )
}
