'use client'

import EmailSignup from '@/components/email/EmailSignup'
import { type CommunityEvent, getTagMeta, getTypeMeta, parseStyleFilter, RIDE_STYLE_FILTER_LABEL } from '@/lib/events'
import { townFromAddress } from '@/lib/events-seo'
import type { useEventFilters } from './useEventFilters'

/*
 * "Get these by email" (Shift product item 19, step 3: event alerts). Saves
 * the calendar's current filters (type or ride level, Good for, Rides for,
 * distance from the location the calendar is measuring from) as a weekly
 * email of what's coming up that matches. The person confirms by link first;
 * nothing is sent when nothing matches. Topic event_alerts, through the
 * shared EmailSignup box (one source per placement).
 */

/** The event page's box: this kind of event within this many miles of its town. */
const EVENT_PAGE_MILES = 10

type Filters = ReturnType<typeof useEventFilters>

/** The filters in one line, as the confirmation email and manage page say it. */
function summarize(f: Filters): string {
  const parts: string[] = []
  const level = parseStyleFilter(f.typeFilter)
  if (level) parts.push(RIDE_STYLE_FILTER_LABEL[level])
  else if (f.typeFilter !== 'All') parts.push(getTypeMeta(f.typeFilter).label)
  else parts.push('All events')
  for (const t of f.tags) parts.push(getTagMeta(t).label)
  if (f.audience.length) parts.push(`for ${f.audience.map((a) => getTagMeta(a).label).join(', ')}`)
  parts.push(f.distance === 'all' ? 'statewide' : `within ${f.distance} mi of ${f.userLoc.label}`)
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
  }
}

/** The calendar's "Get these by email" box: its current filters, as a weekly email. */
export default function EventAlertSignup({ filters: f, source, className = '', id }: { filters: Filters; source: 'events_list' | 'events_sidebar'; className?: string; id?: string }) {
  return (
    <EmailSignup
      topic="event_alerts"
      source={source}
      details={{ filters: payload(f) }}
      title="Get these by email"
      lede="Every Thursday, what's coming up that matches:"
      summary={summarize(f)}
      cta="Email me every Thursday"
      done="Check your email and tap the link to confirm."
      fine="Only when something matches. Change your filters above to change what you get."
      track={{ type: f.typeFilter, dist: f.distance, tags: f.tags.length, audience: f.audience.length }}
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
  const town = townFromAddress(event.location_address)
  const near = !!town && event.location_lat != null && event.location_lng != null
  const type = getTypeMeta(event.event_type)
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
  const summary = [type.label, near ? `within ${EVENT_PAGE_MILES} mi of ${place}` : 'statewide'].join(' · ')
  return (
    <EmailSignup
      topic="event_alerts"
      source="event_page"
      details={{ filters }}
      title="Get more like this by email"
      lede="Every Thursday, what's coming up that matches:"
      summary={summary}
      cta="Email me every Thursday"
      done="Check your email and tap the link to confirm."
      fine="Only when something matches. Stop any time from any email."
      track={{ type: event.event_type, near }}
      className={className}
    />
  )
}
