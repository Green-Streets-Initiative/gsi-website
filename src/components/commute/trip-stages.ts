/**
 * The six stages of a trip, one short fact each, so a reader can picture
 * a way in without reading a paragraph: what to wear, the vehicle, what
 * carries their things, the route, whether they drive or ride, how they
 * arrive, and where the vehicle goes. Pure: every fact is grounded in data
 * the plan already has (the result, the employer's benefits, the calm
 * route, the racks found by the office). Nothing is invented: a benefit
 * the employer did not enter never appears.
 */

import type { AdvisorCombo, AdvisorResult, BikeParkingSpot, EmployerBenefits } from '@/lib/types/commute'
import { comfortBreakdown, type CalmRoute } from './calm-route'
import { RACK_AT_DOOR_MILES, mergeRacks } from './plan-data'

export type StageLabel = 'Wear' | 'Vehicle' | 'Cargo' | 'Route' | 'Seat' | 'Arrive' | 'Store'

export interface TripStage {
  label: StageLabel
  /** At most four words, grounded in the plan. */
  fact: string
  /** Nothing to do at this stage (no vehicle, nothing to store): drawn faint. */
  muted: boolean
}

export interface StageExtras {
  calm?: CalmRoute | null
  /** Racks found near the office (OpenStreetMap), beyond what the engine returned. */
  bikeParking?: BikeParkingSpot[]
  /** The transit row's line name ("Red Line"), when the legs are known. */
  lineName?: string | null
  /** A shuttle row: where it stops and how far that is from the door. */
  shuttle?: { stopName: string; distanceMiles: number } | null
  /** A park-and-ride or bike-to-train row: its two legs, station and lot. */
  combo?: AdvisorCombo | null
}

/** Over this, a ride or a walk is long enough that the weather matters. */
const LAYERS_OVER_MILES = 2
/** A brisk commute walk, 3 mph: 20 minutes to the mile. */
const WALK_MINUTES_PER_MILE = 20
/** A tier that covers this much of the ride names the route. */
const MOSTLY_PCT = 60

const mi = (n: number | null | undefined) => (n == null ? null : n < 10 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.round(n)))

const stage = (label: StageLabel, fact: string, muted = false): TripStage => ({ label, fact, muted })

/** "Mostly protected lane" / "Mostly quiet streets" / "Mixed streets" from the calm route's tiers. */
export function routeSummaryWord(calm: CalmRoute | null | undefined): string | null {
  if (!calm) return null
  const buckets = comfortBreakdown(calm.calm.comfort_segments)
  if (buckets.length === 0) return null
  const top = buckets.reduce((a, b) => (b.pct > a.pct ? b : a))
  if (top.pct < MOSTLY_PCT) return 'Mixed streets'
  const words: Record<string, string> = {
    path: 'Mostly on paths',
    protected: 'Mostly protected lane',
    bike_lane: 'Mostly bike lanes',
    quiet_street: 'Mostly quiet streets',
    shared_road: 'Mostly shared streets',
  }
  return words[top.rating] ?? 'Mixed streets'
}

/** Minutes on foot from the alighting stop to the door: Google's walking steps, else the stop's distance to the office. */
function walkFromStopMinutes(result: AdvisorResult): number | null {
  if (result.transit_walk_after_minutes != null) return result.transit_walk_after_minutes > 0 ? result.transit_walk_after_minutes : null
  const last = result.transit_legs[result.transit_legs.length - 1]
  if (!last) return null
  const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const want = norm(last.arrival_stop_name)
  const stop = result.nearby.stops.find((s) => norm(s.name) === want) ?? result.nearby.stops.find((s) => norm(s.name).startsWith(want) || want.startsWith(norm(s.name)))
  if (!stop || stop.distance_miles == null) return null
  return Math.max(1, Math.round(stop.distance_miles * WALK_MINUTES_PER_MILE))
}

function isRail(routeType: string | null | undefined, routeId: string | null | undefined): boolean {
  const t = (routeType ?? '').toLowerCase()
  const id = (routeId ?? '').toLowerCase()
  if (t === 'bus' || t === '3' || /^\d+$/.test(id) || /^sl\d/.test(id) || /^ct\d/.test(id)) return false
  return true
}

/**
 * The racks on the map as a short fact: "Rack at the door, 2 spaces" when
 * the nearest is at the door and its size is known, "Rack at the door"
 * without a size, "Racks nearby" when the nearest is a short walk.
 */
function rackFact(spots: BikeParkingSpot[]): string | null {
  const s = spots[0]
  if (!s) return null
  if (s.distance_miles < RACK_AT_DOOR_MILES) {
    const kind = s.covered ? 'Covered rack' : 'Rack'
    return s.capacity ? `${kind} at the door, ${s.capacity} space${s.capacity === 1 ? '' : 's'}` : `${kind} at the door`
  }
  return spots.length > 1 ? 'Racks nearby' : 'Rack nearby'
}

/** First few words of a free-text benefit ("Bike room, garage level B"). */
function short(text: string, maxWords = 4): string {
  const words = text.replace(/[.\s]+$/, '').split(/\s+/)
  return words.length <= maxWords ? words.join(' ') : `${words.slice(0, maxWords).join(' ')}…`
}

export function stagesFor(mode: string, result: AdvisorResult, benefits: EmployerBenefits, extras: StageExtras = {}): TripStage[] {
  const m = result.modes[mode]
  const miles = m?.miles ?? result.distance_miles
  const longEnough = miles != null && miles > LAYERS_OVER_MILES

  switch (mode) {
    case 'bike':
    case 'ebike': {
      const racks = mergeRacks(result.nearby.bike_parking, extras.bikeParking)
      const found = rackFact(racks)
      const arrive = found
        ?? (benefits.bike_parking ? (benefits.bike_parking_details ? short(benefits.bike_parking_details) : 'Bike parking at work') : 'Ask about bike parking')
      const store = benefits.bike_parking
        ? benefits.bike_parking_details ? short(benefits.bike_parking_details) : 'Lock inside'
        : racks.some((r) => r.covered) ? 'Lock inside' : 'U-lock outside'
      return [
        stage('Wear', longEnough ? 'Layers; rain gear' : 'Anything'),
        stage('Vehicle', result.nearby.docks_home.length > 0 ? 'Your bike or Bluebikes' : 'Your bike'),
        stage('Cargo', 'Pannier or basket'),
        stage('Route', routeSummaryWord(extras.calm) ?? (mi(miles) ? `${mi(miles)} mi` : 'Calm route')),
        stage('Arrive', arrive),
        stage('Store', store),
      ]
    }
    case 'walk':
      return [
        stage('Wear', longEnough ? 'Layers; rain gear' : 'Anything'),
        stage('Vehicle', 'None needed', true),
        stage('Cargo', 'Backpack'),
        stage('Route', mi(miles) ? `${mi(miles)} mi` : 'On foot'),
        stage('Arrive', 'Straight to the door'),
        stage('Store', 'Nothing to store', true),
      ]
    case 'drive': {
      const parking = result.costs.parking_per_day > 0
        ? `Garage, $${result.costs.parking_per_day} a day`
        : benefits.free_parking ? 'Free parking' : 'No parking cost entered'
      return [
        stage('Wear', 'Anything'),
        stage('Vehicle', 'Your car'),
        stage('Cargo', 'Trunk'),
        stage('Route', mi(miles) ? `${mi(miles)} mi, traffic` : 'By road'),
        stage('Arrive', parking),
        stage('Store', 'Car in garage'),
      ]
    }
    case 'park_ride':
    case 'bike_ride': {
      // Two legs: the car or bike to the station, the train in. The lot is a
      // fact (its fee and size when the operator lists them), never a reason.
      const c = extras.combo ?? m?.combo ?? null
      const station = c?.station.name ?? 'the station'
      const firstMiles = c ? mi(c.first_leg.miles) : null
      const lineRaw = c?.transit_legs[0]?.route_name ?? null
      const line = lineRaw ? (/^\d+$/.test(lineRaw) ? `${lineRaw} bus` : lineRaw) : 'train'
      const last = c?.transit_legs[c.transit_legs.length - 1] ?? null
      const walk = c?.walk_from_minutes ?? null
      const arriveOffice = last
        ? walk != null && walk > 0 ? `Walk ${walk} min from ${last.arrival_stop_name}` : `From ${last.arrival_stop_name}`
        : 'Walk from the station'
      if (mode === 'park_ride') {
        const fee = c?.station.lot_fee_per_day ?? null
        const cap = c?.station.lot_capacity ?? null
        const spaces = cap ? `${cap.toLocaleString('en-US')} spaces` : null
        const lot = fee != null && fee > 0
          ? spaces ? `$${fee} a day, ${spaces}` : `$${fee} a day`
          : fee === 0
            ? spaces ? `Free lot, ${spaces}` : 'Free lot'
            : spaces ? `Lot at ${station}, ${spaces}` : `Lot at ${station}`
        return [
          stage('Wear', 'Anything'),
          stage('Vehicle', `Your car to ${station}`),
          stage('Cargo', 'Bag or tote'),
          stage('Route', firstMiles ? `${firstMiles} mi, then ${line}` : `Then ${line}`),
          stage('Arrive', lot),
          stage('Store', 'Car at the lot'),
        ]
      }
      const bikeLong = c != null && c.first_leg.miles > LAYERS_OVER_MILES
      return [
        stage('Wear', bikeLong ? 'Layers; rain gear' : 'Anything'),
        stage('Vehicle', `Your bike to ${station}`),
        stage('Cargo', 'Pannier or backpack'),
        stage('Route', firstMiles ? `${firstMiles} mi, then ${line}` : `Then ${line}`),
        stage('Arrive', arriveOffice),
        stage('Store', 'Bike at the station rack'),
      ]
    }
    case 'shuttle': {
      const s = extras.shuttle
      const walk = s ? Math.max(1, Math.round(s.distanceMiles * WALK_MINUTES_PER_MILE)) : null
      return [
        stage('Wear', 'Anything'),
        stage('Vehicle', 'None needed', true),
        stage('Cargo', 'Bag or tote'),
        stage('Route', s ? `Stops at ${s.stopName}` : 'Shuttle'),
        stage('Arrive', s && walk != null ? (s.distanceMiles < 0.05 ? 'At the door' : `Walk ${walk} min from stop`) : 'At the stop'),
        stage('Store', 'Nothing to store', true),
      ]
    }
    default: {
      // transit, bus
      const last = result.transit_legs[result.transit_legs.length - 1]
      // The row's own name already says the lines ("Route 85, then Red
      // Line"); the strip says the shape of the ride in two or three words.
      const legs = result.transit_legs
      const changes = legs.length - 1
      const stops = legs.reduce((n, l) => n + (l.num_stops ?? 0), 0)
      const route = legs.length === 0
        ? result.transit_summary ?? 'Bus or train'
        : changes > 0
          ? `${changes} change${changes === 1 ? '' : 's'}`
          : stops > 0 ? `${stops} stops, no change` : 'No change'
      const walk = walkFromStopMinutes(result)
      // The stop is named in the row ("Davis → Downtown Crossing") and the
      // leg chips; the strip only has room for the walk.
      const place = last && isRail(last.route_type, last.route_id) ? 'station' : 'stop'
      const arrive = last
        ? walk != null ? `Walk ${walk} min from ${place}` : `From the ${place}`
        : 'Walk from the stop'
      return [
        stage('Wear', 'Anything'),
        stage('Vehicle', 'None needed', true),
        stage('Cargo', 'Bag or tote'),
        stage('Route', route),
        stage('Arrive', arrive),
        stage('Store', 'Nothing to store', true),
      ]
    }
  }
}
