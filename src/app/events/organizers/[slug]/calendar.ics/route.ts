import { loadHostPage } from '@/lib/hosts'
import { buildIcsFeed } from '@/lib/event-calendar'
import { SITE_URL } from '@/lib/seo'

/**
 * A host's upcoming events as a calendar people subscribe to (webcal), so a
 * group's dates show up in Google, Apple or Outlook calendars and on the
 * group's own site, and stay current as the calendar learns new ones.
 */
export const revalidate = 3600

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // A subscribed calendar keeps working between seasons: an organization with
  // nothing coming up gets an empty feed, not a 404 its calendar app gives up on.
  const page = await loadHostPage(decodeURIComponent(slug), { evenIfThin: true })
  if (!page) return new Response('Not found', { status: 404 })
  // A Shift ride's entry links to its own page on that date, where people RSVP.
  const events = page.upcoming.map((ev) => (ev.ride_code && !ev.event_url
    ? { ...ev, event_url: `${SITE_URL}/rides/${encodeURIComponent(ev.ride_code)}?date=${ev.event_date}` }
    : ev))
  const ics = buildIcsFeed(events, `${page.host.name} (walk and bike calendar)`)
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${page.host.id}.ics"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
