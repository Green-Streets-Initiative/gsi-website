import { createHash } from 'node:crypto'
import { unstable_cache } from 'next/cache'
import { loadKindEvents } from '@/app/events/_lib/load'
import { buildIcsFeed, calendarNotes } from '@/lib/event-calendar'
import { eventKind } from '@/lib/event-kinds'
import { FEED_KIND_LABEL, inFeed, isFeedKind, shiftLine, townSlug, type FeedKindSlug } from '@/lib/event-feeds'
import { townFromAddress } from '@/lib/events-seo'
import { SITE_URL } from '@/lib/seo'
import { getQualifyingTowns } from '@/lib/towns/queries'

/**
 * Every upcoming event of one kind in one town, as a calendar people subscribe
 * to: "Get every group ride in Cambridge in your calendar" (PLG L-24, see
 * src/lib/event-feeds.ts). A town with nothing coming up gets an empty
 * calendar, so the subscription keeps working between seasons.
 *
 * Dynamic so each read by a calendar app is counted (event_feed_fetch); the
 * listings themselves are cached for half an hour per kind.
 */
export const dynamic = 'force-dynamic'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_tZDqVkUx4TmwYokjRBVLpEBpycp4PZWCr9bWEbN3SBpb'

const kindEvents = unstable_cache(
  async (kind: FeedKindSlug) => loadKindEvents({ types: eventKind(kind).types, limit: 300 }),
  ['event-feed-kind'],
  { revalidate: 1800 },
)

/**
 * One count per calendar app per feed. The id is a hash of the app's address
 * and name with the feed, so no address leaves the server. Google Calendar
 * reads feeds from its own servers for everyone, so its subscribers collapse
 * into a few ids; the button taps count those.
 */
async function countFetch(req: Request, kind: string, town: string): Promise<void> {
  const ip = (req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
  const ua = req.headers.get('user-agent') ?? ''
  const id = createHash('sha256').update(`${ip}|${ua}|${kind}|${town}`).digest('hex').slice(0, 20)
  const app = /google/i.test(ua) ? 'google' : /iOS|Mac OS|CalendarAgent|dataaccessd|Apple/i.test(ua) ? 'apple'
    : /Outlook|Microsoft|Exchange/i.test(ua) ? 'outlook' : 'other'
  try {
    await fetch('https://us.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: POSTHOG_KEY,
        event: 'event_feed_fetch',
        distinct_id: `feed-${id}`,
        properties: { kind, town, app, $process_person_profile: false },
      }),
      signal: AbortSignal.timeout(2000),
    })
  } catch {
    /* counting must never break the calendar */
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ kind: string; town: string }> }) {
  const { kind, town: rawTown } = await params
  const slug = townSlug(decodeURIComponent(rawTown))
  if (!isFeedKind(kind) || !slug) return new Response('Not found', { status: 404 })

  const [all, towns] = await Promise.all([kindEvents(kind), getQualifyingTowns().catch(() => [])])
  const events = all.filter((ev) => ev.schedule_status !== 'cancelled' && inFeed(ev, kind, slug))

  // The town's name as listings spell it, else from the address slug.
  const townName = (events.length ? townFromAddress(events[0].location_address) : null)
    ?? slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  // The Shift line links to the town's Shift page when it has one (the app
  // pitch converts there, exp-2026-11-1), else to the Shift page.
  const townPage = towns.find((t) => townSlug(t.town_name) === slug)
  const utm = new URLSearchParams({ utm_source: 'calendar', utm_medium: 'ics', utm_campaign: `cal-${slug}-${kind}` })
  const shiftUrl = `${SITE_URL}${townPage ? `/shift/towns/${townPage.slug}` : '/shift'}?${utm}`

  const withShift = events.map((ev) => {
    const linked = ev.ride_code && !ev.event_url
      ? { ...ev, event_url: `${SITE_URL}/rides/${encodeURIComponent(ev.ride_code)}?date=${ev.event_date}` }
      : ev
    return { ...linked, notes: `${calendarNotes(linked)}\n\n${shiftLine(shiftUrl)}` }
  })

  const [ics] = await Promise.all([
    Promise.resolve(buildIcsFeed(withShift, `${FEED_KIND_LABEL[kind]} in ${townName} (Green Streets calendar)`)),
    countFetch(req, kind, slug),
  ])
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${kind}-${slug}.ics"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
