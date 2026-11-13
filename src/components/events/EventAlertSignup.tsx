'use client'

import EmailSignup from '@/components/email/EmailSignup'
import { type CommunityEvent, parseStyleFilter } from '@/lib/events'
import { townFromAddress } from '@/lib/events-seo'
import type { SiteLocale } from '@/lib/site-i18n'
import { tagLabel, typeLabel, rideLevelFilterLabel, placeLabel, type EventsT } from '@/lib/events-i18n'
import type { useEventFilters } from './useEventFilters'
import { useEventsI18n } from './EventsTone'
import { languageLabel } from '@/lib/languages'

/*
 * "Get these by email" (Shift product item 19, step 3: event alerts). Saves
 * the calendar's current filters (type or ride level, Good for, Rides for,
 * the languages it is led in, distance from the location the calendar is measuring from) as a weekly
 * email of what's coming up that matches. The person confirms by link first;
 * nothing is sent when nothing matches. Topic event_alerts, through the
 * shared EmailSignup box (one source per placement).
 */

/** The event page's box: this kind of event within this many miles of its town. */
const EVENT_PAGE_MILES = 10

type Filters = ReturnType<typeof useEventFilters>

/** The filters in one line, as the confirmation email and manage page say it. */
function summarize(f: Filters, locale: SiteLocale, t: EventsT): string {
  const parts: string[] = []
  const level = parseStyleFilter(f.typeFilter)
  if (level) parts.push(rideLevelFilterLabel(level, locale))
  else if (f.typeFilter !== 'All') parts.push(typeLabel(f.typeFilter, locale))
  else parts.push(t('alert.all_events'))
  for (const tag of f.tags) parts.push(tagLabel(tag, locale))
  if (f.audience.length) parts.push(t('alert.for', { list: f.audience.map((a) => tagLabel(a, locale)).join(t('list.sep')) }))
  // Each language in its own name, as the filter's chips and the email say it.
  for (const c of f.langs) if (c !== 'en') parts.push(languageLabel(c))
  parts.push(f.distance === 'all' ? t('alert.statewide') : t('alert.within', { dist: f.distance, place: placeLabel(f.userLoc.label, locale) }))
  return parts.join(' · ')
}

function payload(f: Filters) {
  const level = parseStyleFilter(f.typeFilter)
  const near = f.distance !== 'all'
  return {
    lat: near ? f.userLoc.lat : null,
    lng: near ? f.userLoc.lng : null,
    place: near ? f.userLoc.label : null,
    dist: near ? Number(f.distance) : null,
    type: !level && f.typeFilter !== 'All' ? f.typeFilter : null,
    level,
    tags: f.tags,
    audience: f.audience,
    languages: f.langs.filter((c) => c !== 'en'),
  }
}

/** The calendar's "Get these by email" box: its current filters, as a weekly email. */
export default function EventAlertSignup({ filters: f, source, className = '', id }: { filters: Filters; source: 'events_list' | 'events_sidebar'; className?: string; id?: string }) {
  const { locale, t } = useEventsI18n()
  return (
    <EmailSignup
      topic="event_alerts"
      source={source}
      details={{ filters: payload(f) }}
      title={t('alert.title')}
      lede={t('alert.lede')}
      summary={summarize(f, locale, t)}
      cta={t('alert.cta')}
      done={t('alert.done')}
      fine={t('alert.fine')}
      locale={locale}
      track={{ type: f.typeFilter, dist: f.distance, tags: f.tags.length, audience: f.audience.length, languages: f.langs.length }}
      id={id}
      className={className}
    />
  )
}

/**
 * A kind page's box (/events/group-rides...): that kind every Thursday,
 * around Boston or statewide. The page passes the filter; same topic and
 * confirmation as the calendar's box.
 */
export function KindPageAlertSignup({ kind, type, near, summary, id, className = '' }: {
  kind: string
  id?: string
  type: string | null
  near: { lat: number; lng: number; place: string; dist: number } | null
  summary: string
  className?: string
}) {
  const { locale, t } = useEventsI18n()
  const filters = {
    lat: near?.lat ?? null,
    lng: near?.lng ?? null,
    place: near?.place ?? null,
    dist: near?.dist ?? null,
    type,
    level: null,
    tags: [],
    audience: [],
  }
  return (
    <EmailSignup
      topic="event_alerts"
      source="events_kind_page"
      details={{ filters }}
      title={t('alert.page_title')}
      lede={t('alert.lede')}
      summary={summary}
      cta={t('alert.cta')}
      done={t('alert.done')}
      fine={t('alert.page_fine')}
      locale={locale}
      track={{ kind, type, near: !!near }}
      id={id}
      className={className}
    />
  )
}

/**
 * The event page's box, under Register: more of this kind of event near this
 * one's town, every Thursday. Statewide when the listing has no town or point.
 */
export function EventPageAlertSignup({ event, className = '' }: { event: CommunityEvent; className?: string }) {
  const { locale, t } = useEventsI18n()
  const town = townFromAddress(event.location_address)
  const near = !!town && event.location_lat != null && event.location_lng != null
  const place = near ? `${town}, MA` : null
  const filters = {
    lat: near ? Number(event.location_lat!.toFixed(3)) : null,
    lng: near ? Number(event.location_lng!.toFixed(3)) : null,
    place,
    dist: near ? EVENT_PAGE_MILES : null,
    type: event.event_type,
    level: null,
    tags: [],
    audience: [],
  }
  const summary = [typeLabel(event.event_type, locale), near ? t('alert.within', { dist: EVENT_PAGE_MILES, place }) : t('alert.statewide')].join(' · ')
  return (
    <EmailSignup
      topic="event_alerts"
      source="event_page"
      details={{ filters }}
      title={t('alert.page_title')}
      lede={t('alert.lede')}
      summary={summary}
      cta={t('alert.cta')}
      done={t('alert.done')}
      fine={t('alert.page_fine')}
      locale={locale}
      track={{ type: event.event_type, near }}
      className={className}
    />
  )
}
