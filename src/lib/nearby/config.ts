// Single rename point for the snapshot page's URL.
export const NEARBY_PATH = '/nearby'

// Rough MBTA service-area check — Boston Common as center.
export const BOSTON_CENTER = { lat: 42.3601, lng: -71.0589 }
export const OUTSIDE_AREA_MILES = 40

/**
 * Landmark destinations for the "where can you get from here?" section —
 * the places a newcomer actually wants to reach. Curated, not exhaustive;
 * edit freely. (Foxborough is deliberately absent: commuter rail there runs
 * mainly on event days, so a typical-weekday time would mislead.)
 */
export const REACH_DESTINATIONS = [
  { id: 'harvard', name: 'Harvard Square', lat: 42.3736, lng: -71.1190 },
  { id: 'kendall', name: 'Kendall / MIT', lat: 42.3625, lng: -71.0862 },
  { id: 'downtown', name: 'Downtown Crossing', lat: 42.3555, lng: -71.0605 },
  { id: 'backbay', name: 'Back Bay', lat: 42.3473, lng: -71.0755 },
  { id: 'fenway', name: 'Fenway Park', lat: 42.3467, lng: -71.0972 },
  { id: 'seaport', name: 'Seaport', lat: 42.3519, lng: -71.0430 },
  { id: 'northstation', name: 'North Station', lat: 42.3664, lng: -71.0620 },
  { id: 'airport', name: 'Logan Airport', lat: 42.3656, lng: -71.0096 },
] as const

/** Skip destinations closer than this — "how do I get there" isn't a question
 *  when you can see it from your porch. */
export const REACH_SKIP_WITHIN_MILES = 0.75

/**
 * Curated Unsplash photos for marquee corridors — same mechanism Roams use.
 * Key: the corridor's lowercase name (as reported by the bike-network data,
 * e.g. 'somerville community path'); value: an Unsplash photo id.
 * When a corridor has an entry here it beats the Street View default —
 * a golden-hour greenway shot sells the ride better than a gray street
 * frame. Attribution renders automatically (Unsplash requires it).
 */
export const CORRIDOR_UNSPLASH: Record<string, string> = {
  // 'somerville community path': 'AbC123xyz',
}
