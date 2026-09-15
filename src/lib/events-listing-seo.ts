import type { Metadata } from 'next'
import { SITE_URL } from './seo'
import { parseEventDate, dateMedium, parseStyleFilter, RIDE_STYLE_LABEL, type RideStyle } from './events'

/**
 * Title, description and share card for the /events calendar — the page people
 * actually paste into a group chat.
 *
 * Two things were wrong with the static block this replaced. It set a title and
 * a description but no `openGraph`, so every share fell back to the root
 * layout's "Green Streets Initiative / Shift how you move. Walk it. Bike it.
 * Take the bus." — true of the whole site and useless as a preview of a
 * calendar. And the calendar's filters live in the URL (`?type=class`,
 * `?level=easy`, `?near=…`), so the link someone shares is almost never the
 * bare page; the card should say what they were looking at.
 *
 * Every filtered URL canonicalizes to /events. The filtering runs client-side,
 * so each variant serves identical HTML — only the card differs — and search
 * should consolidate on one page rather than a few hundred near-duplicates.
 *
 * Sibling module: `events-seo.ts` does the same job for /events/[id].
 */

const BASE_URL = `${SITE_URL}/events`
const SUFFIX = ' | Green Streets Initiative'

/** How each event type reads as the subject of a sentence, in the plural. */
const TYPE_PLURAL: Record<string, string> = {
  guided_ride: 'Guided Rides',
  group_ride: 'Group Rides',
  class: 'Bike Classes & Workshops',
  ebike_demo: 'E-Bike Demos',
  cargo_bike_demo: 'Cargo Bike Demos',
  bike_repair: 'Bike Repair Clinics',
  bike_rodeo: 'Bike Rodeos',
  bike_bus: 'Bike Buses',
  walking_tour: 'Walking Tours',
  transit_buddy: 'Transit Buddy Meetups',
  civic_action: 'Civic Actions',
  talk: 'Talks & Panels',
  festival: 'Festivals',
  open_streets: 'Open Streets Events',
  contest: 'Contests',
  challenge: 'Community Challenges',
  other: 'Community Events',
}

/**
 * Tags that work as an adjective in front of the subject. The rest of the tag
 * list stays out of the title: "Registration req'd Group Rides" is not a
 * phrase anyone would write.
 */
const TAG_ADJECTIVE: Record<string, string> = {
  free: 'Free',
  beginner_friendly: 'Beginner-Friendly',
  family_friendly: 'Family-Friendly',
  students: 'Student',
  seniors: 'Senior',
  women: "Women's",
  lgbtq: 'LGBTQ+',
  spanish: 'Spanish-Language',
  bilingual: 'Bilingual',
}

// Lowercase on purpose: these read as part of a sentence in both the title
// and the description ("Free Group Rides this weekend in Massachusetts").
const WHEN_PHRASE: Record<string, string> = {
  week: 'this week',
  weekend: 'this weekend',
  month: 'in the next 30 days',
}

export type EventsSearchParams = Record<string, string | string[] | undefined>

function one(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value
  const trimmed = (v ?? '').trim()
  return trimmed ? trimmed : null
}

/** The place name out of `near=42.39,-71.12,Somerville, MA`, when there is one. */
function nearLabel(near: string | null): string | null {
  if (!near) return null
  const label = near.split(',').slice(2).join(',').trim()
  if (!label || /^your location$/i.test(label)) return null
  return label.length > 40 ? null : label
}

/** `day=2026-09-20` → "Sat, Sep 20", ignoring anything malformed. */
function dayPhrase(day: string | null): string | null {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return `on ${dateMedium(parseEventDate(day))}`
}

function rideLevel(params: EventsSearchParams): RideStyle | null {
  const level = one(params.level)
  if (level && (level === 'easy' || level === 'moderate' || level === 'rec')) return level
  // The type radio carries a level as `style:easy` when both are in the URL.
  return parseStyleFilter(one(params.type) ?? '')
}

export interface EventsFilterSummary {
  /** "Free Group Rides", "Easy Rides", "Community Events". */
  subject: string
  /** "this weekend", "on Sat, Sep 20", or null when no date scope is set. */
  when: string | null
  /** "near Somerville, MA" or "in Massachusetts". */
  place: string
  /** Free-text search, which becomes the subject when present. */
  query: string | null
  /** True when nothing narrowed the list — the card can lead with the calendar itself. */
  isDefault: boolean
}

/** What the URL's filters add up to, in words. */
export function summarizeEventsFilters(params: EventsSearchParams): EventsFilterSummary {
  const query = one(params.q)
  const level = rideLevel(params)
  const type = one(params.type)
  const tags = (one(params.tags) ?? '').split(',').map((t) => t.trim()).filter(Boolean)
  const saved = one(params.saved)
  const when = dayPhrase(one(params.day)) ?? WHEN_PHRASE[one(params.when) ?? ''] ?? null
  const label = nearLabel(one(params.near))

  const adjectives = tags.map((t) => TAG_ADJECTIVE[t]).filter(Boolean)
  let noun: string | null = null
  if (level) noun = `${RIDE_STYLE_LABEL[level]} Rides`
  else if (type && !type.startsWith('style:')) noun = TYPE_PLURAL[type] ?? null
  else if (saved) noun = 'Saved Events'

  const subject = query
    ? `Events matching "${query}"`
    : [...adjectives, noun ?? 'Community Events'].join(' ')

  return {
    subject,
    when,
    place: label ? `near ${label}` : 'in Massachusetts',
    query,
    isDefault: !query && !noun && adjectives.length === 0 && !when && !label,
  }
}

const DEFAULT_TITLE = 'Community Events — Group Rides, Walks & Bike Classes in Massachusetts'
const DEFAULT_DESCRIPTION =
  'Group rides, e-bike demos, walking tours, transit meetups, civic actions, and festivals across Massachusetts. Find your next ride, walk, or roll.'
const DEFAULT_OG_TITLE = 'Community Events — rides, walks and bike classes'
const DEFAULT_OG_DESCRIPTION =
  'A calendar of group rides, e-bike demos, walking tours and street festivals across Massachusetts. Find your next ride, walk, or roll.'

/** Metadata for /events, shaped by whatever filters the shared URL carries. */
export function buildEventsListingMetadata(params: EventsSearchParams): Metadata {
  const f = summarizeEventsFilters(params)

  const phrase = [f.subject, f.when, f.place].filter(Boolean).join(' ')
  const title = f.isDefault ? DEFAULT_TITLE : phrase
  const description = f.isDefault
    ? DEFAULT_DESCRIPTION
    : `${phrase}. Dates, times, meeting points, and who each one is for — updated as organizers post them.`
  const ogTitle = f.isDefault ? DEFAULT_OG_TITLE : phrase
  const ogDescription = f.isDefault ? DEFAULT_OG_DESCRIPTION : description

  return {
    title: title + SUFFIX,
    description,
    // Filters are applied in the browser, so every variant is the same page.
    alternates: { canonical: BASE_URL },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: BASE_URL,
      siteName: 'Green Streets Initiative',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: ogTitle,
      description: ogDescription,
    },
  }
}
