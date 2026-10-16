/**
 * The employer commute survey, one instrument for every rule set (Shift
 * migration 01170; requirements in Shift docs/programs/employer/drafts/
 * survey-week-requirements-2026-10.md).
 *
 * Built on Cambridge's PTDM employee survey (15 questions, 18-option day
 * grid, read from the City's template 2026-10-13) with MassDEP's Option 1
 * form folded in: the three screening questions first, carpool size as a
 * number, "dropped off" as its own answer, and MassDEP's four background
 * questions at the end. No name or phone fields anywhere: identity is the
 * personal link.
 *
 * Shared by the public form (/survey/[token]), the API route that stores an
 * answer, the exports and the portal, so the question codes here are the
 * ones stored in employer_survey_responses.answers. The Shift app's in-app
 * version keeps a copy of the codes; change them in both places.
 */

export type RuleSet = 'massdep' | 'cambridge' | 'boston' | 'emissions'

export const RULE_SET_LABEL: Record<RuleSet, string> = {
  massdep: 'MassDEP Rideshare',
  cambridge: 'Cambridge PTDM',
  boston: 'Boston TAPA',
  emissions: 'Emissions only',
}

export const RULE_SET_HELP: Record<RuleSet, string> = {
  massdep:
    'MassDEP, the state environmental agency, requires sites where 1,000 or more people commute (250 if the site has a state air permit) to survey how staff get to work and report every year by December 31. At least half of the regular daytime commuters have to answer; the more who do, the shorter the form.',
  cambridge:
    'Properties with a Parking and Transportation Demand Management plan. The City runs the employee survey in its own tool (60% of employees must answer); report due November 30 or June 30.',
  boston:
    'Transportation Access Plan Agreement annual reports, due November 30. No template; the survey gives the mode-share paragraph.',
  emissions:
    'No filing. The survey gives your staff commuting emissions (GHG Protocol Scope 3, category 7) with activity data your carbon accountant can reuse.',
}

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
export type Weekday = (typeof WEEKDAYS)[number]
export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
}

/**
 * How a person got to work on one day. Cambridge's 18 options with carpool
 * and vanpool merged (the size decides which, and each rule cuts it
 * differently) and "dropped off" added (MassDEP counts it as a carpool).
 */
export type DayMode =
  | 'walk'
  | 'bike'
  | 'bikeshare'
  | 'drive_alone'
  | 'drive_bike'
  | 'transit_walk'
  | 'transit_bike'
  | 'transit_bikeshare'
  | 'transit_drive'
  | 'shuttle'
  | 'carpool'
  | 'dropped_off'
  | 'ridehail_shared'
  | 'ridehail_alone'
  | 'telework'
  | 'day_off'
  | 'out_of_office'
  | 'other'

/** For days with two parts: which part covered the most distance (MassDEP's rule). */
export type LongestLeg = 'transit' | 'bike' | 'drive'
/** For "transit plus a car": how the car part happened. */
export type CarPart = 'drove_alone' | 'carpool' | 'shuttle'

export type DayAnswer = {
  mode: DayMode
  /** carpool: people in the vehicle, including the respondent (2 or more). */
  size?: number
  longest?: LongestLeg
  car_part?: CarPart
}

export type DayModeOption = {
  code: DayMode
  label: string
  /** Shown under the label when it helps. */
  hint?: string
  group: 'active' | 'car' | 'transit' | 'shared' | 'away'
  /** Which parts a day with this answer has, for the longest-leg follow-up. */
  legs?: LongestLeg[]
}

export const DAY_MODE_OPTIONS: DayModeOption[] = [
  { code: 'walk', label: 'Walked the whole way', group: 'active' },
  { code: 'bike', label: 'Rode my own bike the whole way', group: 'active' },
  { code: 'bikeshare', label: 'Rode a Bluebike the whole way', hint: 'Or another bike share', group: 'active' },
  { code: 'drive_alone', label: 'Drove alone the whole way', group: 'car' },
  { code: 'drive_bike', label: 'Drove, then biked', hint: 'Park and pedal', group: 'car', legs: ['drive', 'bike'] },
  { code: 'transit_walk', label: 'Transit, plus walking', hint: 'Bus, subway, commuter rail or ferry', group: 'transit' },
  { code: 'transit_bike', label: 'Transit, plus my own bike', group: 'transit', legs: ['transit', 'bike'] },
  { code: 'transit_bikeshare', label: 'Transit, plus a Bluebike', group: 'transit', legs: ['transit', 'bike'] },
  { code: 'transit_drive', label: 'Transit, plus a car or shuttle', hint: 'Drove, carpooled or took a shuttle to the station', group: 'transit', legs: ['transit', 'drive'] },
  { code: 'shuttle', label: 'Company or private shuttle', group: 'shared' },
  { code: 'carpool', label: 'Carpool or vanpool', hint: "We'll ask how many people", group: 'shared' },
  { code: 'dropped_off', label: 'Someone dropped me off', group: 'shared' },
  { code: 'ridehail_shared', label: 'Taxi, Uber or Lyft with other passengers', group: 'shared' },
  { code: 'ridehail_alone', label: 'Taxi, Uber or Lyft on my own', group: 'car' },
  { code: 'telework', label: 'Worked from home', group: 'away' },
  { code: 'day_off', label: "Didn't work that day", hint: 'Flextime, compressed week', group: 'away' },
  { code: 'out_of_office', label: 'Sick, vacation, business trip or jury duty', group: 'away' },
  { code: 'other', label: 'Something else', hint: 'Scooter, skateboard, motorcycle', group: 'active' },
]

export const DAY_MODE_BY_CODE: Record<DayMode, DayModeOption> = Object.fromEntries(
  DAY_MODE_OPTIONS.map((o) => [o.code, o]),
) as Record<DayMode, DayModeOption>

export const DAY_MODE_GROUP_LABEL: Record<DayModeOption['group'], string> = {
  active: 'On foot or by bike',
  transit: 'Transit',
  shared: 'Shared ride',
  car: 'Car',
  away: 'Not at the office',
}

export const LONGEST_LEG_LABEL: Record<LongestLeg, string> = {
  transit: 'The bus or train',
  bike: 'The bike ride',
  drive: 'The drive',
}

export const CAR_PART_OPTIONS: { code: CarPart; label: string }[] = [
  { code: 'drove_alone', label: 'I drove alone' },
  { code: 'carpool', label: 'I carpooled or was dropped off' },
  { code: 'shuttle', label: 'A shuttle' },
]

/** A simple choice question: code, label, options. */
export type Choice = { code: string; label: string }

export const START_TIME: Choice[] = [
  { code: 'before6', label: 'Before 6 AM' },
  { code: '6', label: '6 to 6:59 AM' },
  { code: '7', label: '7 to 7:59 AM' },
  { code: '8', label: '8 to 8:59 AM' },
  { code: '9', label: '9 to 9:59 AM' },
  { code: 'after10', label: '10 AM or later' },
]
export const END_TIME: Choice[] = [
  { code: 'before4', label: 'Before 4 PM' },
  { code: '4', label: '4 to 4:59 PM' },
  { code: '5', label: '5 to 5:59 PM' },
  { code: '6', label: '6 to 6:59 PM' },
  { code: '7', label: '7 to 7:59 PM' },
  { code: 'after8', label: '8 PM or later' },
]
export const HOURS_PER_DAY: Choice[] = [
  { code: 'lt2', label: 'Less than 2' },
  { code: '2_5', label: '2 to 5' },
  { code: '6_8', label: '6 to 8' },
  { code: '8plus', label: 'More than 8' },
]
export const MINUTES_ONE_WAY: Choice[] = [
  { code: '0_15', label: 'Up to 15 minutes' },
  { code: '16_30', label: '16 to 30 minutes' },
  { code: '31_45', label: '31 to 45 minutes' },
  { code: '46_90', label: '46 to 90 minutes' },
  { code: '90plus', label: 'More than 90 minutes' },
]
export const MILES_ONE_WAY: Choice[] = [
  { code: '0_10', label: 'Up to 10 miles' },
  { code: '11_20', label: '11 to 20 miles' },
  { code: '21_40', label: '21 to 40 miles' },
  { code: '41_60', label: '41 to 60 miles' },
  { code: '60plus', label: 'More than 60 miles' },
]

/** Midpoint hour of each start and end band, for the derived hours a day. */
const START_HOUR: Record<string, number> = { before6: 5.5, '6': 6.5, '7': 7.5, '8': 8.5, '9': 9.5, after10: 10.5 }
const END_HOUR: Record<string, number> = { before4: 15.5, '4': 16.5, '5': 17.5, '6': 18.5, '7': 19.5, after8: 20.5 }

/**
 * Cambridge question 4 (hours worked a day) follows from the usual start
 * and end times, so the survey no longer asks it (Keith 2026-10-13). An
 * answer stored by an older form wins when present.
 */
export function hoursPerDay(a: { hours_per_day?: string; start_time?: string; end_time?: string }): string | undefined {
  if (a.hours_per_day) return a.hours_per_day
  const s = a.start_time ? START_HOUR[a.start_time] : undefined
  const e = a.end_time ? END_HOUR[a.end_time] : undefined
  if (s == null || e == null) return undefined
  const h = e - s
  if (h < 2) return 'lt2'
  if (h <= 5) return '2_5'
  if (h <= 8) return '6_8'
  return '8plus'
}
/** Midpoint of each distance band, in miles, for the emissions export. */
export const MILES_ONE_WAY_MIDPOINT: Record<string, number> = {
  '0_10': 5,
  '11_20': 15.5,
  '21_40': 30.5,
  '41_60': 50.5,
  '60plus': 70,
}

export const TRANSIT_ROUTES: Choice[] = [
  { code: 'red', label: 'Red Line' },
  { code: 'green', label: 'Green Line' },
  { code: 'orange', label: 'Orange Line' },
  { code: 'blue', label: 'Blue Line' },
  { code: 'silver', label: 'Silver Line' },
  { code: 'cr_porter', label: 'Commuter Rail to Porter Square' },
  { code: 'cr_north', label: 'Commuter Rail to North Station' },
  { code: 'cr_south', label: 'Commuter Rail to South Station' },
  { code: 'cr_other', label: 'Commuter Rail, another station' },
  { code: 'ferry', label: 'Ferry' },
  { code: 'shuttle_bus', label: 'Shuttle bus' },
]

export const CAR_FOR_BUSINESS: Choice[] = [
  { code: 'none', label: 'Never' },
  { code: '1_4', label: '1 to 4 times' },
  { code: '5plus', label: '5 or more times' },
]
export const PARKING_FULL: Choice[] = [
  { code: 'worksite', label: 'Lot or garage at work' },
  { code: 'offsite', label: 'Lot or garage somewhere else' },
  { code: 'street', label: 'On the street' },
]
export const PARKING_PART: Choice[] = [
  { code: 'park_ride', label: 'Park and Ride lot' },
  { code: 'offsite', label: 'Lot or garage somewhere else' },
  { code: 'street', label: 'On the street' },
  { code: 'park_pedal', label: 'Park and Pedal lot' },
]

/** Cambridge question 12. */
export const WHY_SHIFT: Choice[] = [
  { code: 'convenient', label: 'Most convenient way to get to work' },
  { code: 'cheapest', label: 'Cheapest' },
  { code: 'fastest', label: 'Fastest' },
  { code: 'safest', label: 'Safest' },
  { code: 'fun', label: 'Most fun' },
  { code: 'environment', label: 'Better for the environment' },
  { code: 'traffic', label: 'Too much traffic on the roads' },
  { code: 'parking_cost', label: 'Parking at work is expensive' },
  { code: 'no_car', label: "I don't have a car for commuting" },
  { code: 'kids', label: 'I take kids to school, daycare or activities' },
  { code: 'irregular_hours', label: 'My hours are irregular' },
  { code: 'transit_unreliable', label: 'Transit is unreliable' },
  { code: 'transit_schedule', label: "Transit schedules or routes don't work for me" },
  { code: 'exercise', label: 'For exercise' },
  { code: 'driving_stress', label: 'Driving is too stressful' },
  { code: 'carpool_easy', label: 'Easy to find people to carpool with' },
  { code: 'productive', label: 'I get things done on the train or bus' },
]

/** Cambridge question 13. */
export const WHY_DRIVE: Choice[] = [
  { code: 'convenient', label: 'Most convenient way to get to work' },
  { code: 'cheapest', label: 'Cheapest' },
  { code: 'fastest', label: 'Fastest' },
  { code: 'safest', label: 'Safest' },
  { code: 'privacy', label: 'I like the privacy of driving alone' },
  { code: 'free_parking', label: 'Free or cheap parking at work' },
  { code: 'disability', label: 'A physical disability' },
  { code: 'transit_unreliable', label: 'Transit is unreliable' },
  { code: 'transit_schedule', label: "Transit schedules or routes don't work for me" },
  { code: 'car_for_work', label: 'I need a car for work trips' },
  { code: 'errands', label: 'I need a car for errands before or after work' },
  { code: 'emergencies', label: 'I need a car in case of emergencies' },
  { code: 'carpool_hard', label: 'Hard to find people to carpool with' },
  { code: 'kids', label: 'I take kids to school, daycare or activities' },
  { code: 'irregular_hours', label: 'My hours are irregular' },
  { code: 'weather', label: 'Bad weather' },
  { code: 'carry', label: 'I have a lot to carry' },
]

/** Cambridge question 14: one rating each. */
export const INCENTIVES: Choice[] = [
  { code: 'emergency_ride', label: 'A guaranteed ride home in an emergency or unplanned overtime' },
  { code: 'bikeshare_station', label: 'A Bluebikes station near work or home' },
  { code: 'bikeshare_membership', label: 'A free Bluebikes membership' },
  { code: 'transit_info', label: 'Transit routes and schedules posted at work' },
  { code: 'station_shuttle', label: 'A shuttle to the train or bus station' },
  { code: 'transit_subsidy', label: 'Help paying for transit fares' },
  { code: 'vanpool_subsidy', label: 'Help paying for vanpool fares' },
  { code: 'carpool_parking', label: 'Reserved or better parking for carpools' },
  { code: 'carpool_matching', label: 'Help finding people to carpool or vanpool with' },
  { code: 'vanpool_vans', label: 'Vans available for vanpooling' },
  { code: 'day_car', label: 'A car available for work trips during the day' },
  { code: 'bike_storage', label: 'Easier or more bike storage' },
  { code: 'showers', label: 'Showers and lockers' },
  { code: 'active_incentive', label: 'Money or rewards for biking and walking' },
  { code: 'parking_fees', label: 'Parking at work costing 10% or more extra' },
]
export type IncentiveRating = 'very' | 'somewhat' | 'not' | 'already'
export const INCENTIVE_RATINGS: { code: IncentiveRating; label: string; short: string }[] = [
  { code: 'very', label: 'Very likely', short: 'Very' },
  { code: 'somewhat', label: 'Somewhat likely', short: 'Somewhat' },
  { code: 'not', label: 'Not likely', short: 'Not likely' },
  { code: 'already', label: 'We already have this', short: 'Already have it' },
]

/** MassDEP background question 1. */
export const INTERESTS: Choice[] = [
  { code: 'carpool', label: 'Carpooling' },
  { code: 'vanpool', label: 'Vanpooling' },
  { code: 'bike', label: 'Biking' },
  { code: 'transit', label: 'Public transit' },
  { code: 'walk', label: 'Walking' },
  { code: 'other', label: 'Something else' },
]

export const SCREENING = [
  { code: 'hours17', label: 'Do you work 17 hours or more a week, for 20 or more weeks a year?' },
  { code: 'daytime', label: 'Do you begin and end each workday between 6:00 AM and 8:00 PM?' },
  { code: 'car_lt5', label: 'Do you drive your own car for your job (client or site visits, errands for work, not your commute) fewer than five times a month?' },
] as const
export type ScreeningCode = (typeof SCREENING)[number]['code']

/** What is stored in employer_survey_responses.answers. */
export type SurveyAnswers = {
  screen: Partial<Record<ScreeningCode, boolean>>
  days: Partial<Record<Weekday, DayAnswer>>
  home_zip?: string
  start_time?: string
  end_time?: string
  hours_per_day?: string
  minutes_one_way?: string
  miles_one_way?: string
  transit_routes?: string[]
  /** Free text: bus route numbers. */
  bus_routes?: string
  car_for_business?: string
  parking_full?: string
  parking_part?: string
  why_shift?: string[]
  why_drive?: string[]
  incentives?: Partial<Record<string, IncentiveRating>>
  /** Cambridge 15: free text, never exported. */
  switch_text?: string
  interests?: string[]
  interests_other?: string
  /** MassDEP background 2 and 3: free text, never exported. */
  transit_improvements?: string
  facility_could?: string
  /** The respondent's own site and department, when the employer lists them. */
  location_id?: string | null
  department?: string | null
}

export function isApplicableCommuter(a: SurveyAnswers): boolean {
  return SCREENING.every((q) => a.screen?.[q.code] === true)
}

/** Does this day's answer mean the person travelled to the office? */
export function isCommuteDay(mode: DayMode): boolean {
  return mode !== 'telework' && mode !== 'day_off' && mode !== 'out_of_office'
}

export function usesTransit(mode: DayMode): boolean {
  return mode.startsWith('transit_')
}

export function usesCar(d: DayAnswer): boolean {
  return (
    d.mode === 'drive_alone' ||
    d.mode === 'drive_bike' ||
    d.mode === 'carpool' ||
    d.mode === 'dropped_off' ||
    d.mode === 'ridehail_alone' ||
    d.mode === 'ridehail_shared' ||
    (d.mode === 'transit_drive' && d.car_part !== 'shuttle')
  )
}

const DAY_MODES = new Set<string>(DAY_MODE_OPTIONS.map((o) => o.code))
const ZIP_RE = /^\d{5}$/

function cleanChoice(v: unknown, options: Choice[]): string | undefined {
  return typeof v === 'string' && options.some((o) => o.code === v) ? v : undefined
}
function cleanMulti(v: unknown, options: Choice[], max = 40): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const ok = options.map((o) => o.code)
  const out = [...new Set(v.filter((x): x is string => typeof x === 'string' && ok.includes(x)))]
  return out.slice(0, max)
}
function cleanText(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined
  const t = v.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, max) : undefined
}

export type Validation = { ok: true; answers: SurveyAnswers; applicable: boolean } | { ok: false; problems: string[] }

/**
 * Validate and clean a submitted answer set. Every day needs an answer
 * (MassDEP: each response must cover the whole week). The MassDEP rule set
 * requires the three screening questions; every rule set requires the
 * week; the rest is optional so a two-minute answer still counts.
 */
export function validateAnswers(raw: unknown, ruleSet: RuleSet): Validation {
  const problems: string[] = []
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const screenIn = (r.screen && typeof r.screen === 'object' ? r.screen : {}) as Record<string, unknown>
  const screen: SurveyAnswers['screen'] = {}
  for (const q of SCREENING) {
    const v = screenIn[q.code]
    if (typeof v === 'boolean') screen[q.code] = v
    else if (ruleSet === 'massdep') problems.push(`Answer "${q.label}"`)
  }

  const daysIn = (r.days && typeof r.days === 'object' ? r.days : {}) as Record<string, unknown>
  const days: SurveyAnswers['days'] = {}
  for (const d of WEEKDAYS) {
    const v = daysIn[d] as Record<string, unknown> | undefined
    const mode = v && typeof v.mode === 'string' && DAY_MODES.has(v.mode) ? (v.mode as DayMode) : null
    if (!mode) {
      problems.push(`Pick how you got to work on ${WEEKDAY_LABEL[d]}`)
      continue
    }
    const day: DayAnswer = { mode }
    const opt = DAY_MODE_BY_CODE[mode]
    if (mode === 'carpool') {
      const n = typeof v?.size === 'number' ? Math.round(v.size) : Number(v?.size)
      if (!Number.isFinite(n) || n < 2 || n > 30) {
        problems.push(`${WEEKDAY_LABEL[d]}: how many people were in the carpool or vanpool, including you?`)
      } else day.size = n
    }
    if (opt.legs) {
      const l = typeof v?.longest === 'string' && opt.legs.includes(v.longest as LongestLeg) ? (v.longest as LongestLeg) : null
      if (!l) problems.push(`${WEEKDAY_LABEL[d]}: which part of the trip covered the most distance?`)
      else day.longest = l
    }
    if (mode === 'transit_drive') {
      const c = typeof v?.car_part === 'string' && CAR_PART_OPTIONS.some((o) => o.code === v.car_part) ? (v.car_part as CarPart) : null
      if (!c) problems.push(`${WEEKDAY_LABEL[d]}: how did the car part of the trip happen?`)
      else day.car_part = c
    }
    days[d] = day
  }

  const incentivesIn = (r.incentives && typeof r.incentives === 'object' ? r.incentives : {}) as Record<string, unknown>
  const incentives: SurveyAnswers['incentives'] = {}
  for (const i of INCENTIVES) {
    const v = incentivesIn[i.code]
    if (typeof v === 'string' && INCENTIVE_RATINGS.some((x) => x.code === v)) incentives[i.code] = v as IncentiveRating
  }

  const zip = cleanText(r.home_zip, 10)
  if (zip && !ZIP_RE.test(zip)) problems.push('Home ZIP code should be five digits')

  if (problems.length > 0) return { ok: false, problems }

  const answers: SurveyAnswers = {
    screen,
    days,
    home_zip: zip,
    start_time: cleanChoice(r.start_time, START_TIME),
    end_time: cleanChoice(r.end_time, END_TIME),
    hours_per_day: cleanChoice(r.hours_per_day, HOURS_PER_DAY),
    minutes_one_way: cleanChoice(r.minutes_one_way, MINUTES_ONE_WAY),
    miles_one_way: cleanChoice(r.miles_one_way, MILES_ONE_WAY),
    transit_routes: cleanMulti(r.transit_routes, TRANSIT_ROUTES),
    bus_routes: cleanText(r.bus_routes, 120),
    car_for_business: cleanChoice(r.car_for_business, CAR_FOR_BUSINESS),
    parking_full: cleanChoice(r.parking_full, PARKING_FULL),
    parking_part: cleanChoice(r.parking_part, PARKING_PART),
    why_shift: cleanMulti(r.why_shift, WHY_SHIFT),
    why_drive: cleanMulti(r.why_drive, WHY_DRIVE),
    incentives,
    switch_text: cleanText(r.switch_text, 1000),
    interests: cleanMulti(r.interests, INTERESTS),
    interests_other: cleanText(r.interests_other, 120),
    transit_improvements: cleanText(r.transit_improvements, 1000),
    facility_could: cleanText(r.facility_could, 1000),
    location_id: typeof r.location_id === 'string' && /^[0-9a-f-]{36}$/i.test(r.location_id) ? r.location_id : null,
    department: cleanText(r.department, 80) ?? null,
  }
  // Drop undefined keys so the stored JSON is tidy.
  for (const k of Object.keys(answers) as (keyof SurveyAnswers)[]) {
    if (answers[k] === undefined) delete answers[k]
  }
  return { ok: true, answers, applicable: isApplicableCommuter(answers) }
}

/** The Monday of the week that contains `date` (local calendar, no time zone math on strings). */
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  d.setDate(d.getDate() - dow)
  return isoDate(d)
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + n))
}

/** "October 19 to 23, 2026" / "September 28 to October 2, 2026". */
export function weekLabel(weekStart: string): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const mon = new Date(y, m - 1, d)
  const fri = new Date(y, m - 1, d + 4)
  const month = (x: Date) => x.toLocaleDateString('en-US', { month: 'long' })
  if (mon.getMonth() === fri.getMonth()) return `${month(mon)} ${mon.getDate()} to ${fri.getDate()}, ${fri.getFullYear()}`
  return `${month(mon)} ${mon.getDate()} to ${month(fri)} ${fri.getDate()}, ${fri.getFullYear()}`
}

/** "Monday, October 19" for one weekday of the survey week. */
export function dayDateLabel(weekStart: string, day: Weekday): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  const dt = new Date(y, m - 1, d + WEEKDAYS.indexOf(day))
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}
