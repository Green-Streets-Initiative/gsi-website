import Link from 'next/link'
import {
  Bike,
  Bus,
  Calendar,
  Flag,
  Footprints,
  GraduationCap,
  MapPin,
  Megaphone,
  Package,
  PartyPopper,
  Users,
  Wrench,
  Zap,
} from 'lucide-react'
import { formatDistance, getTagMeta, getTypeMeta, parseEventDate, TYPE_FILTER_ORDER } from '@/lib/events'
import type { TownEvent } from '@/lib/towns/queries'

/**
 * Grouped events panel for the town pages: events bucketed by type (in the
 * canonical TYPE_FILTER_ORDER), each group headed by its Lucide icon tile in
 * the type color — same visual language as the events calendar's EventCard.
 * Rows show date · location · distance from the town.
 */

// Local ICON_MAP mirroring EventCard.tsx (its map isn't exported).
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  Bike,
  Bus,
  Calendar,
  Flag,
  Footprints,
  GraduationCap,
  MapPin,
  Megaphone,
  Package,
  PartyPopper,
  Users,
  Wrench,
  Zap,
}

function eventDateLabel(e: TownEvent): string {
  const d = parseEventDate(e.event_date)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function TownEventsPanel({ events, townName }: { events: TownEvent[]; townName: string }) {
  if (events.length === 0) return null

  // Group by type in the canonical order — but Open Streets hoists to the top
  // when present (the marquee car-free events lead the panel).
  const groupOrder = ['open_streets', ...TYPE_FILTER_ORDER.filter((t) => t !== 'open_streets')]
  const groups: Array<{ type: string; items: TownEvent[] }> = []
  for (const type of groupOrder) {
    const items = events.filter((e) => normalizeType(e.event_type) === type)
    if (items.length > 0) groups.push({ type, items })
  }

  return (
    <div className="rounded-[18px] border border-white/[0.08] bg-[#242538] p-6">
      <h3 className="mb-4 font-display text-lg font-bold tracking-tight text-white">
        Events near {townName}
      </h3>
      <div className="space-y-5">
        {groups.map(({ type, items }) => {
          const meta = getTypeMeta(type)
          const Icon = ICON_MAP[meta.icon] ?? Calendar
          return (
            <div key={type}>
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-[8px]"
                  style={{ backgroundColor: `${meta.color}29` }}
                >
                  <Icon size={16} style={{ color: meta.color }} />
                </span>
                <span
                  className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                  {items.length > 1 ? ` · ${items.length}` : ''}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${encodeURIComponent(e.id)}`}
                    className="block rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.06]"
                  >
                    <p className="text-sm font-semibold leading-snug text-white">{e.title}</p>
                    <p className="mt-0.5 text-xs text-white/75">
                      {e.recurring_weekday ? `${e.recurring_weekday}s · next ` : ''}
                      {eventDateLabel(e)}
                      {e.location_name ? ` · ${e.location_name}` : ''}
                      {` · ${formatDistance(e.distance_miles)} away`}
                    </p>
                    {e.tags.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        {e.tags.slice(0, 3).map((tag) => {
                          const meta = getTagMeta(tag)
                          return (
                            <span
                              key={tag}
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{ color: meta.color, backgroundColor: meta.bg }}
                            >
                              {meta.label}
                            </span>
                          )
                        })}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <Link href="/events" className="mt-5 inline-block text-sm font-semibold text-[#BAF14D]">
        All community events &rarr;
      </Link>
    </div>
  )
}

// Fold anything unrecognized (or null) into "other".
const KNOWN_TYPES = new Set<string>(TYPE_FILTER_ORDER)
function normalizeType(type: string | null): string {
  return type && KNOWN_TYPES.has(type) ? type : 'other'
}
