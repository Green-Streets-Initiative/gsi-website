import type { CommunityEvent } from './events'
import { townFromAddress } from './events-seo.ts'
import { inKind, eventKind, type EventKindSlug } from './event-kinds.ts'

/**
 * Town-and-kind calendar feeds (PLG L-24, Keith "do L-24" 2026-11-16):
 * "Get every group ride in Cambridge in your calendar" on an event page.
 *
 * Visitors from search look for a kind of thing in a place ("group bike rides
 * cambridge"), not for a host, so the host feed (/events/organizers/<id>/
 * calendar.ics) doesn't fit them. This one follows the same three kinds as
 * the kind pages (src/lib/event-kinds.ts) and the town in the event's address
 * (townFromAddress, the same reading the event page uses for its town link).
 *
 * Feed: /events/feeds/<kind>/<town-slug>/calendar.ics. Every entry carries the
 * usual calendar note and one line about Shift, linked to the town's Shift
 * page (where the app pitch converts, exp-2026-11-1) with
 * utm_campaign=cal-<town>-<kind>.
 *
 * Test: 6 weeks from launch. Win 40+ subscribers and 5+ store clicks that
 * start from a calendar entry; kill under 10 subscribers. Counted from
 * `event_feed_subscribe` (button taps), `event_feed_fetch` (calendar apps
 * reading the feed, one hashed id per app) and `utm_source=calendar`.
 */

export type FeedKindSlug = Exclude<EventKindSlug, 'this-weekend'>

export const FEED_KINDS: FeedKindSlug[] = ['group-rides', 'walking-groups', 'bike-repair']

/** The calendar's name in the subscriber's calendar list, in English. */
export const FEED_KIND_LABEL: Record<FeedKindSlug, string> = {
  'group-rides': 'Group rides',
  'walking-groups': 'Group walks',
  'bike-repair': 'Bike repair',
}

export function isFeedKind(s: string): s is FeedKindSlug {
  return (FEED_KINDS as string[]).includes(s)
}

/** "Jamaica Plain" -> "jamaica-plain". */
export function townSlug(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** The kind of feed an event belongs to, or null (a festival, a talk, a contest). */
export function feedKindFor(ev: CommunityEvent): FeedKindSlug | null {
  return FEED_KINDS.find((k) => eventKind(k).types?.includes(ev.event_type) && inKind(k, ev)) ?? null
}

export interface EventFeed {
  kind: FeedKindSlug
  town: string
  slug: string
  path: string
}

/** The feed an event's page offers, when it has a kind and a town. */
export function feedFor(ev: CommunityEvent): EventFeed | null {
  const kind = feedKindFor(ev)
  const town = townFromAddress(ev.location_address)
  if (!kind || !town) return null
  const slug = townSlug(town)
  if (!slug) return null
  return { kind, town, slug, path: `/events/feeds/${kind}/${slug}/calendar.ics` }
}

/** The events for one feed: of this kind, in this town. */
export function inFeed(ev: CommunityEvent, kind: FeedKindSlug, slug: string): boolean {
  const town = townFromAddress(ev.location_address)
  return !!town && townSlug(town) === slug && feedKindFor(ev) === kind
}

/** The Shift line at the end of every entry in a feed. */
export function shiftLine(url: string): string {
  return `Walking, biking or taking transit there? Our free app, Shift, counts the trip and turns it into money saved and perks from local businesses: ${url}`
}
