// Walk-audit modules (Phase A). Adapted from the AARP Walk Audit Tool Kit
// worksheets, the Malden Safe Streets port, and our school route form — see
// Shift repo docs/specs/walk-audit-frameworks-comparison.md. Data-driven so
// one renderer serves every module. All questions are optional: the AARP/
// WalkMass ethos is "comment on what matters," not complete-every-field.

export type Question =
  | { kind: 'radio'; key: string; label: string; options: { value: string; label: string }[] }
  | { kind: 'checkbox'; key: string; label: string; options: string[] }
  | { kind: 'scale5'; key: string; label: string; low: string; high: string }
  | { kind: 'number'; key: string; label: string; unit?: string }
  | { kind: 'textarea'; key: string; label: string; placeholder?: string }

export interface ModuleBlock {
  title?: string
  questions: Question[]
}

export interface AuditModule {
  id: string
  name: string
  tagline: string // module-picker guidance (the Malden instruction-guide idea)
  startHere?: boolean
  blocks: ModuleBlock[]
}

const YN = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]
const YNS = [
  { value: 'yes', label: 'Yes' },
  { value: 'some', label: 'Some' },
  { value: 'no', label: 'No' },
]
const PRESENCE_CONDITION = (thing: string) => [
  { value: 'yes_good', label: `Yes, in good shape` },
  { value: 'yes_poor', label: `Yes, but in poor shape` },
  { value: 'no', label: `No ${thing}` },
]

export const AUDIT_MODULES: AuditModule[] = [
  {
    id: 'streets_crossings',
    name: 'Streets, sidewalks & crossings',
    tagline: 'The baseline walk-along audit — start here if this is your first.',
    startHere: true,
    blocks: [
      {
        title: 'Sidewalks',
        questions: [
          { kind: 'radio', key: 'sidewalk_present', label: 'Are there sidewalks?', options: [
            { value: 'both', label: 'Both sides' },
            { value: 'one', label: 'One side' },
            { value: 'partial', label: 'Partial / gaps' },
            { value: 'none', label: 'None' },
          ]},
          { kind: 'scale5', key: 'sidewalk_width', label: 'Wide enough for two people side by side (about 5 feet)?', low: 'Far too narrow', high: 'Plenty of room' },
          { kind: 'scale5', key: 'sidewalk_condition', label: 'Surface condition (cracks, heaves, trip hazards)?', low: 'Poor', high: 'Great' },
          { kind: 'scale5', key: 'sidewalk_clear', label: 'Clear of obstacles (poles, bins, overgrowth, parked cars)?', low: 'Many obstacles', high: 'Totally clear' },
          { kind: 'scale5', key: 'sidewalk_buffer', label: 'Separation from traffic (curb, grass, trees, parked cars)?', low: 'No buffer', high: 'Good buffer' },
          { kind: 'radio', key: 'curb_ramps', label: 'Curb ramps where sidewalks meet crossings?', options: YNS },
          { kind: 'radio', key: 'tactile_strips', label: 'Bumpy yellow warning strips at the ramps?', options: YNS },
        ],
      },
      {
        title: 'Crossings',
        questions: [
          { kind: 'scale5', key: 'crosswalks_present', label: 'Crosswalks where people need to cross?', low: 'Missing', high: 'Everywhere needed' },
          { kind: 'scale5', key: 'crosswalks_marked', label: 'Crosswalk paint visible to drivers?', low: 'Faded/none', high: 'Crisp and clear' },
          { kind: 'radio', key: 'crossing_too_far', label: 'Do people have to walk too far to find a safe place to cross?', options: YN },
          { kind: 'radio', key: 'signals_present', label: 'Walk signals at busy crossings?', options: YNS },
          { kind: 'radio', key: 'signals_working', label: 'Are the walk signals working?', options: [...YNS, { value: 'na', label: 'No signals' }] },
          { kind: 'number', key: 'signal_crossing_seconds', label: 'Time one signal: about how many seconds does it give to cross?', unit: 'seconds' },
          { kind: 'number', key: 'signal_wait_seconds', label: 'About how many seconds did you wait for the walk signal?', unit: 'seconds' },
          { kind: 'scale5', key: 'sightlines', label: 'Can pedestrians and drivers see each other at crossings?', low: 'Blocked views', high: 'Clear views' },
        ],
      },
      {
        title: 'Biking',
        questions: [
          { kind: 'radio', key: 'bike_lane', label: 'Bike lane or path?', options: [
            { value: 'protected', label: 'Protected / separated' },
            { value: 'painted', label: 'Painted lane only' },
            { value: 'none', label: 'None' },
          ]},
          { kind: 'checkbox', key: 'bike_hazards', label: 'Bike hazards (check all that apply):', options: [
            'Storm drain grates', 'Rail or trolley tracks', 'Gravel or debris', 'Narrow lanes, no shoulder', 'Car doors open into the lane', 'None observed',
          ]},
          { kind: 'radio', key: 'bike_parking', label: 'Anywhere to lock a bike?', options: YNS },
        ],
      },
      {
        title: 'Traffic',
        questions: [
          { kind: 'radio', key: 'speed_limit_posted', label: 'Is a speed limit posted?', options: YN },
          { kind: 'number', key: 'speed_limit_mph', label: 'If posted, what is it?', unit: 'mph' },
          { kind: 'scale5', key: 'drivers_obeying', label: 'Do drivers seem to travel at a safe speed here?', low: 'Not at all', high: 'Yes' },
          { kind: 'checkbox', key: 'driver_behaviors', label: 'Risky driver behaviors you saw (check all that apply):', options: [
            'Rolling through stop signs', 'Not yielding when turning', 'Stopping in the crosswalk', 'Backing out without looking', 'Looking at phones', 'Sudden or unexpected maneuvers', 'None observed',
          ]},
        ],
      },
    ],
  },
  {
    id: 'who_uses',
    name: 'Who’s using the street',
    tagline: 'Count who’s out walking and why — best done sitting at one spot for 20–30 minutes. An empty street is a finding too.',
    blocks: [
      {
        title: 'Who did you see?',
        questions: [
          { kind: 'number', key: 'count_children', label: 'Young children (elementary age)' },
          { kind: 'number', key: 'count_teens', label: 'Teens' },
          { kind: 'number', key: 'count_adults', label: 'Adults' },
          { kind: 'number', key: 'count_older_adults', label: 'Older adults' },
        ],
      },
      {
        title: 'How were they getting around?',
        questions: [
          { kind: 'number', key: 'count_strollers', label: 'Pushing a stroller or walking with children' },
          { kind: 'number', key: 'count_mobility_aids', label: 'Using a wheelchair, cane, or walker' },
          { kind: 'number', key: 'count_bikes', label: 'Riding a bike, scooter, or skateboard' },
        ],
      },
      {
        title: 'Best guess at why (from context)',
        questions: [
          { kind: 'number', key: 'purpose_school', label: 'Going to/from school' },
          { kind: 'number', key: 'purpose_transit', label: 'Heading to or waiting for transit' },
          { kind: 'number', key: 'purpose_work', label: 'Commuting to work' },
          { kind: 'number', key: 'purpose_errands', label: 'Shopping or errands' },
          { kind: 'number', key: 'purpose_exercise', label: 'Exercise or dog walking' },
          { kind: 'number', key: 'purpose_other', label: 'Other / unknown' },
        ],
      },
      {
        questions: [
          { kind: 'textarea', key: 'who_missing', label: 'Who is NOT using this street?', placeholder: 'Do the people you saw match who lives nearby? Who seems to be missing, and why might that be?' },
        ],
      },
    ],
  },
  {
    id: 'safety_appeal',
    name: 'Safety & appeal',
    tagline: 'How the street feels — comfort, upkeep, lighting, and personal safety.',
    blocks: [
      {
        title: 'Comfort & upkeep',
        questions: [
          { kind: 'scale5', key: 'seating', label: 'Places to sit and rest?', low: 'None', high: 'Plenty' },
          { kind: 'scale5', key: 'shade', label: 'Shade from trees or awnings?', low: 'None', high: 'Plenty' },
          { kind: 'radio', key: 'landscaping', label: 'Grass, flowers, or landscaping?', options: PRESENCE_CONDITION('landscaping') },
          { kind: 'radio', key: 'trash_bins', label: 'Trash bins?', options: PRESENCE_CONDITION('bins') },
          { kind: 'scale5', key: 'litter', label: 'Free of litter?', low: 'Lots of litter', high: 'Clean' },
          { kind: 'scale5', key: 'buildings', label: 'Buildings and storefronts kept up?', low: 'Rundown', high: 'Well kept' },
          { kind: 'scale5', key: 'lighting', label: 'Lighting where people actually walk?', low: 'Dark', high: 'Well lit' },
        ],
      },
      {
        title: 'How safe does it feel?',
        questions: [
          { kind: 'scale5', key: 'safe_travel', label: 'A safe, appealing way to get somewhere on foot?', low: 'No', high: 'Yes' },
          { kind: 'scale5', key: 'safe_from_vehicles', label: 'Pedestrians feel safe from moving vehicles?', low: 'In danger', high: 'Very safe' },
          { kind: 'scale5', key: 'safe_from_crime', label: 'Safe from crime or harassment?', low: 'Unsafe', high: 'Very safe' },
          { kind: 'radio', key: 'safe_at_night', label: 'Would it feel safe after dark?', options: YN },
          { kind: 'scale5', key: 'welcoming_all', label: 'Welcoming for people of all ages, abilities, and backgrounds?', low: 'No', high: 'Yes' },
        ],
      },
    ],
  },
  {
    id: 'winter',
    name: 'Winter weather',
    tagline: 'Do this one in the weeks after a snowfall — winter is when walkability breaks.',
    blocks: [
      {
        title: 'Walkways after snow',
        questions: [
          { kind: 'radio', key: 'cleared', label: 'Are walkways cleared after a storm?', options: YNS },
          { kind: 'textarea', key: 'cleared_how_soon', label: 'If yes, about how soon after?' },
          { kind: 'radio', key: 'ice_free', label: 'Do they stay free of ice and slush once cleared?', options: YNS },
          { kind: 'radio', key: 'full_width', label: 'Is the full width and length cleared (not a one-shovel path)?', options: YNS },
          { kind: 'radio', key: 'not_blocked', label: 'Free of snowbanks blocking corners and curb ramps?', options: YNS },
          { kind: 'radio', key: 'splash', label: 'Can people walk without being sprayed with slush by passing cars?', options: YN },
        ],
      },
      {
        title: 'Crossings & transit in winter',
        questions: [
          { kind: 'radio', key: 'crosswalks_visible', label: 'Are crosswalks still visible (not buried or faded)?', options: YNS },
          { kind: 'radio', key: 'transit_access', label: 'Are bus/train stops reachable and cleared?', options: [...YNS, { value: 'na', label: 'No transit here' }] },
        ],
      },
      {
        questions: [
          { kind: 'checkbox', key: 'who_clears', label: 'Who is responsible for clearing these sidewalks? (check all that apply)', options: [
            'The city or town', 'Each property owner', "Don't know",
          ]},
        ],
      },
    ],
  },
  {
    id: 'better_block',
    name: 'Build a better block',
    tagline: 'Skip the problems — pick the improvements you think would help most.',
    blocks: [
      {
        questions: [
          { kind: 'checkbox', key: 'improvements', label: 'Would this street be better with… (check all you’d support)', options: [
            'Sidewalks (there are none)', 'Sidewalk repairs', 'Wider sidewalks',
            'A buffer between sidewalk and street', 'Crosswalks (there are none)',
            'Raised crosswalks', 'Artistic crosswalks', 'Curb extensions at corners',
            'A pedestrian island', 'Pedestrian-scale lighting', 'Benches and places to rest',
            'Wayfinding signs', 'Public art', 'Street trees and landscaping',
            'Better landscape upkeep', 'A pocket park or green space',
            'Water fountains', 'Public restrooms', 'Litter removal', 'Trash bins',
            'Graffiti removal', 'Fixing up vacant buildings',
            'A protected bike lane', 'A painted bike lane', 'Bike parking',
            'A bike-share station', 'Slower traffic', 'A safer transit stop',
          ]},
          { kind: 'textarea', key: 'improvements_other', label: 'Anything else?' },
        ],
      },
    ],
  },
  {
    id: 'transit_access',
    name: 'Transit access',
    tagline: 'For streets with a bus stop or station — how it is to get there and wait there.',
    blocks: [
      {
        questions: [
          { kind: 'scale5', key: 'safe_access', label: 'Can people safely walk to and from the stop?', low: 'Unsafe', high: 'Very safe' },
          { kind: 'scale5', key: 'useful_location', label: 'Is the stop in a useful spot?', low: 'Poorly placed', high: 'Great spot' },
          { kind: 'scale5', key: 'protected', label: 'Are waiting riders protected from moving traffic?', low: 'Exposed', high: 'Well protected' },
          { kind: 'radio', key: 'seating', label: 'Seating for waiting riders?', options: PRESENCE_CONDITION('seating') },
          { kind: 'checkbox', key: 'shelter_from', label: 'The stop offers shelter from… (check all that apply)', options: [
            'Rain', 'Sun', 'Cold', 'Wind', 'None of these',
          ]},
          { kind: 'scale5', key: 'maintained', label: 'Clean and maintained?', low: 'Poorly', high: 'Well' },
          { kind: 'scale5', key: 'lit', label: 'Well lit?', low: 'Dark', high: 'Bright' },
          { kind: 'scale5', key: 'would_wait', label: 'Would you feel comfortable waiting here?', low: 'No', high: 'Absolutely' },
        ],
      },
    ],
  },
]

export const ROLLUP_OPTIONS = [
  { value: 'great', label: 'Great' },
  { value: 'acceptable', label: 'Acceptable' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'poor', label: 'Poor' },
]

export function moduleById(id: string): AuditModule | undefined {
  return AUDIT_MODULES.find((m) => m.id === id)
}
