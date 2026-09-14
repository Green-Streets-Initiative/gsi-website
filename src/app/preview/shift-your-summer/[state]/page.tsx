import { notFound } from 'next/navigation'
import EventPage from '@/app/events/shift-your-summer/EventPage'
import { loadEventPage, PAGE_STATES, type PageState } from '@/app/events/shift-your-summer/_lib/load'

/*
 * STAGING. Renders the Shift Your Summer page in any of its four states so
 * they can all be reviewed today, whatever the calendar says:
 *
 *   /preview/shift-your-summer/coming-soon   no competition at all
 *   /preview/shift-your-summer/upcoming      the 2026 challenge, as seen on June 1
 *   /preview/shift-your-summer/active        the 2026 challenge, as seen on July 15
 *   /preview/shift-your-summer/ended         what production shows today
 *
 * Inherits noindex from src/app/preview/layout.tsx. Rendered on request, so
 * the real route's 60-second cache is unaffected.
 */
export const dynamic = 'force-dynamic'

// Clocks that land inside the 2026 campaign window. When the next campaign is
// seeded these will resolve to it only if its dates overlap; adjust then.
const FAKE_NOW: Partial<Record<PageState, string>> = {
  upcoming: '2026-06-01T12:00:00-04:00',
  active: '2026-07-15T12:00:00-04:00',
}

export default async function ShiftYourSummerPreview({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  if (!PAGE_STATES.includes(state as PageState)) notFound()
  const s = state as PageState
  const fake = FAKE_NOW[s]
  const data = await loadEventPage({ nowMs: fake ? new Date(fake).getTime() : undefined, forceState: s })
  return <EventPage {...data} />
}
