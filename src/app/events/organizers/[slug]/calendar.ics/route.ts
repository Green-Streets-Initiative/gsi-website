import { loadHostPage } from '@/lib/hosts'
import { buildIcsFeed } from '@/lib/event-calendar'

/**
 * A host's upcoming events as a calendar people subscribe to (webcal), so a
 * group's dates show up in Google, Apple or Outlook calendars and on the
 * group's own site, and stay current as the calendar learns new ones.
 */
export const revalidate = 3600

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await loadHostPage(decodeURIComponent(slug))
  if (!page) return new Response('Not found', { status: 404 })
  const ics = buildIcsFeed(page.upcoming, `${page.host.name} (walk and bike calendar)`)
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${page.host.id}.ics"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
