import Link from 'next/link'
import { Users, Gift, ArrowRight } from 'lucide-react'
import { eventPath } from '@/lib/events-url'
import type { RoamGroupEvent } from '@/lib/roams/queries'

function when(e: RoamGroupEvent): string {
  const day = new Date(`${e.event_date}T12:00:00-05:00`).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
  })
  if (!e.event_time) return day
  const [h, m] = e.event_time.slice(0, 5).split(':').map(Number)
  const clock = `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'PM' : 'AM'}`
  return `${day} · ${clock}`
}

/** "Ride it with a group": the next calendar ride or walk on this roam's route. */
export default function RoamGroupEventCard({ event }: { event: RoamGroupEvent }) {
  return (
    <section aria-labelledby="group-ride" className="px-6 pt-8 lg:px-8">
      <div className="mx-auto max-w-[860px] rounded-[14px] border border-forest/30 bg-white px-5 py-5">
        <h2 id="group-ride" className="flex items-center gap-2 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-forest">
          <Users size={15} aria-hidden /> Ride it with a group
        </h2>
        <p className="mt-2 text-[1.125rem] font-semibold leading-snug text-navy">{event.title}</p>
        <p className="mt-1 text-[0.9375rem] text-ink-soft">{when(event)}</p>
        {event.location_name && <p className="text-[0.9375rem] text-ink-soft">{event.location_name}</p>}
        {event.organizer_name && <p className="text-[0.9375rem] text-ink-soft">Hosted by {event.organizer_name}</p>}
        {event.reward_note && (
          <p className="mt-3 flex gap-2 rounded-[10px] bg-[#EDB93C]/15 px-3 py-2 text-[0.9375rem] leading-relaxed text-navy">
            <Gift size={16} className="mt-0.5 shrink-0 text-[#8A6D1F]" aria-hidden />
            <span>{event.reward_note}</span>
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={eventPath(event)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-navy px-5 text-[0.9375rem] font-semibold text-white hover:bg-navy/90"
          >
            See the ride <ArrowRight size={15} aria-hidden />
          </Link>
          {event.registration_url && (
            <a
              href={event.registration_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center rounded-full border border-navy/25 px-5 text-[0.9375rem] font-semibold text-navy hover:bg-navy/[0.05]"
            >
              Register
            </a>
          )}
        </div>
      </div>
    </section>
  )
}
