/**
 * How hard is this ride, in the terms our riders care about?
 *
 * Ported from the Shift app (lib/ride-style.ts, shipped 2026-09-13) so the
 * website and the app call the same ride the same thing. Keep the two in
 * step: same precedence, same word lists, same test cases.
 *
 * The events list mixes rides for people getting started with shop and club
 * rides: 20-mile road rides, gravel, mountain biking. Without a level they
 * look identical, and a beginner can't tell "Comm Ave Slow Roll" from
 * "Needham Intermediate/Advanced Road Ride". One rider found that out the
 * hard way at a 21-mile "beginner" ride.
 *
 * Three styles, derived from what we already store:
 *   easy      social, family, beginner, slow roll, short
 *   moderate  a steady pace, some distance
 *   rec       recreational: road, gravel, trail, "intermediate/advanced"
 *
 * `null` when nothing in the listing says: we never assert a level we can't
 * support. The organizer's own pace band (event_details.pace, the same five
 * bands the ride planner uses) always wins over anything inferred.
 */

export type RideStyle = 'easy' | 'moderate' | 'rec'

/** The five-band pace scale shared with ride_series.pace. */
export type PaceBand = 'kids' | 'relaxed' | 'moderate' | 'brisk' | 'fast'

export interface RideStyleInput {
  title?: string | null
  description?: string | null
  /** Free text as listed: "21 miles", "20-25 miles", "90 minutes". */
  distanceText?: string | null
  tags?: string[] | null
  /** Stated by the organizer; beats every inferred signal. */
  pace?: string | null
  eventType?: string | null
}

/** Recreational riding: a sport, not a way of getting somewhere. */
const REC_WORDS =
  /\b(road ride|road bike|gravel|mtb|mountain bik\w*|singletrack|intermediate|advanced|paceline|drop ride|training ride|club ride|century|metric century|race|time trial|spirited|fast[- ]paced)\b/i

/** Rides that welcome someone on their third ever bike ride. */
const EASY_WORDS =
  /\b(slow roll|social|casual|leisurely|family|families|kids|children|beginner|beginners|no[- ]drop|all levels|all abilities|learn to|intro to|introduction|first[- ]time|mini[- ]ride|bike bus|bike train|community ride|group roll)\b/i

/** Leading number in "21 miles" / "20-25 miles"; null for "90 minutes". */
export function parseMiles(distanceText?: string | null): number | null {
  if (!distanceText) return null
  if (!/\b(mi|mile|miles|km)\b/i.test(distanceText)) return null
  const m = distanceText.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  // Listed in km, judged in miles.
  return /\bkm\b/i.test(distanceText) ? n * 0.621371 : n
}

function fromPace(pace?: string | null): RideStyle | null {
  switch (pace) {
    case 'kids':
    case 'relaxed':
      return 'easy'
    case 'moderate':
      return 'moderate'
    case 'brisk':
    case 'fast':
      return 'rec'
    default:
      return null
  }
}

/** Only rides get a style; a repair clinic or a festival doesn't. */
export function isRideEvent(eventType?: string | null): boolean {
  return eventType === 'group_ride' || eventType === 'guided_ride' || eventType === 'bike_bus'
}

export function rideStyle(input: RideStyleInput): RideStyle | null {
  if (input.eventType != null && !isRideEvent(input.eventType)) return null

  // 1. What the organizer said.
  const stated = fromPace(input.pace)
  if (stated) return stated

  // A bike bus is kids' pace by definition.
  if (input.eventType === 'bike_bus') return 'easy'

  const text = `${input.title ?? ''} ${input.description ?? ''}`
  const tags = input.tags ?? []
  const miles = parseMiles(input.distanceText)

  // 2. Distance settles it: twenty miles is a recreational outing whatever
  //    the listing calls its skill level ("Beginner Road Ride · 21 miles").
  if (miles != null && miles >= 20) return 'rec'

  // 3. The discipline named in the listing.
  if (REC_WORDS.test(text)) return 'rec'

  // 4. Explicitly welcoming.
  if (EASY_WORDS.test(text) || tags.includes('beginner_friendly') || tags.includes('family_friendly')) {
    return 'easy'
  }

  // 5. Distance alone, when that's all we have.
  if (miles != null) return miles >= 12 ? 'moderate' : 'easy'

  // 6. Nothing to go on.
  return null
}

export const RIDE_STYLE_ORDER: RideStyle[] = ['easy', 'moderate', 'rec']

/** Short label for the level slot on a card or detail header. "Rec", never "Fitness". */
export const RIDE_STYLE_LABEL: Record<RideStyle, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  rec: 'Rec',
}

/** Plural, for the filter that selects them. */
export const RIDE_STYLE_FILTER_LABEL: Record<RideStyle, string> = {
  easy: 'Easy rides',
  moderate: 'Moderate rides',
  rec: 'Rec rides',
}

/** One line under each filter row, so a first-timer knows which to pick. */
export const RIDE_STYLE_BLURB: Record<RideStyle, string> = {
  easy: 'Social pace, short distance, new riders welcome',
  moderate: 'A steady pace with some distance',
  rec: 'Road, gravel, trail, or a faster club pace',
}

/** Easy rides lead in lime; rec rides step back so the eye lands on the
 *  rides this site is for. */
export const RIDE_STYLE_COLOR: Record<RideStyle, string> = {
  easy: '#BAF14D',
  moderate: '#5FD4BD',
  rec: 'rgba(255,255,255,0.75)',
}

/** Filter values are namespaced so a level can't collide with an event type. */
export const STYLE_FILTER_PREFIX = 'style:'
export function styleFilterValue(style: RideStyle): string {
  return STYLE_FILTER_PREFIX + style
}
export function parseStyleFilter(value: string | null | undefined): RideStyle | null {
  if (!value || !value.startsWith(STYLE_FILTER_PREFIX)) return null
  const s = value.slice(STYLE_FILTER_PREFIX.length)
  return s === 'easy' || s === 'moderate' || s === 'rec' ? s : null
}
