import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { haversineMiles } from '@/lib/nearby/share'
import { eventModeOf, type EventMode } from '@/components/commute/event-card'
import { lastFridayET } from '@/lib/campaigns/walk-ride-series'
import { ET } from '@/lib/campaigns/format'
import { FLAGSHIP_REGISTRY } from '@/lib/campaigns/routes'
import type { EventWithDetails, TryItCard, WalkRideDayCard } from '@/lib/types/commute'

/*
 * The "Try it with others" pick for one way in (Keith 2026-10-06: "when
 * someone picks walking or transit, Try it With Others still shows a bike
 * event"). Shared by the recommend route (the plan's own pick, for the
 * recommended way in) and GET /api/commute/event (re-fetched when another
 * row opens).
 *
 *  (a) an event FOR that way in, within EVENT_RADIUS_MILES of the office
 *      (walk: walk audits, walking groups and tours; transit: transit talks
 *      and rider meetings; bike: rides, classes, repair) — nearest first;
 *  (b) else a mode-neutral getting-around event within the same radius
 *      (Walk/Ride Day, open streets, a transportation or community meeting);
 *  (c) else the next Walk/Ride Day, with a line and a link to the program.
 * Never an event for a different way in. The mode of an event comes from
 * eventModeOf(): primary_mode first, then the event type.
 */

/** An event further than this from the office is not "nearby". */
export const EVENT_RADIUS_MILES = 25
/** Upcoming rows read, soonest first; the catalogue holds ~110 upcoming rows. */
const EVENT_ROWS = 200

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const round2 = (n: number) => Math.round(n * 100) / 100
/** "2026-10-30" for an instant, as an Eastern-time calendar day. */
const etDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit', day: '2-digit' })
const etMonth = (d: Date) => d.toLocaleDateString('en-US', { timeZone: ET, month: 'long' })

/** First sentence of a listing's description as plain text, for the event card. */
export function excerptOf(body: string | null | undefined, max = 180): string | null {
  if (!body) return null
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>]+/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  const m = /^(.*?[.!?])(\s|$)/.exec(text)
  const first = (m ? m[1] : text).trim()
  if (first.length <= max) return first
  return `${first.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

type EventRow = {
  content_id: string
  event_date: string
  event_time: string | null
  event_end_time: string | null
  location_name: string | null
  location_address: string | null
  location_lat: number | null
  location_lng: number | null
  event_type: string | null
  organizer_name: string | null
  pace: string | null
  no_drop: boolean | null
  tags: string[] | null
  distance_text: string | null
  content_items: EventWithDetails['content_items'] & { slug?: string | null; body?: string | null }
}

/**
 * The nearest upcoming event for `mode` within EVENT_RADIUS_MILES of the
 * office; else the nearest mode-neutral one; else null. event_date is a
 * Postgres DATE string and is passed through untouched; the pages format
 * it as a local calendar day, never through new Date().
 */
export async function pickTryItEvent(
  mode: EventMode,
  office: { lat: number; lng: number },
): Promise<(EventWithDetails & { slug: string | null }) | null> {
  // Today as an Eastern calendar day: the UTC date is already tomorrow after
  // 8 PM, which dropped tonight's events.
  const today = etDay(new Date())
  const { data } = await supabase
    .from('event_details')
    .select(`
      content_id, event_date, event_time, event_end_time, location_name, location_address, location_lat, location_lng,
      event_type, organizer_name, pace, no_drop, tags, distance_text,
      content_items!inner(slug, title, summary, body, primary_mode, status)
    `)
    .eq('content_items.status', 'approved')
    .gte('event_date', today)
    .order('event_date', { ascending: true })
    .limit(EVENT_ROWS)

  const rows = (data ?? []) as unknown as EventRow[]
  let best: { row: EventRow; score: number } | null = null
  for (const row of rows) {
    if (row.location_lat == null || row.location_lng == null) continue
    const evMode = eventModeOf(row.event_type, row.content_items?.primary_mode)
    // (a) the way in itself, (b) neutral; anything else is never shown.
    const tier = evMode === mode ? 0 : evMode === 'neutral' ? 1 : null
    if (tier === null) continue
    const miles = haversineMiles(office.lat, office.lng, Number(row.location_lat), Number(row.location_lng))
    if (!Number.isFinite(miles) || miles > EVENT_RADIUS_MILES) continue
    const score = tier * 1000 + miles
    if (!best || score < best.score) best = { row, score }
  }
  if (!best) return null
  const row = best.row
  return {
    id: row.content_id,
    slug: row.content_items?.slug ?? null,
    event_date: row.event_date,
    location_name: row.location_name,
    content_items: {
      title: row.content_items.title,
      summary: row.content_items.summary,
      primary_mode: row.content_items.primary_mode,
    },
    event_time: row.event_time ?? null,
    event_end_time: row.event_end_time ?? null,
    location_address: row.location_address ?? null,
    event_type: row.event_type ?? null,
    organizer_name: row.organizer_name ?? null,
    pace: row.pace ?? null,
    no_drop: row.no_drop ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    distance_text: row.distance_text ?? null,
    excerpt: excerptOf(row.content_items?.body) ?? excerptOf(row.content_items?.summary),
    miles_from_office: round2(haversineMiles(office.lat, office.lng, Number(row.location_lat), Number(row.location_lng))),
  }
}

/**
 * The next Walk/Ride Day: the way /programs/walk-ride-days finds it (the
 * public, groupless `competitions` rows named Walk/Ride Day, the one
 * running now or the next to start), then the last-Friday recurrence past
 * the seeded horizon. Null only if both somehow fail.
 */
export async function nextWalkRideDay(now = new Date()): Promise<WalkRideDayCard | null> {
  const entry = FLAGSHIP_REGISTRY.find((f) => f.entry.seriesKey === 'walk-ride-day')?.entry
  const href = entry?.href ?? '/programs/walk-ride-days'
  const blurb = entry?.blurb ?? 'One Friday a month, people all over Massachusetts walk, bike, and ride together.'
  try {
    const admin = createServerSupabaseClient()
    const { data } = await admin
      .from('competitions')
      .select('starts_at, ends_at')
      .eq('is_public', true)
      .is('group_id', null)
      .like('name', '%Walk/Ride Day%')
      .gte('ends_at', now.toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
    const row = (data ?? [])[0] as { starts_at: string } | undefined
    if (row) {
      const start = new Date(row.starts_at)
      return { date: etDay(start), title: `${etMonth(start)} Walk/Ride Day`, blurb, href, seeded: true }
    }
  } catch (err) {
    console.warn('[try-it-event] competitions lookup failed:', err)
  }
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  for (let i = 0; i < 3; i++) {
    const start = lastFridayET(cursor.getUTCFullYear(), cursor.getUTCMonth())
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    if (start.getTime() <= now.getTime()) continue
    return { date: etDay(start), title: `${etMonth(start)} Walk/Ride Day`, blurb, href, seeded: false }
  }
  return null
}

/**
 * The card for one way in: the event if one fits, and the next Walk/Ride
 * Day always (the page shows it only when `event` is null), so the card is
 * never empty even when the event lookup fails.
 */
export async function tryItFor(mode: EventMode, office: { lat: number; lng: number }): Promise<TryItCard> {
  const [event, wrd] = await Promise.all([
    pickTryItEvent(mode, office).catch((err) => { console.warn('[try-it-event] event lookup failed:', err); return null }),
    nextWalkRideDay().catch((err) => { console.warn('[try-it-event] walk/ride day lookup failed:', err); return null }),
  ])
  return { mode, event, walk_ride_day: wrd }
}
