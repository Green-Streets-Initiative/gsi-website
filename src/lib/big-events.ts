import type { SupabaseClient } from '@supabase/supabase-js'
import type { GoTogetherGroup } from './go-together'

/**
 * Games and concerts people go to together (Go Together phase 2, Shift
 * 01691). Their own list, never the events calendar: home games come in each
 * night from the teams' schedules, concerts from the admin page.
 *
 *   get_big_events(venue, days)  the next ones, each with the group rides going
 *   get_big_event(id)            one, for its page at /going/<id>
 */
export interface BigEvent {
  id: string
  kind: 'game' | 'concert' | 'other'
  title: string
  team: string | null
  venue_slug: string | null
  venue_name: string
  starts_at: string
  time_known: boolean
  status: 'scheduled' | 'final' | 'postponed' | 'canceled'
  groups: GoTogetherGroup[]
}

export const bigEventPath = (e: { id: string }) => `/going/${encodeURIComponent(e.id)}`

/** "Sun, Nov 8 · 1:00 PM", or the day alone while a league hasn't set the time. */
export function bigEventWhen(e: Pick<BigEvent, 'starts_at' | 'time_known'>, opts: { weekday?: 'short' | 'long' } = {}): string {
  const d = new Date(e.starts_at)
  const day = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: opts.weekday ?? 'short', month: 'short', day: 'numeric' })
  if (!e.time_known) return day
  const time = d.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
  return `${day} · ${time}`
}

export async function loadBigEvents(supabase: SupabaseClient, venue: string | null, days = 21): Promise<BigEvent[]> {
  try {
    const { data, error } = await supabase.rpc('get_big_events', { p_venue: venue, p_days: days })
    if (error || !Array.isArray(data)) return []
    return data as BigEvent[]
  } catch {
    return []
  }
}

export async function loadBigEvent(supabase: SupabaseClient, id: string): Promise<BigEvent | null | 'error'> {
  try {
    const { data, error } = await supabase.rpc('get_big_event', { p_id: id })
    if (error) return 'error'
    return (data as BigEvent | null) ?? null
  } catch {
    return 'error'
  }
}
