import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/** One statewide drawing's results, from Shift's get_competition_results (01582). */
export type CompetitionResults = {
  id: string
  name: string
  series: string | null
  starts_at: string
  ends_at: string
  drawing_at: string | null
  drawn_at: string | null
  drawn: boolean
  /** Entries in the drawing as it ran. */
  entries: number | null
  people: number
  trips: number
  /** False for drawings whose rules carried no publicity line: winners read "Winner in <town>". */
  names_shown: boolean
  prizes: {
    prize_id: string
    description: string
    value: number | null
    quantity: number
    drawn: number
    winners: string[]
  }[]
  next: {
    id: string
    name: string
    starts_at: string
    ends_at: string
    prizes: { value: number | null; quantity: number }[]
  } | null
}

export type WrdMonth = { id: string; name: string; starts_at: string; drawn: boolean; month: string }

const ET = 'America/New_York'

/** "2026-10" for a Walk/Ride Day, from its starts_at (ends_at is 03:59 UTC the next day). */
export function monthKey(startsAt: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: ET, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date(startsAt))
  const y = parts.find(p => p.type === 'year')?.value
  const m = parts.find(p => p.type === 'month')?.value
  return `${y}-${m}`
}

export function resultsPath(startsAt: string): string {
  return `/events/walk-ride-day/results/${monthKey(startsAt)}`
}

/** Every public Walk/Ride Day that has ended, newest first. */
export async function loadWrdMonths(): Promise<WrdMonth[]> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('competitions')
    .select('id, name, starts_at, ends_at, drawing_completed_at')
    .eq('series', 'walk_ride_day')
    .eq('is_public', true)
    .lt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: false })
  if (error) throw new Error(`walk/ride day months: ${error.message}`)
  return (data ?? []).map(c => ({
    id: c.id as string,
    name: c.name as string,
    starts_at: c.starts_at as string,
    drawn: c.drawing_completed_at != null,
    month: monthKey(c.starts_at as string),
  }))
}

export async function loadResults(competitionId: string): Promise<CompetitionResults | null> {
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.rpc('get_competition_results', { p_competition_id: competitionId })
  if (error) throw new Error(`results: ${error.message}`)
  if (!data) return null
  const r = data as CompetitionResults
  return {
    ...r,
    prizes: r.prizes.map(p => ({ ...p, value: p.value == null ? null : Number(p.value) })),
    next: r.next
      ? { ...r.next, prizes: r.next.prizes.map(p => ({ ...p, value: p.value == null ? null : Number(p.value) })) }
      : null,
  }
}

export function dollars(v: number | null): string {
  if (v == null) return ''
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`
}

/** "Saturday, October 31 at 10:00 AM" in Eastern time. */
export function dayAndTime(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { timeZone: ET, weekday: 'long', month: 'long', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { timeZone: ET, hour: 'numeric', minute: '2-digit' })
  return `${day} at ${time}`
}

export function longDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { timeZone: ET, weekday: 'long', month: 'long', day: 'numeric' })
}

/** "October Walk/Ride Day" from "October 2026 Walk/Ride Day". */
export function shortName(name: string): string {
  return name.replace(/\s+20\d\d\b/, '')
}

/** "one $100 and twenty $10 gift cards" from the next month's prize rows. */
export function prizeLine(prizes: { value: number | null; quantity: number }[]): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']
  const parts = prizes
    .filter(p => p.value != null && p.quantity > 0)
    .map(p => `${words[p.quantity] ?? String(p.quantity)} ${dollars(p.value)}`)
  if (parts.length === 0) return ''
  const total = prizes.reduce((s, p) => s + (p.value != null ? p.quantity : 0), 0)
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `${list} gift card${total === 1 ? '' : 's'}`
}
