/**
 * Who clears each trail of snow, for the "In winter" line on trail pages
 * (Keith 2026-10-28). Researched 2026-10-28 from the agencies' own pages and
 * dated statements; trails whose only sources were blogs, drafts or reports
 * years old are left out rather than guessed, since a wrong "plowed" sends
 * someone onto ice. Recheck each fall.
 */
export interface TrailWinter {
  cleared: 'yes' | 'partly' | 'no'
  note: string
  source: string
  /** When the source said so, if it is dated. */
  as_of?: string
}

export const WINTER_CHECKED = '2026-10-28'

export const WINTER: Record<string, TrailWinter> = {
  'somerville-community-path': {
    cleared: 'yes',
    note: 'Somerville clears the path all winter. Parts can close for a short time in big storms; Somerville 311 has the latest.',
    source: 'https://www.somervillema.gov/snow',
    as_of: '2025-26 season',
  },
  'minuteman-bikeway': {
    cleared: 'yes',
    note: 'Arlington, Lexington and Bedford plow their sections after the roads and sidewalks are done.',
    source: 'https://www.lexingtonma.gov/717/Minuteman-Bikeway',
  },
  'shining-sea-bikeway': {
    cleared: 'yes',
    note: 'Falmouth plows the bikeway from Woods Hole to North Falmouth after the roads are done.',
    source: 'https://www.falmouthma.gov/DocumentCenter/View/18655',
    as_of: '2025',
  },
  'southwest-corridor-park': {
    cleared: 'yes',
    note: 'The state parks department (DCR) plows the path because it serves T stations, but does not salt it. Expect ice after a freeze.',
    source: 'https://www.mass.gov/info-details/dcr-winter-storm-plan-and-priority-map',
  },
  'charles-river-paths': {
    cleared: 'partly',
    note: 'The state parks department (DCR) clears the main river paths after the roads, with one narrow pass. Some stretches upstream may stay snowy.',
    source: 'https://www.mass.gov/info-details/dcr-winter-storm-plan-and-priority-map',
  },
  'emerald-necklace-paths': {
    cleared: 'partly',
    note: 'Paths beside the Riverway, Jamaicaway and Arborway are on the state plowing plan. Paths inside the parks can wait days after big storms.',
    source: 'https://www.mass.gov/info-details/dcr-winter-storm-plan-and-priority-map',
  },
  'northern-strand-trail': {
    cleared: 'partly',
    note: 'Malden plows its 3 miles when it plows the streets, but not for an inch of snow, and does not salt. Other towns may not.',
    source: 'https://www.cityofmalden.org/facilities/facility/details/Northern-Strand-Community-Trail-22',
  },
  'narrow-gauge-rail-trail': {
    cleared: 'partly',
    note: 'Bedford plows from Loomis Street to Pine Hill Road after the roads and sidewalks. The Billerica part is not plowed.',
    source: 'https://thebedfordcitizen.org/2021/12/first-snowfall-tomorrow-dpw-vehicles-ready-to-go/',
    as_of: 'Dec 2021',
  },
  'twin-cities-rail-trail': {
    cleared: 'yes',
    note: 'The Twin Cities Trail Association pays to plow the whole trail. Bridges can stay slushy or icy.',
    source: 'https://mass.streetsblog.org/2023/01/27/leominster-and-fitchburgs-new-rail-trail-gets-creative-with-winter-maintenance',
    as_of: 'Jan 2023',
  },
  'bruce-freeman-rail-trail': {
    cleared: 'no',
    note: 'Not plowed, so people can ski and snowshoe on it. Watch for ice, especially on bridges.',
    source: 'https://www.concordma.gov/DocumentCenter/View/3292/Additional-Trails-Maintenance-PDF',
  },
  'mass-central-rail-trail': {
    cleared: 'no',
    note: 'Not plowed between Waltham and Sudbury; it is left for skiing. Farther west, only the parking lots and entrances are cleared.',
    source: 'https://www.westonma.gov/1179/Mass-Central-Rail-Trail',
  },
  'fort-river-trail': {
    cleared: 'no',
    note: 'Not cleared of snow or ice. Snowshoes work well when it is snowy.',
    source: 'https://www.kestreltrust.org/places/fort-river-trail/',
  },
  'battle-road-trail': {
    cleared: 'no',
    note: 'Open for skiing and snowshoeing in winter. The park can close it for snow and ice, and does not say it plows.',
    source: 'https://www.nps.gov/mima/learn/management/superintendent-s-compendium.htm',
  },
}
