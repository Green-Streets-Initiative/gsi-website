import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import '@/components/events/events-tone.css'
import { loadHostPage, hostPath } from '@/lib/hosts'
import { eventHref, eventPath } from '@/lib/events-url'
import { formatTime, parseEventDate } from '@/lib/events'
import { SITE_URL } from '@/lib/seo'

/**
 * A host's upcoming list for their own website (an iframe from the host
 * page's "Copy the code for your site"). No site chrome; links open the
 * full event page in a new tab.
 */
export const revalidate = 1800
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function Embed({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // On the group's own site: an empty list between seasons, never a 404.
  const page = await loadHostPage(decodeURIComponent(slug), { evenIfThin: true })
  if (!page) notFound()
  const { host, upcoming } = page

  return (
    <div className={`min-h-screen bg-(--ev-bg) p-3 events-tone events-tone-light`}>
      {upcoming.length === 0 ? (
        <p className="p-2 text-[15px] text-(--ev-ink-80)">No upcoming dates yet.</p>
      ) : (
        <ol className="space-y-2">
          {upcoming.slice(0, 12).map((ev) => {
            const d = parseEventDate(ev.event_date)
            const place = ev.location_name && ev.location_name !== 'See event page for details' ? ev.location_name : null
            const off = ev.schedule_status === 'cancelled'
            return (
              <li key={ev.id}>
                {/* A Shift ride opens its own page on that date, where people RSVP. */}
                <a href={`${SITE_URL}${off ? eventPath(ev) : eventHref(ev)}`} target="_blank" rel="noopener noreferrer"
                   className="flex gap-3 rounded-xl border border-(--ev-line) bg-(--ev-card) px-3 py-2.5 hover:border-(--ev-line-stronger)">
                  <div className={`flex w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-(--ev-panel) py-1 ${off ? 'line-through decoration-2' : ''}`}>
                    <span className="text-[13px] font-semibold text-(--ev-ink-75)">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className="text-[14px] font-bold text-(--ev-ink)">{d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  </div>
                  <div className="min-w-0">
                    <p className={`text-[15px] font-semibold leading-snug ${off ? 'text-(--ev-ink-75) line-through' : 'text-(--ev-ink)'}`}>{ev.title}</p>
                    <p className="text-[14px] text-(--ev-ink-75)">
                      {off && <span className="mr-1.5 font-bold text-(--ev-danger)">Cancelled</span>}
                      {[ev.event_time ? formatTime(ev.event_time) : null, place].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </a>
              </li>
            )
          })}
        </ol>
      )}
      <p className="mt-3 px-1 text-[14px] text-(--ev-ink-75)">
        <a href={`${SITE_URL}${hostPath(host.id)}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-(--ev-accent) hover:underline">
          All of {host.name}&rsquo;s dates
        </a>{' '}
        on the Green Streets walk and bike calendar
      </p>
    </div>
  )
}
