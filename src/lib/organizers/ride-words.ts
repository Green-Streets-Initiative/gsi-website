/**
 * Words the console shares with the Shift app's ride form, so a ride reads
 * the same on both. Copy follows the site rules: people, not "riders".
 */
import type { Pace } from './types'

export const TAG_OPTIONS: { key: string; label: string }[] = [
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid' },
  { key: 'beginner_friendly', label: 'Beginner friendly' },
  { key: 'registration_required', label: 'Registration required' },
  { key: 'family_friendly', label: 'Family friendly' },
  { key: 'seniors', label: 'Seniors' },
  { key: 'lgbtq', label: 'LGBTQ+' },
  { key: 'women', label: 'Women' },
  { key: 'spanish', label: 'Spanish' },
  { key: 'bilingual', label: 'Bilingual' },
  { key: 'students', label: 'Students' },
  { key: 'advocacy', label: 'Advocacy' },
]

/** Same bands and speeds as the app (lib/ride-pace.ts) and the events calendar. */
export const PACE_OPTIONS: { key: Pace; label: string; mph: string; hint: string }[] = [
  { key: 'relaxed', label: 'Relaxed', mph: '8–12 mph', hint: 'Chatty, plenty of stops' },
  { key: 'moderate', label: 'Moderate', mph: '12–15 mph', hint: 'Steady, a few stops' },
  { key: 'brisk', label: 'Brisk', mph: '15–18 mph', hint: 'A good workout' },
  { key: 'fast', label: 'Fast', mph: '18+ mph', hint: 'For people who train' },
  { key: 'kids', label: 'Kids & families', mph: '5–8 mph', hint: 'Small legs set the pace' },
]

/** Riding speed used for time estimates, the middle of each band (app: PACE_BANDS.mid). */
export const PACE_MID_MPH: Record<string, number> = { kids: 6, relaxed: 10, moderate: 13.5, brisk: 16.5, fast: 19 }

/** A ride is a bike ride or a group walk (ride_series.activity, Shift 01660). */
export type Activity = 'bike' | 'walk'

/**
 * A walk's paces. Walks have no "fast"; time estimates use one walking
 * speed, the same 3 mph the app (lib/ride-pace.ts WALK_MPH), the planner and
 * live sharing use.
 */
export const WALK_MPH = 3
export const WALK_PACE_OPTIONS: { key: Pace; label: string; mph: string; hint: string }[] = [
  { key: 'relaxed', label: 'Relaxed', mph: 'Strolling, with stops', hint: 'Chatty, plenty of stops' },
  { key: 'moderate', label: 'Moderate', mph: 'A steady walk', hint: 'Steady, a few stops' },
  { key: 'brisk', label: 'Brisk', mph: 'A good workout', hint: 'A good workout' },
  { key: 'kids', label: 'Kids & families', mph: 'Small legs set the pace', hint: 'Small legs set the pace' },
]

export const paceOptionsFor = (activity: Activity) => (activity === 'walk' ? WALK_PACE_OPTIONS : PACE_OPTIONS)

/** Speed for a time estimate: walking speed for a walk, the pace's middle for a ride, null when no pace is set. */
export function travelMph(pace: string | null | undefined, activity: Activity): number | null {
  if (activity === 'walk') return WALK_MPH
  return pace && PACE_MID_MPH[pace] ? PACE_MID_MPH[pace] : null
}

export const DAY_LABELS: { key: number; short: string; long: string }[] = [
  { key: 1, short: 'Mon', long: 'Monday' },
  { key: 2, short: 'Tue', long: 'Tuesday' },
  { key: 3, short: 'Wed', long: 'Wednesday' },
  { key: 4, short: 'Thu', long: 'Thursday' },
  { key: 5, short: 'Fri', long: 'Friday' },
  { key: 6, short: 'Sat', long: 'Saturday' },
  { key: 7, short: 'Sun', long: 'Sunday' },
]

export const WEEK_OPTIONS: { key: number; label: string }[] = [
  { key: 1, label: '1st' },
  { key: 2, label: '2nd' },
  { key: 3, label: '3rd' },
  { key: 4, label: '4th' },
  { key: -1, label: 'Last' },
]

export const UPDATE_PRESETS: {
  kind: 'on' | 'late' | 'weather' | 'note'
  label: string
  needsDate: boolean
  needsNote: boolean
  placeholder: string
}[] = [
  { kind: 'on', label: "It's on", needsDate: true, needsNote: false, placeholder: 'Anything to add? (optional)' },
  { kind: 'late', label: 'Running late', needsDate: true, needsNote: false, placeholder: 'How late, and where to wait (optional)' },
  { kind: 'weather', label: 'Weather call', needsDate: false, needsNote: true, placeholder: 'Rain gear advised, route shortened to the river loop…' },
  { kind: 'note', label: 'Note', needsDate: false, needsNote: true, placeholder: 'Bring lights: we finish after sunset.' },
]

export const UPDATE_KIND_LABEL: Record<string, string> = {
  on: "It's on",
  late: 'Running late',
  weather: 'Weather call',
  note: 'Note',
  canceled: 'Date cancelled',
  changed: 'Date changed',
  ended: 'Ride ended',
  break: 'Taking a break',
  resumed: 'Back on',
}

/** "2026-11-07" -> "Sat, Nov 7". Dates are calendar dates, never shifted. */
export function dateLabel(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

/** "2026-11-01" -> "November 2026". */
export function monthLabel(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

/** Today in Boston, as YYYY-MM-DD. */
export function todayKey(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

export const RIDE_PAGE_BASE = 'https://www.gogreenstreets.org/rides'
