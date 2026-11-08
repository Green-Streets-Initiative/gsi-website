import Link from 'next/link'
import { eventPath } from '@/lib/events-url'
import { Calendar } from 'lucide-react'
import { formatDistance, getTagMeta, getTypeMeta, parseEventDate, TYPE_FILTER_ORDER } from '@/lib/events'
import { EVENT_TYPE_ICONS } from '@/components/events/event-type-icons'
import type { TownEvent } from '@/lib/towns/queries'
import { siteDate, translator, withLang, type SiteLocale } from '@/lib/site-i18n'
import { townsStrings } from '@/lib/site-strings/towns'

/**
 * Grouped events panel for the town pages: events bucketed by type (in the
 * canonical TYPE_FILTER_ORDER), each group headed by its Lucide icon tile in
 * the type color — same visual language as the events calendar's EventCard.
 * Rows show date · location · distance from the town.
 *
 * `locale` (translation plan, batch 5): type and tag labels come from
 * site-strings/towns.ts in other languages; English keeps lib/events' labels.
 */

type TK = keyof (typeof townsStrings)['en']

function eventDateLabel(e: TownEvent, locale: SiteLocale): string {
  const d = parseEventDate(e.event_date)
  return siteDate(locale, d, { weekday: 'short', month: 'short', day: 'numeric' })
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

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

export default function TownEventsPanel({ events, townName, tone = 'dark', locale = 'en' }: { events: TownEvent[]; townName: string; tone?: Tone; locale?: SiteLocale }) {
  if (events.length === 0) return null
  const t = THEME[tone]
  const tr = translator(townsStrings, locale)
  const en = locale === 'en'
  const typeLabel = (type: string, fallback: string) => (en || !(`evtype.${type}` in townsStrings.en) ? fallback : tr(`evtype.${type}` as TK))
  const tagLabel = (tag: string, fallback: string) => (en || !(`tag.${tag}` in townsStrings.en) ? fallback : tr(`tag.${tag}` as TK))
  // "Saturdays · next Sat, Nov 8": the server names the weekday in English.
  const recurring = (e: TownEvent) => {
    if (!e.recurring_weekday) return ''
    const day = WEEKDAYS.indexOf(e.recurring_weekday)
    if (en || day < 0) return `${e.recurring_weekday}s · next `
    return `${tr(`ev.weekly_${day}` as TK)} · `
  }
  const when = (e: TownEvent) =>
    !en && e.recurring_weekday && WEEKDAYS.includes(e.recurring_weekday)
      ? tr('ev.next', { when: eventDateLabel(e, locale) })
      : eventDateLabel(e, locale)

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
        {tr('ev.title', { town: townName })}
      </h3>
      <p className={t.sub}>
        {tr('ev.sub')}
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
                  {typeLabel(type, meta.label)}
                  {items.length > 1 ? ` · ${items.length}` : ''}
                </span>
              </div>
              <div className="space-y-2">
                {items.map((e) => (
                  <Link
                    key={e.id}
                    href={withLang(eventPath(e), locale)}
                    className={t.row}
                  >
                    <p className={t.title}>{e.title}</p>
                    <p className={t.meta}>
                      {recurring(e)}
                      {when(e)}
                      {e.location_name ? ` · ${e.location_name}` : ''}
                      {` · ${tr('ev.away', { distance: en ? formatDistance(e.distance_miles) : tr('unit.mi', { n: formatDistance(e.distance_miles).replace(/ mi$/, '') }) })}`}
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
                              {tagLabel(tag, meta.label)}
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
      <Link href={withLang('/events', locale)} className={t.all}>
        {tr('ev.all')}
      </Link>
    </div>
  )
}

// Fold anything unrecognized (or null) into "other".
const KNOWN_TYPES = new Set<string>(TYPE_FILTER_ORDER)
function normalizeType(type: string | null): string {
  return type && KNOWN_TYPES.has(type) ? type : 'other'
}
