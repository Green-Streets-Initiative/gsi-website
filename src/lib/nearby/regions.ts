/**
 * Regional destination lists for the reach ("where can you get from here?")
 * service — Around You M6 (Shift app) + future regional web support.
 *
 * Lists come from the Around You spec's Appendix A (Shift repo,
 * docs/specs/nearby-in-app.md): generated from GTFS service ranking + OSM
 * anchors + aggregate Shift trip clusters, independently fact-checked
 * (all coordinates reverse-geocoded 2026-08-18), and approved by Keith.
 * Greater Boston keeps the original curated list in config.ts.
 *
 * Resolution: nearest region anchor within its service radius; else Boston
 * when within its radius; else nearest anchor within 60 miles (cluster-
 * earned principle — serve the closest real list rather than nothing);
 * else null (destinations section hides).
 */

import { REACH_DESTINATIONS, BOSTON_CENTER } from './config'

export interface RegionDestination {
  id: string
  name: string
  lat: number
  lng: number
}

export interface Region {
  id: string
  /** User-facing area label ("Worcester area"). */
  label: string
  anchor: { lat: number; lng: number }
  radiusMiles: number
  destinations: RegionDestination[]
}

export const REGIONS: Region[] = [
  {
    id: 'boston',
    label: 'Greater Boston',
    anchor: BOSTON_CENTER,
    radiusMiles: 40,
    destinations: REACH_DESTINATIONS.map(d => ({ id: d.id, name: d.name, lat: d.lat, lng: d.lng })),
  },
  {
    id: 'worcester',
    label: 'Worcester area',
    anchor: { lat: 42.2626, lng: -71.8023 },
    radiusMiles: 15,
    destinations: [
      { id: 'wor-union', name: 'Worcester Union Station', lat: 42.2609, lng: -71.7967 },
      { id: 'wor-downtown', name: 'Downtown Worcester', lat: 42.2618, lng: -71.8015 },
      { id: 'wor-umassmem', name: 'UMass Memorial — University Campus', lat: 42.2772, lng: -71.7629 },
      { id: 'wor-stvincent', name: 'Saint Vincent Hospital', lat: 42.2649, lng: -71.7965 },
      { id: 'wor-clark', name: 'Clark University', lat: 42.251, lng: -71.8231 },
      { id: 'wor-wpi', name: 'Worcester Polytechnic Institute', lat: 42.2767, lng: -71.808 },
      { id: 'wor-wsu', name: 'Worcester State University', lat: 42.2678, lng: -71.8436 },
      { id: 'wor-webster', name: 'Webster Square', lat: 42.2428, lng: -71.8426 },
    ],
  },
  {
    id: 'springfield',
    label: 'Springfield–Holyoke',
    anchor: { lat: 42.106, lng: -72.5946 },
    radiusMiles: 12,
    destinations: [
      { id: 'spr-union', name: 'Springfield Union Station', lat: 42.106, lng: -72.5946 },
      { id: 'spr-downtown', name: 'Downtown Springfield', lat: 42.1033, lng: -72.5918 },
      { id: 'spr-baystate', name: 'Baystate Medical Center', lat: 42.1215, lng: -72.6026 },
      { id: 'spr-mercy', name: 'Mercy Medical Center', lat: 42.116, lng: -72.5937 },
      { id: 'spr-holyoke-tc', name: 'Holyoke Transportation Center', lat: 42.2085, lng: -72.6073 },
      { id: 'spr-holyoke-mall', name: 'Holyoke Mall', lat: 42.1679, lng: -72.64 },
      { id: 'spr-stcc', name: 'Springfield Technical CC', lat: 42.1083, lng: -72.5804 },
      { id: 'spr-hcc', name: 'Holyoke Community College', lat: 42.1941, lng: -72.6503 },
    ],
  },
  {
    id: 'noho_amherst',
    label: 'Northampton–Amherst',
    anchor: { lat: 42.35, lng: -72.58 },
    radiusMiles: 12,
    destinations: [
      { id: 'noho-umass', name: 'UMass Amherst', lat: 42.3892, lng: -72.5231 },
      { id: 'noho-amherst', name: 'Downtown Amherst', lat: 42.3778, lng: -72.5198 },
      { id: 'noho-downtown', name: 'Downtown Northampton', lat: 42.3177, lng: -72.6332 },
      { id: 'noho-smith', name: 'Smith College', lat: 42.3162, lng: -72.6417 },
      { id: 'noho-amherst-college', name: 'Amherst College', lat: 42.3717, lng: -72.5196 },
      { id: 'noho-cooley', name: 'Cooley Dickinson Hospital', lat: 42.3303, lng: -72.6533 },
      { id: 'noho-hampshire', name: 'Hampshire College', lat: 42.3247, lng: -72.5308 },
    ],
  },
  {
    id: 'merrimack',
    label: 'Merrimack Valley',
    anchor: { lat: 42.7078, lng: -71.1603 },
    radiusMiles: 15,
    destinations: [
      { id: 'mer-mcgovern', name: 'McGovern Transportation Center (Lawrence)', lat: 42.7018, lng: -71.152 },
      { id: 'mer-haverhill', name: 'Washington Square, Haverhill', lat: 42.7735, lng: -71.0823 },
      { id: 'mer-lawrence', name: 'Downtown Lawrence', lat: 42.7078, lng: -71.1603 },
      { id: 'mer-lgh', name: 'Merrimack Health Lawrence Hospital', lat: 42.7091, lng: -71.1501 },
      { id: 'mer-necc', name: 'Northern Essex CC (Riverwalk)', lat: 42.7035, lng: -71.1454 },
      { id: 'mer-loop', name: 'The Loop, Methuen', lat: 42.7441, lng: -71.1595 },
      { id: 'mer-newburyport', name: 'Downtown Newburyport', lat: 42.8117, lng: -70.8719 },
      { id: 'mer-nbpt-cr', name: 'Newburyport Station', lat: 42.7978, lng: -70.878 },
      { id: 'mer-annajaques', name: 'Anna Jaques Hospital', lat: 42.8138, lng: -70.8907 },
    ],
  },
  {
    id: 'metrowest',
    label: 'MetroWest',
    anchor: { lat: 42.2766, lng: -71.4178 },
    radiusMiles: 10,
    destinations: [
      { id: 'mw-framingham', name: 'Downtown Framingham', lat: 42.2766, lng: -71.4178 },
      { id: 'mw-golden', name: 'Natick Mall / Golden Triangle', lat: 42.3015, lng: -71.3864 },
      { id: 'mw-natick', name: 'Natick Center', lat: 42.2857, lng: -71.3471 },
      { id: 'mw-fsu', name: 'Framingham State University', lat: 42.2977, lng: -71.4372 },
      { id: 'mw-mwmed', name: 'MetroWest Medical Center', lat: 42.2844, lng: -71.42 },
      { id: 'mw-morse', name: 'Leonard Morse Hospital', lat: 42.2801, lng: -71.335 },
      { id: 'mw-milford', name: 'Milford Crossing', lat: 42.1499, lng: -71.4884 },
    ],
  },
  {
    id: 'lowell',
    label: 'Lowell area',
    anchor: { lat: 42.6363, lng: -71.3144 },
    radiusMiles: 8,
    destinations: [
      { id: 'low-gallagher', name: 'Gallagher Terminal', lat: 42.6363, lng: -71.3144 },
      { id: 'low-downtown', name: 'Downtown Lowell', lat: 42.6457, lng: -71.3097 },
      { id: 'low-uml', name: 'UMass Lowell — University Crossing', lat: 42.6495, lng: -71.3241 },
      { id: 'low-mcc', name: 'Middlesex Community College', lat: 42.6437, lng: -71.3066 },
      { id: 'low-lgh', name: 'Lowell General Hospital', lat: 42.6479, lng: -71.3421 },
      { id: 'low-nhp', name: 'Lowell National Historical Park', lat: 42.6444, lng: -71.3103 },
      { id: 'low-drumhill', name: 'Drum Hill, Chelmsford', lat: 42.6231, lng: -71.3612 },
    ],
  },
  {
    id: 'brockton',
    label: 'Brockton area',
    anchor: { lat: 42.0853, lng: -71.0153 },
    radiusMiles: 8,
    destinations: [
      { id: 'bro-bat', name: 'BAT Centre / Brockton Station', lat: 42.0853, lng: -71.0153 },
      { id: 'bro-downtown', name: 'Downtown Brockton', lat: 42.084, lng: -71.0175 },
      { id: 'bro-signature', name: 'Signature Healthcare Brockton Hospital', lat: 42.0876, lng: -70.9914 },
      { id: 'bro-goodsam', name: 'Good Samaritan Medical Center', lat: 42.0981, lng: -71.0623 },
      { id: 'bro-massasoit', name: 'Massasoit Community College', lat: 42.0771, lng: -70.9885 },
      { id: 'bro-westgate', name: 'Westgate Mall', lat: 42.0958, lng: -71.0498 },
      { id: 'bro-va', name: 'VA Boston — Brockton campus', lat: 42.0609, lng: -71.0531 },
    ],
  },
  {
    id: 'south_coast',
    label: 'South Coast',
    anchor: { lat: 41.68, lng: -71.05 },
    radiusMiles: 15,
    destinations: [
      { id: 'sc-fr-terminal', name: 'SRTA Fall River Terminal', lat: 41.6983, lng: -71.1544 },
      { id: 'sc-nb-terminal', name: 'SRTA New Bedford Terminal', lat: 41.6359, lng: -70.9276 },
      { id: 'sc-nb-cr', name: 'New Bedford Station', lat: 41.6437, lng: -70.9252 },
      { id: 'sc-fr-depot', name: 'Fall River Depot', lat: 41.714, lng: -71.1542 },
      { id: 'sc-nb-downtown', name: 'Downtown New Bedford', lat: 41.6432, lng: -70.9273 },
      { id: 'sc-fr-downtown', name: 'Downtown Fall River', lat: 41.6977, lng: -71.1597 },
      { id: 'sc-umassd', name: 'UMass Dartmouth', lat: 41.6223, lng: -71.0071 },
      { id: 'sc-stlukes', name: "St. Luke's Hospital", lat: 41.6268, lng: -70.938 },
      { id: 'sc-bcc', name: 'Bristol Community College', lat: 41.7154, lng: -71.1262 },
    ],
  },
  {
    id: 'cape_cod',
    label: 'Cape Cod',
    anchor: { lat: 41.6566, lng: -70.2802 },
    radiusMiles: 35,
    destinations: [
      { id: 'cc-htc', name: 'Hyannis Transportation Center', lat: 41.6566, lng: -70.2802 },
      { id: 'cc-main', name: 'Main Street Hyannis', lat: 41.6522, lng: -70.283 },
      { id: 'cc-ferry', name: 'Hyannis ferry docks', lat: 41.6512, lng: -70.279 },
      { id: 'cc-hospital', name: 'Cape Cod Hospital', lat: 41.6538, lng: -70.272 },
      { id: 'cc-mall', name: 'Cape Cod Mall', lat: 41.6649, lng: -70.295 },
      { id: 'cc-4cs', name: 'Cape Cod Community College', lat: 41.6933, lng: -70.3376 },
      { id: 'cc-mashpee', name: 'Mashpee Commons', lat: 41.6185, lng: -70.4905 },
      { id: 'cc-ptown', name: 'Provincetown (MacMillan Pier)', lat: 42.0493, lng: -70.1816 },
    ],
  },
  {
    id: 'cape_ann',
    label: 'Cape Ann',
    anchor: { lat: 42.6136, lng: -70.6592 },
    radiusMiles: 8,
    destinations: [
      { id: 'ca-gloucester', name: 'Downtown Gloucester', lat: 42.6136, lng: -70.6592 },
      { id: 'ca-gloucester-cr', name: 'Gloucester Station', lat: 42.6168, lng: -70.6683 },
      { id: 'ca-docksq', name: 'Dock Square, Rockport', lat: 42.6586, lng: -70.6174 },
      { id: 'ca-rockport-cr', name: 'Rockport Station', lat: 42.6555, lng: -70.6271 },
      { id: 'ca-addison', name: 'Addison Gilbert Hospital', lat: 42.6248, lng: -70.6814 },
      { id: 'ca-beaches', name: 'Front & Back Beach, Rockport', lat: 42.6589, lng: -70.6216 },
    ],
  },
  {
    id: 'montachusett',
    label: 'Fitchburg–Leominster',
    anchor: { lat: 42.5813, lng: -71.7926 },
    radiusMiles: 12,
    destinations: [
      { id: 'mo-intermodal', name: 'Fitchburg Intermodal Center', lat: 42.5813, lng: -71.7926 },
      { id: 'mo-fsu', name: 'Fitchburg State University', lat: 42.5882, lng: -71.79 },
      { id: 'mo-monument', name: 'Monument Square, Leominster', lat: 42.5264, lng: -71.7601 },
      { id: 'mo-gardner', name: 'Downtown Gardner', lat: 42.5745, lng: -71.9966 },
      { id: 'mo-whitney', name: 'Mall at Whitney Field', lat: 42.5281, lng: -71.7415 },
      { id: 'mo-leominster-hosp', name: 'HealthAlliance — Leominster Hospital', lat: 42.5417, lng: -71.7631 },
      { id: 'mo-heywood', name: 'Heywood Hospital, Gardner', lat: 42.5872, lng: -71.9872 },
    ],
  },
  {
    id: 'berkshires',
    label: 'The Berkshires',
    anchor: { lat: 42.4517, lng: -73.2545 },
    radiusMiles: 22,
    destinations: [
      { id: 'be-scelsi', name: 'Scelsi Intermodal Center, Pittsfield', lat: 42.4517, lng: -73.2545 },
      { id: 'be-downtown', name: 'Downtown Pittsfield', lat: 42.4485, lng: -73.2541 },
      { id: 'be-bmc', name: 'Berkshire Medical Center', lat: 42.46, lng: -73.249 },
      { id: 'be-bcc', name: 'Berkshire Community College', lat: 42.4577, lng: -73.3153 },
      { id: 'be-northadams', name: 'North Adams / MASS MoCA', lat: 42.6989, lng: -73.1119 },
      { id: 'be-mcla', name: 'MCLA, North Adams', lat: 42.6917, lng: -73.1045 },
      { id: 'be-williams', name: 'Williams College', lat: 42.713, lng: -73.203 },
    ],
  },
  {
    id: 'franklin',
    label: 'Franklin County',
    anchor: { lat: 42.5857, lng: -72.6006 },
    radiusMiles: 12,
    destinations: [
      { id: 'fr-olver', name: 'Downtown Greenfield / Olver Transit Center', lat: 42.5857, lng: -72.6006 },
      { id: 'fr-gcc', name: 'Greenfield Community College', lat: 42.5999, lng: -72.6303 },
      { id: 'fr-baystate', name: 'Baystate Franklin Medical Center', lat: 42.5949, lng: -72.592 },
      { id: 'fr-turners', name: 'Turners Falls', lat: 42.608, lng: -72.5564 },
      { id: 'fr-stopshop', name: 'Stop & Shop plaza', lat: 42.6068, lng: -72.5751 },
    ],
  },
  {
    id: 'attleboro_taunton',
    label: 'Attleboro–Taunton',
    anchor: { lat: 41.92, lng: -71.19 },
    radiusMiles: 14,
    destinations: [
      { id: 'at-taunton', name: 'Taunton Bus Terminal', lat: 41.9011, lng: -71.101 },
      { id: 'at-attleboro', name: 'Attleboro Transit Center', lat: 41.9415, lng: -71.2852 },
      { id: 'at-morton', name: 'Morton Hospital', lat: 41.9057, lng: -71.0942 },
      { id: 'at-sturdy', name: 'Sturdy Memorial Hospital', lat: 41.942, lng: -71.2752 },
      { id: 'at-wheaton', name: 'Wheaton College', lat: 41.9671, lng: -71.1838 },
      { id: 'at-sattleboro', name: 'South Attleboro (Market Basket plaza)', lat: 41.8988, lng: -71.3539 },
      { id: 'at-patriot', name: 'Patriot Place / Gillette Stadium', lat: 42.0909, lng: -71.2643 },
      { id: 'at-providence', name: 'Providence Station & downtown', lat: 41.8293, lng: -71.4133 },
    ],
  },
  {
    id: 'vineyard',
    label: "Martha's Vineyard",
    anchor: { lat: 41.43, lng: -70.56 },
    radiusMiles: 12,
    destinations: [
      { id: 'mv-ssa', name: 'Vineyard Haven ferry terminal', lat: 41.4557, lng: -70.6013 },
      { id: 'mv-edgartown', name: 'Downtown Edgartown', lat: 41.391, lng: -70.5146 },
      { id: 'mv-oakbluffs', name: 'Oak Bluffs', lat: 41.4569, lng: -70.5563 },
      { id: 'mv-hospital', name: "Martha's Vineyard Hospital", lat: 41.4609, lng: -70.5808 },
    ],
  },
  {
    id: 'nantucket',
    label: 'Nantucket',
    anchor: { lat: 41.2826, lng: -70.0971 },
    radiusMiles: 8,
    destinations: [
      { id: 'na-downtown', name: 'Downtown Nantucket', lat: 41.2826, lng: -70.0971 },
      { id: 'na-hospital', name: 'Nantucket Cottage Hospital', lat: 41.2751, lng: -70.1011 },
      { id: 'na-midisland', name: 'Mid-island (Old South Rd)', lat: 41.2707, lng: -70.0881 },
      { id: 'na-surfside', name: 'Surfside Beach', lat: 41.2629, lng: -70.0995 },
    ],
  },
]

function miles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2
  return 3958.8 * 2 * Math.asin(Math.sqrt(a))
}

/** Region for a point, or null when nowhere near any list. */
export function resolveRegion(lat: number, lng: number): Region | null {
  const ranked = REGIONS.map(r => ({
    region: r,
    dist: miles(lat, lng, r.anchor.lat, r.anchor.lng),
  })).sort((a, b) => a.dist - b.dist)

  const within = ranked.find(r => r.dist <= r.region.radiusMiles)
  if (within) return within.region
  // Cluster-earned fallback: the closest real list beats an empty section.
  const nearest = ranked[0]
  return nearest && nearest.dist <= 60 ? nearest.region : null
}
