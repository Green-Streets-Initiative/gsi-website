import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextUp, NextUpKind } from './events'

/**
 * "This one's done — the next one is Wednesday."
 *
 * Event pages are the best-converting surface the site has in search (3.4%
 * click rate over Aug 15 – Sep 11, against 0.5% for town pages), and the pages
 * that pull most of those clicks are for events that have already happened —
 * they have been indexed longer, so they rank better. 17 of 23 event-page
 * clicks that month landed on a past date and offered the visitor nothing.
 *
 * Half the time the answer is already in the database. Two levels, in order:
 *
 *   1. Same series — a future event with the same title. There is no recurrence
 *      id to key on: `event_details.ride_series_id` is for rides planned inside
 *      the Shift app, not for repeating listings, and is null on every imported
 *      event. Title is what actually identifies "the Thursday Cafe Zing ride".
 *   2. Same organizer — any future event from whoever runs this one. Covers the
 *      one-off (a repair clinic, a bike-bus launch) whose host has something
 *      else coming up.
 *
 * Measured 2026-09-14 against the 215 events that ended in the previous 60
 * days: 110 had a same-title future, a further 29 had an organizer-only match,
 * 76 had neither and fall through to the events index.
 */

/** Today in Boston, not in UTC. Vercel runs UTC, so a plain `new Date()` calls
 *  a 7pm event "yesterday" from 8pm onward. Same idiom as the town-digest cron. */
export function todayEt(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export function isPastEvent(eventDate: string): boolean {
  return eventDate < todayEt()
}

interface NextRow {
  content_id: string
  event_date: string
  event_time: string | null
  location_name: string | null
  content_items: { title: string } | { title: string }[]
}

function firstRow(rows: NextRow[] | null, kind: NextUpKind): NextUp | null {
  const row = rows?.[0]
  if (!row) return null
  const ci = Array.isArray(row.content_items) ? row.content_items[0] : row.content_items
  if (!ci?.title) return null
  return {
    kind,
    id: row.content_id,
    title: ci.title,
    event_date: row.event_date,
    event_time: row.event_time,
    location_name: row.location_name,
  }
}

const SELECT =
  'content_id, event_date, event_time, location_name, content_items!inner(title, status, content_type)'

/**
 * The next event worth pointing a visitor at, or null if there isn't one.
 * Both lookups fire together — they don't depend on each other.
 */
export async function findNextUp(
  supabase: SupabaseClient,
  current: { id: string; title: string; organizerId: string | null },
): Promise<NextUp | null> {
  const today = todayEt()

  const seriesQuery = supabase
    .from('event_details')
    .select(SELECT)
    .gte('event_date', today)
    .neq('content_id', current.id)
    .eq('content_items.title', current.title)
    .eq('content_items.status', 'approved')
    .eq('content_items.content_type', 'community_event')
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: true })
    .limit(1)

  const organizerQuery = current.organizerId
    ? supabase
        .from('event_details')
        .select(SELECT)
        .gte('event_date', today)
        .neq('content_id', current.id)
        .eq('organizer_id', current.organizerId)
        .eq('content_items.status', 'approved')
        .eq('content_items.content_type', 'community_event')
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true, nullsFirst: true })
        .limit(1)
    : null

  const [series, organizer] = await Promise.all([
    seriesQuery,
    organizerQuery ?? Promise.resolve({ data: null, error: null }),
  ])

  return (
    firstRow(series.data as NextRow[] | null, 'series') ??
    firstRow(organizer.data as NextRow[] | null, 'organizer')
  )
}
