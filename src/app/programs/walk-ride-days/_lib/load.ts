import 'server-only'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { lastFridayET } from '@/lib/campaigns/walk-ride-series'

/*
 * Everything the Walk/Ride Day page reads, free of markup: the next
 * occurrence, its prize pool, and the few dates after it. Real rows first
 * (the `competitions` series is seeded a year ahead and hand-moved around
 * holidays), synthesized last Fridays only past the seeded horizon.
 */

export interface WalkRideDay {
  /** ISO start instant of the day (ET midnight). */
  startsAt: string
  /** A real competitions row exists — rules and a drawing are attached. */
  seeded: boolean
  active: boolean
}

export interface PrizePool {
  /** Number of gift cards in the drawing. */
  count: number
  /** Face value of each, when every unit shares one value; else null. */
  each: number | null
  /** Total face value across the pool. */
  total: number
}

export interface WalkRideDayData {
  next: WalkRideDay | null
  later: WalkRideDay[]
  prizes: PrizePool | null
  /** When the next day is a hand-moved date rather than the last Friday. */
  moved: boolean
}

type Row = { id: string; starts_at: string; ends_at: string }

export async function loadWalkRideDays(now = new Date()): Promise<WalkRideDayData> {
  const supabase = createServerSupabaseClient()
  const { data } = await supabase
    .from('competitions')
    .select('id, starts_at, ends_at')
    .eq('is_public', true)
    .is('group_id', null)
    .like('name', '%Walk/Ride Day%')
    .order('starts_at', { ascending: true })
  const rows = (data ?? []) as Row[]
  const nowMs = now.getTime()

  const current = rows.find(r => new Date(r.starts_at).getTime() <= nowMs && new Date(r.ends_at).getTime() >= nowMs) ?? null
  const upcoming = rows.filter(r => new Date(r.starts_at).getTime() > nowMs)
  const nextRow = current ?? upcoming[0] ?? null

  const days: WalkRideDay[] = []
  if (nextRow) days.push({ startsAt: nextRow.starts_at, seeded: true, active: !!current })
  for (const r of upcoming.filter(r => r !== nextRow).slice(0, 3)) days.push({ startsAt: r.starts_at, seeded: true, active: false })
  // Past the seeded horizon, the recurrence itself
  const cursor = new Date(days.length ? new Date(days[days.length - 1].startsAt) : now)
  for (let i = 0; days.length < 4 && i < 6; i++) {
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    const start = lastFridayET(cursor.getUTCFullYear(), cursor.getUTCMonth())
    if (start.getTime() <= nowMs) continue
    days.push({ startsAt: start.toISOString(), seeded: false, active: false })
  }

  let prizes: PrizePool | null = null
  if (nextRow) {
    const { data: prizeRows } = await supabase
      .from('competition_prizes')
      .select('value_amount, quantity')
      .eq('competition_id', nextRow.id)
      .eq('prize_type', 'individual')
    const list = (prizeRows ?? []) as { value_amount: number | string | null; quantity: number | null }[]
    const count = list.reduce((n, p) => n + Math.max(p.quantity ?? 1, 1), 0)
    const values = list.map(p => (p.value_amount == null ? null : Number(p.value_amount)))
    const total = list.reduce((sum, p, i) => sum + (values[i] ?? 0) * Math.max(p.quantity ?? 1, 1), 0)
    const each = values.length > 0 && values.every(v => v !== null && v === values[0]) ? (values[0] as number) : null
    if (count > 0) prizes = { count, each, total }
  }

  const next = days[0] ?? null
  let moved = false
  if (next) {
    const d = new Date(next.startsAt)
    const lf = lastFridayET(d.getUTCFullYear(), d.getUTCMonth())
    moved = Math.abs(lf.getTime() - d.getTime()) > 36 * 3600_000
  }
  return { next, later: days.slice(1), prizes, moved }
}
