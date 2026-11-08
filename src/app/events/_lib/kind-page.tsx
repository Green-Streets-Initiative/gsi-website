import 'server-only'
import { cache, type ReactNode } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import '@/components/events/events-tone.css'
import { EventsToneProvider } from '@/components/events/EventsTone'
import KindEventList, { type KindSection } from '@/components/events/KindEventList'
import { KindPageAlertSignup } from '@/components/events/EventAlertSignup'
import KindChips from '@/components/events/KindChips'
import { type CommunityEvent, dateMedium, parseEventDate } from '@/lib/events'
import { todayEt } from '@/lib/events-next'
import { buildEventJsonLd } from '@/lib/events-seo'
import { SITE_URL } from '@/lib/seo'
import {
  type EventKindSlug, type KindFacts, eventKind, kindPath, inKind, kindFacts, nearBoston, weekendDays, weekendDay,
  BOSTON, BOSTON_MILES, ALERT_MILES,
} from '@/lib/event-kinds'
import { loadKindEvents } from './load'

/**
 * The kind pages (/events/group-rides, /events/walking-groups,
 * /events/bike-repair, /events/this-weekend): server-rendered, one search in
 * mind each, with a short answer block counted from the listings, the
 * calendar's own cards split around Boston / elsewhere, ItemList markup and
 * the weekly email box. See src/lib/event-kinds.ts for what counts as each
 * kind. English only (the calendar itself is translated).
 */

/** Cards a section shows before "See all on the calendar". */
const SECTION_MAX = 25
/** Events in the ItemList markup. */
const JSON_LD_MAX = 30

interface Loaded {
  events: { event: CommunityEvent; day: string }[]
  facts: KindFacts
  boston: number
  weekend: string[] | null
}

const load = cache(async (slug: EventKindSlug): Promise<Loaded> => {
  const kind = eventKind(slug)
  const weekend = slug === 'this-weekend' ? weekendDays(todayEt()) : null
  const rows = await loadKindEvents(weekend
    ? { from: weekend[0], to: weekend[weekend.length - 1], limit: 300 }
    : { types: kind.types, limit: 200 })
  const events = rows
    .filter((ev) => ev.schedule_status !== 'cancelled' && inKind(slug, ev, weekend ?? undefined))
    .map((event) => ({ event, day: weekend ? weekendDay(event, weekend)! : event.event_date }))
    .sort((a, b) => a.day.localeCompare(b.day) || (a.event.event_time ?? '').localeCompare(b.event.event_time ?? ''))
  const list = events.map((e) => e.event)
  return { events, facts: kindFacts(list), boston: list.filter(nearBoston).length, weekend }
})

/** "Sat, Nov 14 and Sun, Nov 15" */
function daysPhrase(days: string[]): string {
  const d = days.map((x) => dateMedium(parseEventDate(x)))
  return d.length <= 2 ? d.join(' and ') : `${d.slice(0, -1).join(', ')} and ${d[d.length - 1]}`
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

interface Copy {
  title: string
  description: string
  h1: string
  lede: string
  /** Shown under the H1: the count, in words. */
  countLine: string
  answers: { q: string; a: ReactNode }[]
  areaTitle: [string, string]
  empty: string
  allLabel: string
}

function copyFor(slug: EventKindSlug, { facts: f, boston, weekend }: Loaded): Copy {
  const n = f.total
  const unknown = Math.max(0, n - f.free - f.paid)
  const freeLine = (thing: string) => n === 0
    ? `The page for each ${thing} says whether it costs anything.`
    : `${f.free} of ${n} ${n === 1 ? 'is' : 'are'} marked free${f.paid ? `, ${f.paid} ${f.paid === 1 ? 'charges' : 'charge'} a fee` : ''}.${unknown === 1 ? ' One doesn\'t say, so check its listing.' : unknown ? ' The rest don\'t say, so check the listing.' : ''}`
  const signUp = f.signUpFirst === 1
    ? ' One asks you to sign up first; its page links to the form.'
    : f.signUpFirst ? ` ${f.signUpFirst} ask you to sign up first; their pages link to the form.` : ''

  switch (slug) {
    case 'group-rides': {
      const paces = [
        f.easy ? `${f.easy} easy (social pace, new riders welcome)` : null,
        f.moderate ? `${f.moderate} moderate (a steady pace with some distance)` : null,
        f.rec ? `${f.rec} faster club or gravel rides` : null,
      ].filter(Boolean)
      return {
        title: 'Group bike rides in Boston: easy, no-drop and club rides',
        description: n
          ? `${plural(n, 'group ride')} coming up around Boston and across Massachusetts, from easy social rides to club paces. See where each starts, its pace and who leads it.`
          : 'Group bike rides around Boston and across Massachusetts, from easy social rides to club paces. See where each starts, its pace and who leads it.',
        h1: 'Group bike rides in Boston',
        lede: 'Rides anyone can join, around Boston and across Massachusetts, from easy social rides to faster club paces.',
        countLine: n ? `${plural(n, 'ride')} coming up · ${boston} around Boston` : 'Nothing on the calendar right now',
        answers: [
          { q: 'Are they free?', a: freeLine('ride') },
          { q: 'How fast do they go?', a: paces.length ? `${paces.join(', ')}. Each card shows the level, and the length when the host gives one.` : 'Each ride\'s page gives its pace and distance when the host does.' },
          { q: 'Will I get left behind?', a: f.noDrop ? `${plural(f.noDrop, 'ride says', 'rides say')} no-drop: the group waits, so nobody rides alone. Look for the No-drop tag.` : 'Look for "no-drop" on a ride\'s page: the group waits, so nobody rides alone.' },
          { q: 'How do I join?', a: `Open a ride, then show up at the start a few minutes early with a bike in working order.${signUp}` },
        ],
        areaTitle: ['Around Boston', 'Elsewhere in Massachusetts'],
        empty: 'No group rides on the calendar right now. New ones show up here as hosts post them.',
        allLabel: 'See every group ride on the calendar',
      }
    }
    case 'walking-groups':
      return {
        title: 'Walking groups near Boston: weekly group walks and tours',
        description: n
          ? `${plural(n, 'group walk')} coming up around Boston and across Massachusetts: weekly walking groups, nature walks and walking tours, with the meeting point, time and host.`
          : 'Weekly walking groups, nature walks and walking tours around Boston and across Massachusetts, with the meeting point, time and host.',
        h1: 'Walking groups near Boston',
        lede: 'Weekly walking groups, nature walks and walking tours you can join, around Boston and across Massachusetts.',
        countLine: n ? `${plural(n, 'walk')} coming up · ${boston} around Boston` : 'Nothing on the calendar right now',
        answers: [
          { q: 'Are they free?', a: freeLine('walk') },
          { q: 'Are they for beginners?', a: f.beginner ? `${f.beginner} of ${n} are marked beginner-friendly. A walk's page gives the route and length when the host does.` : 'A walk\'s page gives the route and length when the host does.' },
          { q: 'How do I join?', a: `Show up at the meeting point a few minutes early, in shoes you can walk in.${signUp}` },
          { q: 'Who runs them?', a: f.hosts ? `${plural(f.hosts, 'group')}: walking clubs, councils on aging, land trusts, parks and neighbors. Each card names the host.` : 'Walking clubs, councils on aging, land trusts and parks. Each card names the host.' },
        ],
        areaTitle: ['Around Boston', 'Elsewhere in Massachusetts'],
        empty: 'No group walks on the calendar right now. New ones show up here as hosts post them.',
        allLabel: 'See every group walk on the calendar',
      }
    case 'bike-repair':
      return {
        title: 'Free bike repair near Boston: open shops and workshops',
        description: n
          ? `${plural(n, 'bike repair night')} and open shops coming up in Massachusetts${f.free === n ? ', all free' : `, ${f.free} of them free`}. Bring your bike, use the tools and get help fixing it.`
          : 'Bike repair nights and open shops in Massachusetts. Bring your bike, use the tools and get help fixing it.',
        h1: 'Free bike repair near Boston',
        lede: 'Open shops, repair workshops and flat-fixing nights where you fix your bike with tools and help on hand.',
        countLine: n ? `${plural(n, 'session')} coming up · ${boston} around Boston` : 'Nothing on the calendar right now',
        answers: [
          { q: 'Is it free?', a: freeLine('session') },
          { q: 'Do they fix it for me?', a: 'Usually you work on your own bike with their tools and someone to show you how. Some have a mechanic for quick fixes; the listing says.' },
          { q: 'What do I bring?', a: 'Your bike, and the part if you bought one. Parts may cost something; the listing says.' },
          { q: 'How do I join?', a: `Open one for the hours, the address and whether to sign up.${signUp}` },
        ],
        areaTitle: ['Around Boston', 'Elsewhere in Massachusetts'],
        empty: 'No bike repair sessions on the calendar right now. New ones show up here as shops post them.',
        allLabel: 'See every bike repair session on the calendar',
      }
    case 'this-weekend': {
      const days = daysPhrase(weekend ?? [])
      const other = Math.max(0, n - f.rides - f.walks - f.repair)
      const mix = [
        f.rides ? plural(f.rides, 'group ride') : null,
        f.walks ? plural(f.walks, 'walk') : null,
        f.repair ? plural(f.repair, 'bike repair session') : null,
        other ? plural(other, 'other event') : null,
      ].filter(Boolean) as string[]
      const mixLine = mix.length > 1 ? `${mix.slice(0, -1).join(', ')} and ${mix[mix.length - 1]}` : mix[0] ?? ''
      return {
        title: 'Boston events this weekend: group walks, bike rides and more',
        description: n
          ? `${plural(n, 'walk, ride and community event', 'walks, rides and community events')} this weekend (${days}) around Boston and across Massachusetts, with times, places and who's hosting.`
          : `Walks, rides and community events this weekend (${days}) around Boston and across Massachusetts, with times, places and who's hosting.`,
        h1: 'This weekend around Boston',
        lede: `Group walks, bike rides and community events for ${days}, around Boston and across Massachusetts.`,
        countLine: n ? `${plural(n, 'event')} · ${boston} around Boston` : 'Nothing on the calendar yet',
        answers: [
          { q: 'What\'s on?', a: n ? `${mixLine}, from ${plural(f.hosts, 'host')}.` : 'Nothing posted yet for this weekend. Hosts add events all week.' },
          { q: 'Is it free?', a: freeLine('event') },
          { q: 'How close to Boston?', a: n ? `${boston} of ${n} are within ${BOSTON_MILES} miles of downtown Boston; the rest are elsewhere in Massachusetts.` : `Events within ${BOSTON_MILES} miles of downtown Boston are listed first.` },
          { q: 'How do I join?', a: `Open any event for its time, place and how to join.${signUp}` },
        ],
        areaTitle: ['Around Boston', 'Elsewhere in Massachusetts'],
        empty: 'Nothing posted for this weekend yet. Hosts add events all week, so check back, or see what\'s coming up on the calendar.',
        allLabel: 'See this weekend on the calendar',
      }
    }
  }
}

export async function kindMetadata(slug: EventKindSlug): Promise<Metadata> {
  const c = copyFor(slug, await load(slug))
  const url = `${SITE_URL}${kindPath(slug)}`
  return {
    title: c.title,
    description: c.description,
    alternates: { canonical: url },
    openGraph: { title: c.title, description: c.description, url, siteName: 'Green Streets Initiative' },
    twitter: { card: 'summary_large_image', title: c.title, description: c.description },
  }
}

export async function KindPage({ slug }: { slug: EventKindSlug }) {
  const kind = eventKind(slug)
  const loaded = await load(slug)
  const c = copyFor(slug, loaded)
  const near = loaded.events.filter((e) => nearBoston(e.event))
  const far = loaded.events.filter((e) => !nearBoston(e.event))
  const section = (id: string, title: string, items: typeof near): KindSection => ({
    id,
    title,
    items: items.slice(0, SECTION_MAX),
    more: { count: items.length - SECTION_MAX, href: kind.calendarHref, label: `${plural(items.length - SECTION_MAX, 'more')} on the calendar` },
  })
  const sections = [
    near.length ? section('boston', c.areaTitle[0], near) : null,
    far.length ? section('elsewhere', near.length ? c.areaTitle[1] : 'In Massachusetts', far) : null,
  ].filter((s): s is KindSection => !!s)

  const url = `${SITE_URL}${kindPath(slug)}`
  const listed = sections.flatMap((s) => s.items.map((i) => i.event)).slice(0, JSON_LD_MAX)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: c.h1,
    url,
    numberOfItems: listed.length,
    itemListElement: listed.map((ev, i) => {
      const { ['@context']: _ctx, ...item } = buildEventJsonLd(ev)
      void _ctx
      return { '@type': 'ListItem', position: i + 1, item }
    }),
  }

  const alertNear = kind.alertSummary.includes('Boston')
    ? { lat: Number(BOSTON.lat.toFixed(3)), lng: Number(BOSTON.lng.toFixed(3)), place: BOSTON.label, dist: ALERT_MILES }
    : null
  const signup = (id: string, cls: string) => (
    <KindPageAlertSignup id={id} kind={slug} type={kind.alertType} near={alertNear} summary={kind.alertSummary} className={cls} />
  )

  return (
    <>
      <Nav variant="light" />
      <main className="bg-cream" style={{ paddingTop: '60px' }}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <EventsToneProvider tone="light" locale="en">
          <div className="min-h-screen bg-(--ev-bg) px-4 pb-24 pt-6 sm:px-8 sm:pt-10 events-tone events-tone-light">
            <div className="mx-auto max-w-[1040px]">
              <Link href="/events" className="text-[14px] font-semibold text-(--ev-accent) hover:underline">All events</Link>
              <h1 className="mt-3 font-serif text-[clamp(2.25rem,5vw,3.25rem)] font-normal leading-[1.06] tracking-[-0.01em] text-navy">
                {c.h1}
              </h1>
              <p className="mt-3 max-w-[640px] text-[16px] leading-relaxed text-(--ev-ink-80)">{c.lede}</p>
              <p className="mt-2 text-[15px] font-semibold text-(--ev-ink)">{c.countLine}</p>

              <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {c.answers.map((a) => (
                  <div key={a.q} className="rounded-2xl border border-(--ev-line) bg-(--ev-card) p-4">
                    <dt className="text-[15px] font-bold text-(--ev-ink)">{a.q}</dt>
                    <dd className="mt-1 text-[15px] leading-relaxed text-(--ev-ink-80)">{a.a}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="min-w-0">
                  {sections.length === 0 ? (
                    <div className="rounded-2xl border border-(--ev-line) bg-(--ev-card) px-6 py-12 text-center">
                      <p className="text-[15px] text-(--ev-ink-75)">{c.empty}</p>
                      <Link href="/events" className="mt-3 inline-block text-[15px] font-semibold text-(--ev-accent) hover:underline">
                        See everything coming up
                      </Link>
                    </div>
                  ) : (
                    // On phones the email box follows the first area, not the whole list.
                    <KindEventList kind={slug} sections={sections} inset={signup('kind-alert', 'lg:hidden')} />
                  )}
                  {sections.length === 0 && signup('kind-alert', 'mt-8 lg:hidden')}
                  <p className="mt-8 text-[15px]">
                    <Link href={kind.calendarHref} className="font-semibold text-(--ev-accent) hover:underline">{c.allLabel}</Link>
                  </p>
                </div>
                <aside className="hidden lg:block">
                  <div className="sticky top-[84px]">{signup('kind-alert-side', '')}</div>
                </aside>
              </div>

              <KindChips current={slug} className="mt-12 border-t border-(--ev-line) pt-6" />
            </div>
          </div>
        </EventsToneProvider>
      </main>
      <Footer variant="light" />
    </>
  )
}
