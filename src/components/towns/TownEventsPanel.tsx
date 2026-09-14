import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { formatDistance, getTagMeta, getTypeMeta, parseEventDate, TYPE_FILTER_ORDER } from '@/lib/events'
import { EVENT_TYPE_ICONS } from '@/components/events/event-type-icons'
import type { TownEvent } from '@/lib/towns/queries'

/**
 * Grouped events panel for the town pages: events bucketed by type (in the
 * canonical TYPE_FILTER_ORDER), each group headed by its Lucide icon tile in
 * the type color — same visual language as the events calendar's EventCard.
 * Rows show date · location · distance from the town.
 */

function eventDateLabel(e: TownEvent): string {
  const d = parseEventDate(e.event_date)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

type Tone = 'dark' | 'light'

// `light` is the cream campaign pages; `dark` (default) keeps the town pages
// byte-identical.
const THEME: Record<Tone, { panel: string; h3: string; sub: string; row: string; title: string; meta: string; all: string; groupInk: boolean }> = {
  dark: {
    panel: 'rounded-[18px] border border-white/[0.08] bg-[#242538] p-6',
    h3: 'mb-1 font-display text-lg font-bold tracking-tight text-white',
    sub: 'mb-4 text-xs text-white/75',
    row: 'block rounded-[12px] border border-white/[0.06] bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.06]',
    title: 'text-sm font-semibold leading-snug text-white',
    meta: 'mt-0.5 text-xs text-white/75',
    all: 'mt-5 inline-block text-sm font-semibold text-[#BAF14D]',
    groupInk: false,
  },
  light: {
    panel: 'rounded-[18px] border border-navy/10 bg-white p-6',
    h3: 'mb-1 font-serif text-[1.375rem] leading-tight text-navy',
    sub: 'mb-4 text-[13px] text-ink-soft',
    row: 'block rounded-[12px] border border-navy/10 bg-cream px-4 py-3 transition-colors hover:border-navy/30',
    title: 'text-[15px] font-semibold leading-snug text-navy',
    meta: 'mt-0.5 text-[13px] text-ink-soft',
    all: 'mt-5 inline-block text-[15px] font-semibold text-forest underline-offset-4 hover:underline',
    // On white the type colors were tuned for navy, so the group label goes
    // navy and only the icon keeps its tint.
    groupInk: true,
  },
}

export default function TownEventsPanel({ events, townName, tone = 'dark' }: { events: TownEvent[]; townName: string; tone?: Tone }) {
  if (events.length === 0) return null
  const t = THEME[tone]

  // Group by type in the canonical order — but Open Streets hoists to the top
  // when present (the marquee car-free events lead the panel).
  const groupOrder = ['open_streets', ...TYPE_FILTER_ORDER.filter((t) => t !== 'open_streets')]
  const groups: Array<{ type: string; items: TownEvent[] }> = []
  for (const type of groupOrder) {
    const items = events.filter((e) => normalizeType(e.event_type) === type)
    if (items.length > 0) groups.push({ type, items })
  }

  return (
    <div className={t.panel}>
      <h3 className={t.h3}>
        Events near {townName}
      </h3>
      <p className={t.sub}>
        A few picks over the next 30 days — the full calendar has everything.
      </p>
      <div className="space-y-5">
        {groups.map(({ type, items }) => {
          const meta = getTypeMeta(type)
          const Icon = EVENT_TYPE_ICONS[meta.icon] ?? Calendar
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
                  className={t.groupInk ? 'text-xs font-bold uppercase tracking-widest text-navy' : 'text-xs font-bold uppercase tracking-widest'}
                  style={t.groupInk ? undefined : { color: meta.color }}
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
                    className={t.row}
                  >
                    <p className={t.title}>{e.title}</p>
                    <p className={t.meta}>
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
      <Link href="/events" className={t.all}>
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
