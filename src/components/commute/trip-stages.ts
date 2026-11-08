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
import { wearFor, type MorningWeather } from '@/lib/commute/weather'
import { SITE_LOCALE_TAG, translator, type SiteLocale, type T } from '@/lib/site-i18n'
import { advisorStrings } from '@/lib/site-strings/advisor'

type AdvisorT = T<keyof typeof advisorStrings.en & string>

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
  /** The forecast for this way in's leave-by (src/lib/commute/weather.ts); the Wear stage reads it. */
  weather?: MorningWeather | null
}

/** Over this, a ride or a walk is long enough that the weather matters. */
const LAYERS_OVER_MILES = 2
/** A brisk commute walk, 3 mph: 20 minutes to the mile. */
const WALK_MINUTES_PER_MILE = 20
/** A tier that covers this much of the ride names the route. */
const MOSTLY_PCT = 60

const mi = (n: number | null | undefined) => (n == null ? null : n < 10 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.round(n)))

const stage = (label: StageLabel, fact: string, muted = false): TripStage => ({ label, fact, muted })

const STAGE_LABEL_KEY = {
  Wear: 'stage.label_wear',
  Vehicle: 'stage.label_vehicle',
  Cargo: 'stage.label_cargo',
  Route: 'stage.label_route',
  Seat: 'stage.label_seat',
  Arrive: 'stage.label_arrive',
  Store: 'stage.label_store',
} as const satisfies Record<StageLabel, string>

/** A stage's name as the reader sees it ("Wear" stays the id). */
export function stageLabel(label: StageLabel, locale: SiteLocale = 'en'): string {
  return translator(advisorStrings, locale)(STAGE_LABEL_KEY[label])
}

/**
 * What to wear for a way in that waits outside (a bus stop, a platform, a
 * shuttle stop). Keith 2026-10-21: a bus can mean 15-20 minutes standing in
 * the cold, so layering is key and a jacket may not cut it. The forecast
 * for the leave-by hour decides (product item 17): cold says layers for the
 * wait, rain says an umbrella or a rain jacket. Until the forecast loads, or
 * when the Weather Service can't answer, the Boston cold months stand in:
 * November through March.
 */
function waitWear(mode: string, weather: MorningWeather | null | undefined, t: AdvisorT, locale: SiteLocale, now: Date = new Date()): string {
  const forecast = wearFor(weather, mode, locale)
  if (forecast) return forecast
  const m = now.getMonth()
  return m >= 10 || m <= 2 ? t('stage.wear_wait') : t('stage.wear_anything')
}

/** What to wear for a ride or a walk: the forecast, else layers and rain gear on a long one. */
function activeWear(mode: string, weather: MorningWeather | null | undefined, long: boolean, t: AdvisorT, locale: SiteLocale): string {
  return wearFor(weather, mode, locale) ?? (long ? t('stage.wear_long') : t('stage.wear_anything'))
}

/** "Mostly protected lane" / "Mostly quiet streets" / "Mixed streets" from the calm route's tiers. */
export function routeSummaryWord(calm: CalmRoute | null | undefined, locale: SiteLocale = 'en'): string | null {
  if (!calm) return null
  const t = translator(advisorStrings, locale)
  const buckets = comfortBreakdown(calm.calm.comfort_segments)
  if (buckets.length === 0) return null
  const top = buckets.reduce((a, b) => (b.pct > a.pct ? b : a))
  if (top.pct < MOSTLY_PCT) return t('stage.route_mixed')
  const words: Record<string, string> = {
    path: t('stage.route_path'),
    protected: t('stage.route_protected'),
    bike_lane: t('stage.route_bike_lane'),
    quiet_street: t('stage.route_quiet'),
    shared_road: t('stage.route_shared'),
  }
  return words[top.rating] ?? t('stage.route_mixed')
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
function rackFact(spots: BikeParkingSpot[], t: AdvisorT): string | null {
  const s = spots[0]
  if (!s) return null
  if (s.distance_miles < RACK_AT_DOOR_MILES) {
    if (s.capacity) {
      const one = s.capacity === 1
      return s.covered
        ? t(one ? 'stage.covered_door_spaces_one' : 'stage.covered_door_spaces', { count: s.capacity })
        : t(one ? 'stage.rack_door_spaces_one' : 'stage.rack_door_spaces', { count: s.capacity })
    }
    return t(s.covered ? 'stage.covered_door' : 'stage.rack_door')
  }
  return spots.length > 1 ? t('stage.racks_nearby') : t('stage.rack_nearby')
}

/** First few words of a free-text benefit ("Bike room, garage level B"). */
function short(text: string, maxWords = 4): string {
  const words = text.replace(/[.\s]+$/, '').split(/\s+/)
  return words.length <= maxWords ? words.join(' ') : `${words.slice(0, maxWords).join(' ')}…`
}

export function stagesFor(mode: string, result: AdvisorResult, benefits: EmployerBenefits, extras: StageExtras = {}, locale: SiteLocale = 'en'): TripStage[] {
  const t = translator(advisorStrings, locale)
  const m = result.modes[mode]
  const miles = m?.miles ?? result.distance_miles
  const longEnough = miles != null && miles > LAYERS_OVER_MILES

  switch (mode) {
    case 'bike':
    case 'ebike': {
      const racks = mergeRacks(result.nearby.bike_parking, extras.bikeParking)
      const found = rackFact(racks, t)
      // The employer's own words about its bike room stay as written.
      const arrive = found
        ?? (benefits.bike_parking ? (benefits.bike_parking_details ? short(benefits.bike_parking_details) : t('stage.bike_parking_work')) : t('stage.ask_bike_parking'))
      const store = benefits.bike_parking
        ? benefits.bike_parking_details ? short(benefits.bike_parking_details) : t('stage.lock_inside')
        : racks.some((r) => r.covered) ? t('stage.lock_inside') : t('stage.u_lock_outside')
      return [
        stage('Wear', activeWear(mode, extras.weather, longEnough, t, locale)),
        stage('Vehicle', result.nearby.docks_home.length > 0 ? t('stage.your_bike_or_share') : t('stage.your_bike')),
        stage('Cargo', t('stage.pannier_basket')),
        stage('Route', routeSummaryWord(extras.calm, locale) ?? (mi(miles) ? t('stage.miles', { miles: mi(miles) }) : t('stage.calm_route'))),
        stage('Arrive', arrive),
        stage('Store', store),
      ]
    }
    case 'walk':
      return [
        stage('Wear', activeWear('walk', extras.weather, longEnough, t, locale)),
        stage('Vehicle', t('stage.none_needed'), true),
        stage('Cargo', t('stage.backpack')),
        stage('Route', mi(miles) ? t('stage.miles', { miles: mi(miles) }) : t('stage.on_foot')),
        stage('Arrive', t('stage.straight_to_door')),
        stage('Store', t('stage.nothing_to_store'), true),
      ]
    case 'drive': {
      const parking = result.costs.parking_per_day > 0
        ? t('stage.garage_day', { amount: `$${result.costs.parking_per_day}` })
        : benefits.free_parking ? t('stage.free_parking') : t('stage.no_parking_cost')
      return [
        stage('Wear', t('stage.wear_anything')),
        stage('Vehicle', t('stage.your_car')),
        stage('Cargo', t('stage.trunk')),
        stage('Route', mi(miles) ? t('stage.miles_traffic', { miles: mi(miles) }) : t('stage.by_road')),
        stage('Arrive', parking),
        stage('Store', t('stage.car_in_garage')),
      ]
    }
    case 'park_ride':
    case 'bike_ride': {
      // Two legs: the car or bike to the station, the train in. The lot is a
      // fact (its fee and size when the operator lists them), never a reason.
      const c = extras.combo ?? m?.combo ?? null
      const station = c?.station.name ?? t('stage.the_station')
      const firstMiles = c ? mi(c.first_leg.miles) : null
      const lineRaw = c?.transit_legs[0]?.route_name ?? null
      const line = lineRaw ? (/^\d+$/.test(lineRaw) ? t('stage.line_bus', { n: lineRaw }) : lineRaw) : t('stage.line_train')
      const last = c?.transit_legs[c.transit_legs.length - 1] ?? null
      const walk = c?.walk_from_minutes ?? null
      const arriveOffice = last
        ? walk != null && walk > 0 ? t('stage.walk_min_from', { minutes: walk, stop: last.arrival_stop_name }) : t('stage.from_stop_name', { stop: last.arrival_stop_name })
        : t('stage.walk_from_station')
      if (mode === 'park_ride') {
        const fee = c?.station.lot_fee_per_day ?? null
        const cap = c?.station.lot_capacity ?? null
        const spaces = cap ? cap.toLocaleString(SITE_LOCALE_TAG[locale]) : null
        const lot = fee != null && fee > 0
          ? spaces ? t('stage.lot_fee_spaces', { amount: `$${fee}`, spaces }) : t('stage.lot_fee', { amount: `$${fee}` })
          : fee === 0
            ? spaces ? t('stage.free_lot_spaces', { spaces }) : t('stage.free_lot')
            : spaces ? t('stage.lot_at_spaces', { station, spaces }) : t('stage.lot_at', { station })
        return [
          stage('Wear', waitWear('park_ride', extras.weather, t, locale)),
          stage('Vehicle', t('stage.car_to', { station })),
          stage('Cargo', t('stage.bag_tote')),
          stage('Route', firstMiles ? t('stage.miles_then', { miles: firstMiles, line }) : t('stage.then_line', { line })),
          stage('Arrive', lot),
          stage('Store', t('stage.car_at_lot')),
        ]
      }
      const bikeLong = c != null && c.first_leg.miles > LAYERS_OVER_MILES
      return [
        stage('Wear', activeWear('bike_ride', extras.weather, bikeLong, t, locale)),
        stage('Vehicle', t('stage.bike_to', { station })),
        stage('Cargo', t('stage.pannier_backpack')),
        stage('Route', firstMiles ? t('stage.miles_then', { miles: firstMiles, line }) : t('stage.then_line', { line })),
        stage('Arrive', arriveOffice),
        stage('Store', t('stage.bike_station_rack')),
      ]
    }
    case 'shuttle': {
      const s = extras.shuttle
      const walk = s ? Math.max(1, Math.round(s.distanceMiles * WALK_MINUTES_PER_MILE)) : null
      return [
        stage('Wear', waitWear('shuttle', extras.weather, t, locale)),
        stage('Vehicle', t('stage.none_needed'), true),
        stage('Cargo', t('stage.bag_tote')),
        stage('Route', s ? t('stage.stops_at', { stop: s.stopName }) : t('stage.shuttle')),
        stage('Arrive', s && walk != null ? (s.distanceMiles < 0.05 ? t('stage.at_door') : t('stage.walk_min_from_stop', { minutes: walk })) : t('stage.at_stop')),
        stage('Store', t('stage.nothing_to_store'), true),
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
      // transit_summary is the engine's own text (English).
      const route = legs.length === 0
        ? result.transit_summary ?? t('stage.bus_or_train')
        : changes > 0
          ? t(changes === 1 ? 'stage.changes_one' : 'stage.changes', { count: changes })
          : stops > 0 ? t('stage.stops_no_change', { count: stops }) : t('stage.no_change')
      const walk = walkFromStopMinutes(result)
      // The stop is named in the row ("Davis → Downtown Crossing") and the
      // leg chips; the strip only has room for the walk.
      const rail = !!last && isRail(last.route_type, last.route_id)
      const arrive = last
        ? walk != null
          ? t(rail ? 'stage.walk_min_from_station' : 'stage.walk_min_from_stop', { minutes: walk })
          : t(rail ? 'stage.from_the_station' : 'stage.from_the_stop')
        : t('stage.walk_from_stop')
      return [
        stage('Wear', waitWear('transit', extras.weather, t, locale)),
        stage('Vehicle', t('stage.none_needed'), true),
        stage('Cargo', t('stage.bag_tote')),
        stage('Route', route),
        stage('Arrive', arrive),
        stage('Store', t('stage.nothing_to_store'), true),
      ]
    }
  }
}
