import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export default async function WayfindingEventsPage() {
  const supabase = createServerSupabaseClient()
  const { data: events } = await supabase
    .from('wayfinding_events')
    .select('id, slug, name, eyebrow, date_primary, date_rain, is_published, is_rain_date, is_cancelled, accent_color, created_at')
    .order('date_primary', { ascending: false })

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-white font-[family-name:var(--font-bricolage)]">
            Wayfinding Events
          </h1>
          <p className="text-sm text-white/75 mt-1">
            Manage mobile wayfinding pages for street festivals and events.
          </p>
        </div>
        <Link
          href="/admin/wayfinding/new"
          className="px-4 py-2.5 rounded-lg bg-[#2966E5] text-white text-sm font-semibold hover:bg-[#2966E5]/90 transition-colors"
        >
          New event
        </Link>
      </div>

      {!events || events.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-12 text-center">
          <p className="text-white/75">No wayfinding events yet.</p>
          <Link href="/admin/wayfinding/new" className="text-[#2966E5] text-sm mt-2 inline-block hover:underline">
            Create your first event
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <Link
              key={event.id}
              href={`/admin/wayfinding/${event.id}`}
              className="block rounded-xl border border-white/[0.08] bg-white/[0.03] p-5 hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div
                    className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: event.accent_color }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-white font-semibold">{event.name}</h2>
                      {event.eyebrow && (
                        <span className="text-xs text-white/60 px-2 py-0.5 rounded-full bg-white/[0.07]">
                          {event.eyebrow}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-white/75">
                        {new Date(event.date_primary + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                      <span className="text-sm text-white/60">/wayfinding/{event.slug}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {event.is_cancelled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                      Cancelled
                    </span>
                  )}
                  {event.is_rain_date && !event.is_cancelled && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                      Rain date
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    event.is_published
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/[0.07] text-white/60'
                  }`}>
                    {event.is_published ? 'Published' : 'Draft'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
