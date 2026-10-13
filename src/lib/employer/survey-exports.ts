/**
 * Exports at the close of an employer commute survey (Shift 01170). Pure
 * functions over the stored answers; the API route feeds them rows read
 * with the service role and sends back only what is computed here. Free-text
 * answers never appear in an export.
 *
 * Rules applied, each named in the methodology text it produces:
 *  - MassDEP: applicable commuters only (yes to all three screening
 *    questions); a day with two parts counts the part that covered the most
 *    distance; carpool is 2 to 6 people (being dropped off counts), vanpool
 *    7 or more; a company shuttle and a solo taxi are "other".
 *  - Cambridge: every respondent, the 18 day-grid options; carpool 2 to 7,
 *    vanpool 8 or more; "dropped off" is reported with carpool.
 *  - Boston TAPA: a paragraph with dates, response rate and mode share.
 *  - Emissions: EPA 2025 Emission Factors Hub (Table 10), the factors Shift
 *    already uses, over the one-way distance band each person gave.
 */
import {
  CAR_FOR_BUSINESS,
  DAY_MODE_BY_CODE,
  END_TIME,
  HOURS_PER_DAY,
  INCENTIVES,
  INCENTIVE_RATINGS,
  INTERESTS,
  MILES_ONE_WAY,
  MILES_ONE_WAY_MIDPOINT,
  MINUTES_ONE_WAY,
  PARKING_FULL,
  PARKING_PART,
  RULE_SET_LABEL,
  START_TIME,
  TRANSIT_ROUTES,
  WEEKDAYS,
  WHY_DRIVE,
  WHY_SHIFT,
  hoursPerDay,
  isCommuteDay,
  longDate,
  weekLabel,
  type Choice,
  type DayAnswer,
  type RuleSet,
  type SurveyAnswers,
} from './survey-instrument.ts'

export type ExportResponse = {
  answers: SurveyAnswers
  applicable: boolean
  source: 'link' | 'open' | 'app'
  matched: boolean
}

export type ExportSurvey = {
  title: string
  rule_set: RuleSet
  week_start: string
  closes_on: string
  headcount: number | null
  invited: number
  /** Answers through a personal link or the app (one per person on the list). */
  responded_matched: number
  /** Answers through the open link or QR (not tied to the list). */
  responded_unmatched: number
}

/** Shift's year-round numbers for the group: "measures taken and commuter response". */
export type Evidence = {
  company: string
  members: number
  active_members: number
  /** Share of recorded trips that were walking, biking, scooter or transit, this calendar year. */
  shift_rate_ytd_pct: number | null
  /** The same share over the workplace's first 30 days on Shift. */
  shift_rate_first_30_pct: number | null
  first_30_label: string | null
  active_trips_ytd: number
  co2_avoided_kg_ytd: number
  drive_alone_share_ytd_pct: number | null
  challenges: { name: string; starts_at: string; ends_at: string }[]
  year: number
}

export type ExportRow = [string, string | number]
export type ExportSection = { heading: string; note?: string; rows?: ExportRow[]; paragraphs?: string[] }
export type ExportDoc = { title: string; subtitle: string; sections: ExportSection[] }

/** Totals below this are reported as "fewer than 5" wherever a group could be small. */
const SUPPRESS_BELOW = 5

export function pct(n: number, d: number): string {
  if (!d) return '0%'
  return `${Math.round((n / d) * 1000) / 10}%`
}

function tallyChoice(rows: ExportResponse[], key: keyof SurveyAnswers, options: Choice[]): ExportRow[] {
  const counts = new Map<string, number>()
  let answered = 0
  for (const r of rows) {
    const v = r.answers[key]
    if (typeof v !== 'string') continue
    answered++
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  const out: ExportRow[] = options.map((o) => [o.label, counts.get(o.code) ?? 0])
  out.push(['Answered this question', answered])
  return out
}

function tallyMulti(rows: ExportResponse[], key: keyof SurveyAnswers, options: Choice[]): ExportRow[] {
  const counts = new Map<string, number>()
  let answered = 0
  for (const r of rows) {
    const v = r.answers[key]
    if (!Array.isArray(v) || v.length === 0) continue
    answered++
    for (const c of v) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const out: ExportRow[] = options.map((o) => [o.label, counts.get(o.code) ?? 0])
  out.push(['Answered this question', answered])
  return out
}

/** Counts by ZIP with small groups suppressed, largest first. */
export function zipRows(rows: ExportResponse[]): ExportRow[] {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const z = r.answers.home_zip
    if (z) counts.set(z, (counts.get(z) ?? 0) + 1)
  }
  const shown = [...counts.entries()].filter(([, n]) => n >= SUPPRESS_BELOW).sort((a, b) => b[1] - a[1])
  const hidden = [...counts.values()].filter((n) => n < SUPPRESS_BELOW)
  const out: ExportRow[] = shown.map(([z, n]) => [z, n])
  if (hidden.length > 0) out.push([`Other ZIP codes (${hidden.length}, each fewer than 5 people)`, hidden.reduce((a, b) => a + b, 0)])
  return out
}

// ── MassDEP ───────────────────────────────────────────────────────────────

export type MassdepMode =
  | 'drive_alone'
  | 'carpool'
  | 'vanpool'
  | 'transit'
  | 'bicycle'
  | 'walk'
  | 'telecommute'
  | 'flextime'
  | 'other'
  | 'out_of_office'

export const MASSDEP_MODE_LABEL: Record<MassdepMode, string> = {
  drive_alone: 'Drive alone',
  carpool: 'Carpool (2 to 6 commuters, including being dropped off)',
  vanpool: 'Vanpool (7 or more commuters)',
  transit: 'Public transit',
  bicycle: 'Bicycle',
  walk: 'Walk',
  telecommute: 'Telecommute',
  flextime: 'Flextime day off',
  other: 'Other',
  out_of_office: 'Out of office',
}
const MASSDEP_ORDER: MassdepMode[] = [
  'drive_alone', 'carpool', 'vanpool', 'transit', 'bicycle', 'walk', 'telecommute', 'flextime', 'other', 'out_of_office',
]

/** One day under MassDEP's rules: the longest part, carpool 2 to 6, vanpool 7+. */
export function massdepMode(d: DayAnswer): MassdepMode {
  switch (d.mode) {
    case 'walk':
      return 'walk'
    case 'bike':
    case 'bikeshare':
      return 'bicycle'
    case 'drive_alone':
      return 'drive_alone'
    case 'ridehail_alone':
      return 'other'
    case 'drive_bike':
      return d.longest === 'bike' ? 'bicycle' : 'drive_alone'
    case 'transit_walk':
      return 'transit'
    case 'transit_bike':
    case 'transit_bikeshare':
      return d.longest === 'bike' ? 'bicycle' : 'transit'
    case 'transit_drive':
      if (d.longest !== 'drive') return 'transit'
      if (d.car_part === 'carpool') return 'carpool'
      if (d.car_part === 'shuttle') return 'other'
      return 'drive_alone'
    case 'shuttle':
      return 'other'
    case 'carpool':
      return (d.size ?? 2) >= 7 ? 'vanpool' : 'carpool'
    case 'dropped_off':
    case 'ridehail_shared':
      return 'carpool'
    case 'telework':
      return 'telecommute'
    case 'day_off':
      return 'flextime'
    case 'out_of_office':
      return 'out_of_office'
    default:
      return 'other'
  }
}

export function massdepExport(survey: ExportSurvey, rows: ExportResponse[], evidence: Evidence | null): ExportDoc {
  const applicable = rows.filter((r) => r.applicable)
  const counts = new Map<MassdepMode, number>()
  let personDays = 0
  for (const r of applicable) {
    for (const d of WEEKDAYS) {
      const a = r.answers.days[d]
      if (!a) continue
      personDays++
      const m = massdepMode(a)
      counts.set(m, (counts.get(m) ?? 0) + 1)
    }
  }
  const commuteDays = personDays - (counts.get('telecommute') ?? 0) - (counts.get('flextime') ?? 0) - (counts.get('out_of_office') ?? 0)
  const driveAlone = counts.get('drive_alone') ?? 0

  const responded = survey.responded_matched + survey.responded_unmatched
  const rateOfHeadcount = survey.headcount ? responded / survey.headcount : null
  const rateOfInvited = survey.invited ? survey.responded_matched / survey.invited : null

  const modeRows: ExportRow[] = MASSDEP_ORDER.map((m) => [
    MASSDEP_MODE_LABEL[m],
    `${counts.get(m) ?? 0} (${pct(counts.get(m) ?? 0, personDays)})`,
  ])
  modeRows.push(["Total week's trips (person-days)", personDays])

  const methodology = [
    `${evidence?.company ?? 'The facility'} ran its applicable employee commute survey for the specific target week of ${weekLabel(survey.week_start)}, using an alternate survey form built on MassDEP's Option 1 form (the three applicability questions, home-to-work trips for each day of the week by mode, and the four commute background questions). Answers were collected through personal survey links sent to ${survey.invited.toLocaleString()} staff work email addresses, an open link and QR code for staff without email, and the Shift app for staff who use it; the survey closed ${longDate(survey.closes_on)}.`,
    `${responded.toLocaleString()} people responded${survey.headcount ? `, ${pct(responded, survey.headcount)} of the ${survey.headcount.toLocaleString()} staff at the site` : ''}${rateOfInvited != null ? ` (${pct(survey.responded_matched, survey.invited)} of the people on the emailed list)` : ''}. ${survey.responded_unmatched.toLocaleString()} ${survey.responded_unmatched === 1 ? 'answer came' : 'answers came'} through the open link and ${survey.responded_unmatched === 1 ? 'is' : 'are'} not matched to the staff list. ${applicable.length.toLocaleString()} respondents met all three applicability criteria and are counted above.`,
    `Each response covers every day of the week. Where a day used more than one mode, only the mode used for the longest distance is counted, as the respondent reported it. Carpool means 2 to 6 commuters including being dropped off; vanpool 7 or more; a company shuttle and a taxi or ride-hail taken alone are reported as Other. Contact information for each response is the work email address the survey link was sent to; Green Streets Initiative holds the individual responses on the facility's behalf for three years and provides them to the facility on request.`,
  ]

  const sections: ExportSection[] = [
    {
      heading: 'Response rate',
      rows: [
        ['Survey week', weekLabel(survey.week_start)],
        ['Closed', longDate(survey.closes_on)],
        ['Staff at the site (headcount)', survey.headcount ?? 'not given'],
        ['Personal links sent', survey.invited],
        ['Responses', responded],
        ['Response rate (of headcount)', rateOfHeadcount == null ? 'needs a headcount' : pct(responded, survey.headcount!)],
        ['Applicable commuters among respondents', applicable.length],
        ['Open-link responses (not matched to the list)', survey.responded_unmatched],
        ['Summary form this rate allows', rateOfHeadcount == null ? 'needs a headcount' : massdepBand(rateOfHeadcount * 100).form],
      ],
    },
    {
      heading: 'Home-to-work trips by mode, applicable commuters, survey week',
      note: 'Person-days. A day using more than one mode counts the mode used for the longest distance.',
      rows: modeRows,
    },
    {
      heading: 'Drive-alone share',
      rows: [
        ['Commute days (person-days at the site)', commuteDays],
        ['Drive-alone days', driveAlone],
        ['Drive-alone share of commute days', pct(driveAlone, commuteDays)],
        ['Drive-alone share of all person-days', pct(driveAlone, personDays)],
      ],
    },
    {
      heading: 'Other commute options of interest',
      note: 'MassDEP background question 1. People could pick more than one.',
      rows: tallyMulti(applicable, 'interests', INTERESTS),
    },
    {
      heading: 'Home ZIP codes',
      note: 'Counts only; ZIP codes with fewer than 5 respondents are grouped.',
      rows: zipRows(applicable),
    },
    { heading: 'Methodology statement', paragraphs: methodology },
  ]
  if (evidence) sections.push(evidenceSection(evidence))
  return {
    title: `${RULE_SET_LABEL.massdep} summary`,
    subtitle: `${survey.title}. Free-text answers (transit improvements, what the facility could do) are held by GSI and are not in this export.`,
    sections,
  }
}

/** MassDEP's response-rate bands and the summary form each allows. */
export function massdepBand(ratePct: number): { band: 'below' | 'scd3' | 'scd2' | 'scd1'; form: string } {
  if (ratePct >= 90) return { band: 'scd1', form: 'SCD 1 (90% or more)' }
  if (ratePct >= 75) return { band: 'scd2', form: 'SCD 2 (75% to 90%)' }
  if (ratePct >= 50) return { band: 'scd3', form: 'SCD 2 with one more trip-reduction incentive, otherwise SCD 3 (50% to 75%)' }
  return { band: 'below', form: 'Below the 50% census floor' }
}

// ── Cambridge ─────────────────────────────────────────────────────────────

export type CambridgeOption =
  | 'walk' | 'bike' | 'bikeshare' | 'drive_alone' | 'drive_bike'
  | 'transit_walk' | 'transit_bike' | 'transit_bikeshare' | 'transit_drive' | 'shuttle'
  | 'carpool' | 'vanpool' | 'ridehail_shared' | 'ridehail_alone'
  | 'telework' | 'day_off' | 'out_of_office' | 'other'

export const CAMBRIDGE_OPTIONS: { code: CambridgeOption; label: string }[] = [
  { code: 'walk', label: 'a) Walked the entire way' },
  { code: 'bike', label: 'b) Rode personal bicycle the entire way' },
  { code: 'bikeshare', label: 'c) Rode Bluebikes bikeshare the entire way' },
  { code: 'drive_alone', label: 'd) Drove alone the entire way' },
  { code: 'drive_bike', label: 'e) Drove + rode bicycle (park & pedal)' },
  { code: 'transit_walk', label: 'f) Public transportation + walked' },
  { code: 'transit_bike', label: 'g) Public transportation + personal bicycle' },
  { code: 'transit_bikeshare', label: 'h) Public transportation + Bluebikes bikeshare' },
  { code: 'transit_drive', label: 'i) Public transportation + drove/carpooled/shuttle' },
  { code: 'shuttle', label: 'j) Private / corporate shuttle' },
  { code: 'carpool', label: 'k) Carpool (two- to seven-person, incl. dropped off)' },
  { code: 'vanpool', label: 'l) Vanpool (eight- or more-person)' },
  { code: 'ridehail_shared', label: 'm) Taxi/Uber/Lyft with other passengers' },
  { code: 'ridehail_alone', label: 'n) Taxi/Uber/Lyft alone' },
  { code: 'telework', label: 'o) Worked at home' },
  { code: 'day_off', label: "p) Didn't work this day / flextime / compressed week" },
  { code: 'out_of_office', label: 'q) Sick/vacation/personal time, business trip or jury duty' },
  { code: 'other', label: 'r) Other (scooter, skateboard, etc.)' },
]

/** One day in Cambridge's 18 options: carpool 2 to 7, vanpool 8+, dropped off with carpool. */
export function cambridgeOption(d: DayAnswer): CambridgeOption {
  if (d.mode === 'carpool') return (d.size ?? 2) >= 8 ? 'vanpool' : 'carpool'
  if (d.mode === 'dropped_off') return 'carpool'
  return d.mode
}

export function cambridgeExport(survey: ExportSurvey, rows: ExportResponse[], evidence: Evidence | null): ExportDoc {
  const counts = new Map<CambridgeOption, number>()
  let personDays = 0
  for (const r of rows) {
    for (const d of WEEKDAYS) {
      const a = r.answers.days[d]
      if (!a) continue
      personDays++
      const o = cambridgeOption(a)
      counts.set(o, (counts.get(o) ?? 0) + 1)
    }
  }
  const responded = survey.responded_matched + survey.responded_unmatched
  const gridRows: ExportRow[] = CAMBRIDGE_OPTIONS.map((o) => [o.label, `${counts.get(o.code) ?? 0} (${pct(counts.get(o.code) ?? 0, personDays)})`])
  gridRows.push(['Total person-days', personDays])

  // Transit routes: checkbox lines plus how many wrote bus numbers.
  const routeRows = tallyMulti(rows, 'transit_routes', TRANSIT_ROUTES)
  routeRows.splice(routeRows.length - 1, 0, ['Wrote in bus route numbers', rows.filter((r) => !!r.answers.bus_routes).length])

  const incentiveRows: ExportRow[] = INCENTIVES.map((i) => {
    const c: Record<string, number> = { very: 0, somewhat: 0, not: 0, already: 0 }
    for (const r of rows) {
      const v = r.answers.incentives?.[i.code]
      if (v) c[v]++
    }
    return [i.label, INCENTIVE_RATINGS.map((x) => `${x.short} ${c[x.code]}`).join(' / ')]
  })

  const sections: ExportSection[] = [
    {
      heading: 'Response rate',
      rows: [
        ['Survey week', weekLabel(survey.week_start)],
        ['Closed', longDate(survey.closes_on)],
        ['Employees at the site (headcount)', survey.headcount ?? 'not given'],
        ['Personal links sent', survey.invited],
        ['Responses', responded],
        ['Response rate (of headcount)', survey.headcount ? pct(responded, survey.headcount) : 'needs a headcount'],
        ['Open-link responses (not matched to the list)', survey.responded_unmatched],
      ],
    },
    { heading: '7. How employees commuted each day, Monday to Friday', note: 'Person-days across all respondents, in the order of the City template.', rows: gridRows },
    { heading: '1. Home ZIP code', note: 'Counts only; ZIP codes with fewer than 5 respondents are grouped.', rows: zipRows(rows) },
    { heading: '2. Usual start time', rows: tallyChoice(rows, 'start_time', START_TIME) },
    { heading: '3. Usual end time', rows: tallyChoice(rows, 'end_time', END_TIME) },
    {
      heading: '4. Hours worked a day',
      note: 'Derived from the usual start and end times (the survey does not ask this separately).',
      rows: tallyChoice(rows.map((r) => ({ ...r, answers: { ...r.answers, hours_per_day: hoursPerDay(r.answers) } })), 'hours_per_day', HOURS_PER_DAY),
    },
    { heading: '5. Minutes to work, one way', rows: tallyChoice(rows, 'minutes_one_way', MINUTES_ONE_WAY) },
    { heading: '6. Miles to work, one way', rows: tallyChoice(rows, 'miles_one_way', MILES_ONE_WAY) },
    { heading: '8. Transit routes used', rows: routeRows },
    { heading: '9. Own car used for work business, times a month', rows: tallyChoice(rows, 'car_for_business', CAR_FOR_BUSINESS) },
    { heading: '10. Where the car is parked, driving the whole way', rows: tallyChoice(rows, 'parking_full', PARKING_FULL) },
    { heading: '11. Where the car is parked, driving part way', rows: tallyChoice(rows, 'parking_part', PARKING_PART) },
    { heading: '12. Why employees walk, bike, take transit or carpool', note: 'Mark all that apply.', rows: tallyMulti(rows, 'why_shift', WHY_SHIFT) },
    { heading: '13. Why employees drive alone', note: 'Mark all that apply.', rows: tallyMulti(rows, 'why_drive', WHY_DRIVE) },
    { heading: '14. How likely employees would change if these were offered', note: 'Very likely / Somewhat likely / Not likely / Already available.', rows: incentiveRows },
    {
      heading: 'Method',
      paragraphs: [
        `Survey of the week of ${weekLabel(survey.week_start)}, closed ${longDate(survey.closes_on)}, on the City of Cambridge employee transportation survey questions. Personal links went to ${survey.invited.toLocaleString()} work email addresses (one answer per person); an open link and QR code served staff without email; Shift app users answered in the app. "Dropped off" was offered as its own answer and is reported under carpool. Question 15 (free text) is held by Green Streets Initiative and is not in this summary.`,
      ],
    },
  ]
  if (evidence) sections.push(evidenceSection(evidence))
  return {
    title: `${RULE_SET_LABEL.cambridge} survey summary`,
    subtitle: `${survey.title}. Tallies in the City template's order, for copying into the PTDM annual report.`,
    sections,
  }
}

// ── Boston TAPA ───────────────────────────────────────────────────────────

/** Mode share over commute days (days at the site), all respondents. */
export function modeShare(rows: ExportResponse[]): { commuteDays: number; personDays: number; shares: Record<string, number> } {
  const s: Record<string, number> = { drive_alone: 0, carpool: 0, transit: 0, walk: 0, bike: 0, shuttle: 0, ridehail: 0, other: 0, telework: 0, away: 0 }
  let personDays = 0
  for (const r of rows) {
    for (const d of WEEKDAYS) {
      const a = r.answers.days[d]
      if (!a) continue
      personDays++
      switch (a.mode) {
        case 'drive_alone': s.drive_alone++; break
        case 'drive_bike': (a.longest === 'bike' ? s.bike++ : s.drive_alone++); break
        case 'carpool': case 'dropped_off': s.carpool++; break
        case 'transit_walk': case 'transit_bike': case 'transit_bikeshare': case 'transit_drive': s.transit++; break
        case 'walk': s.walk++; break
        case 'bike': case 'bikeshare': s.bike++; break
        case 'shuttle': s.shuttle++; break
        case 'ridehail_shared': case 'ridehail_alone': s.ridehail++; break
        case 'telework': s.telework++; break
        case 'day_off': case 'out_of_office': s.away++; break
        default: s.other++
      }
    }
  }
  const commuteDays = personDays - s.telework - s.away
  return { commuteDays, personDays, shares: s }
}

export function bostonExport(survey: ExportSurvey, rows: ExportResponse[], evidence: Evidence | null): ExportDoc {
  const { commuteDays, personDays, shares } = modeShare(rows)
  const responded = survey.responded_matched + survey.responded_unmatched
  const company = evidence?.company ?? 'The project'
  const part = (k: string) => pct(shares[k], commuteDays)
  const paragraph =
    `${company} surveyed employees about their commute for the week of ${weekLabel(survey.week_start)} (survey closed ${longDate(survey.closes_on)}). ` +
    `${responded.toLocaleString()} employees responded${survey.headcount ? `, a ${pct(responded, survey.headcount)} response rate against a headcount of ${survey.headcount.toLocaleString()}` : ''}. ` +
    `Of ${commuteDays.toLocaleString()} reported commute days, ${part('drive_alone')} were driving alone, ${part('transit')} public transit, ${part('walk')} walking, ${part('bike')} biking, ${part('carpool')} carpool or vanpool, ${part('shuttle')} shuttle and ${part('ridehail')} taxi or ride-hail. ` +
    `Employees worked from home on ${pct(shares.telework, personDays)} of the ${personDays.toLocaleString()} person-days in the week.` +
    (evidence
      ? ` Year-round, ${evidence.members.toLocaleString()} employees take part in ${company}'s commuter program on the Shift app; in ${evidence.year} ${evidence.shift_rate_ytd_pct != null ? `${evidence.shift_rate_ytd_pct}% of their recorded trips were walking, biking or transit` : 'their trips are being recorded'}${evidence.shift_rate_first_30_pct != null ? `, up from ${evidence.shift_rate_first_30_pct}% in the program's first 30 days` : ''}.`
      : '')
  const sections: ExportSection[] = [
    { heading: 'For the annual report', paragraphs: [paragraph] },
    {
      heading: 'Mode share, commute days',
      note: 'Share of person-days employees travelled to the site. Telework and days off are excluded from the base.',
      rows: [
        ['Drive alone', part('drive_alone')],
        ['Public transit', part('transit')],
        ['Walk', part('walk')],
        ['Bike', part('bike')],
        ['Carpool or vanpool', part('carpool')],
        ['Shuttle', part('shuttle')],
        ['Taxi or ride-hail', part('ridehail')],
        ['Other', part('other')],
        ['Commute days', commuteDays],
        ['Telework days', shares.telework],
        ['Days off, sick, travel', shares.away],
      ],
    },
  ]
  if (evidence) sections.push(evidenceSection(evidence))
  return {
    title: `${RULE_SET_LABEL.boston} annual report paragraph`,
    subtitle: survey.title,
    sections,
  }
}

// ── Emissions ─────────────────────────────────────────────────────────────

/** EPA Emission Factors Hub 2025, Table 10, kg CO2e per vehicle-mile (car) or passenger-mile (transit). */
export const EPA_KG_PER_MILE = {
  car_gas: 0.297,
  bus: 0.066,
  subway: 0.093,
  commuter_rail: 0.133,
} as const

/** Transit factor from the routes a person checked; subway when none given. */
export function transitFactor(a: SurveyAnswers): number {
  const routes = a.transit_routes ?? []
  if (routes.some((r) => r.startsWith('cr_') || r === 'ferry')) return EPA_KG_PER_MILE.commuter_rail
  if (routes.some((r) => ['red', 'green', 'orange', 'blue', 'silver'].includes(r))) return EPA_KG_PER_MILE.subway
  if (a.bus_routes || routes.includes('shuttle_bus')) return EPA_KG_PER_MILE.bus
  return EPA_KG_PER_MILE.subway
}

/**
 * kg CO2e for one day's round trip over `roundTripMiles`. A day with two
 * parts uses the factor of the longer part over the whole distance (the
 * survey records which part was longer, not its length).
 */
export function dayEmissionsKg(a: SurveyAnswers, d: DayAnswer, roundTripMiles: number): number {
  const car = EPA_KG_PER_MILE.car_gas
  switch (d.mode) {
    case 'drive_alone':
    case 'ridehail_alone':
      return roundTripMiles * car
    case 'drive_bike':
      return d.longest === 'bike' ? 0 : roundTripMiles * car
    case 'carpool':
      return (roundTripMiles * car) / Math.max(2, d.size ?? 2)
    case 'dropped_off':
    case 'ridehail_shared':
      return (roundTripMiles * car) / 2
    case 'transit_walk':
      return roundTripMiles * transitFactor(a)
    case 'transit_bike':
    case 'transit_bikeshare':
      return d.longest === 'bike' ? 0 : roundTripMiles * transitFactor(a)
    case 'transit_drive':
      if (d.longest !== 'drive') return roundTripMiles * transitFactor(a)
      if (d.car_part === 'carpool') return (roundTripMiles * car) / 2
      if (d.car_part === 'shuttle') return roundTripMiles * EPA_KG_PER_MILE.bus
      return roundTripMiles * car
    case 'shuttle':
      return roundTripMiles * EPA_KG_PER_MILE.bus
    default:
      return 0
  }
}

export function emissionsExport(survey: ExportSurvey, rows: ExportResponse[], evidence: Evidence | null): ExportDoc {
  const modeDays = new Map<string, number>()
  const bandDays = new Map<string, number>()
  let officeDays = 0
  let teleworkDays = 0
  let awayDays = 0
  let miles = 0
  let kg = 0
  let withDistance = 0
  let withoutDistance = 0
  for (const r of rows) {
    const band = r.answers.miles_one_way
    const oneWay = band ? MILES_ONE_WAY_MIDPOINT[band] : null
    let counted = false
    for (const d of WEEKDAYS) {
      const a = r.answers.days[d]
      if (!a) continue
      if (a.mode === 'telework') { teleworkDays++; continue }
      if (!isCommuteDay(a.mode)) { awayDays++; continue }
      officeDays++
      const label = DAY_MODE_BY_CODE[a.mode].label
      modeDays.set(label, (modeDays.get(label) ?? 0) + 1)
      if (oneWay == null) continue
      counted = true
      bandDays.set(band!, (bandDays.get(band!) ?? 0) + 1)
      miles += oneWay * 2
      kg += dayEmissionsKg(r.answers, a, oneWay * 2)
    }
    if (counted) withDistance++
    else if (band == null) withoutDistance++
  }
  const sections: ExportSection[] = [
    {
      heading: 'The week in numbers',
      rows: [
        ['Survey week', weekLabel(survey.week_start)],
        ['Respondents', rows.length],
        ['Respondents with a one-way distance', withDistance],
        ['Respondents without one (not in the miles or emissions figures)', withoutDistance],
        ['Office days (person-days at the site)', officeDays],
        ['Telework days', teleworkDays],
        ['Days off, sick or travelling', awayDays],
        ['Commute miles, round trips, respondents with a distance', Math.round(miles).toLocaleString()],
        ['Commuting emissions for the week, kg CO2e', Math.round(kg).toLocaleString()],
        ['Per office day, kg CO2e', officeDays ? (Math.round((kg / Math.max(1, bandSum(bandDays))) * 100) / 100).toString() : '0'],
      ],
    },
    {
      heading: 'Person-days by mode',
      rows: [...modeDays.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v]),
    },
    {
      heading: 'Person-days by one-way distance',
      note: 'The distance band each person gave; the midpoint of the band is used for miles.',
      rows: MILES_ONE_WAY.map((o) => [`${o.label} miles (counted as ${MILES_ONE_WAY_MIDPOINT[o.code]})`, bandDays.get(o.code) ?? 0]),
    },
    {
      heading: 'Factors and method',
      paragraphs: [
        `GHG Protocol Scope 3, category 7 (employee commuting), distance-based method. For each respondent and each day at the site: the round-trip distance (twice the midpoint of the one-way band they gave) times the emission factor of the way they travelled. Factors from the EPA 2025 Emission Factors Hub, Table 10, in kg CO2e per mile: car driven alone ${EPA_KG_PER_MILE.car_gas} (gasoline passenger car); carpool the car figure divided by the people in it; being dropped off, or a shared taxi, as a two-person carpool; bus and shuttle ${EPA_KG_PER_MILE.bus} per rider; subway and light rail ${EPA_KG_PER_MILE.subway}; commuter rail and ferry ${EPA_KG_PER_MILE.commuter_rail}. Transit days use the factor of the lines the person checked, subway when none were. A day with two parts (park and pedal, transit plus a car) uses the factor of the part the person said covered the most distance over the whole trip. Walking, biking, scooters and telework are zero. This is the week's activity data and an emissions figure; the company's carbon accountant may apply their own factors and scale to the year.`,
      ],
    },
  ]
  if (evidence) sections.push(evidenceSection(evidence))
  return {
    title: 'Staff commuting emissions, survey week',
    subtitle: survey.title,
    sections,
  }
}

function bandSum(m: Map<string, number>): number {
  let n = 0
  for (const v of m.values()) n += v
  return n
}

// ── Shift's year-round evidence ───────────────────────────────────────────

export function evidenceSection(e: Evidence): ExportSection {
  const rows: ExportRow[] = [
    ['Employees in the Shift program', e.members],
    ['Active in the last 30 days', e.active_members],
    [`Walking, biking and transit share of recorded trips, ${e.year}`, e.shift_rate_ytd_pct == null ? 'not enough trips yet' : `${e.shift_rate_ytd_pct}%`],
  ]
  if (e.shift_rate_first_30_pct != null) rows.push([`Same share in the first 30 days${e.first_30_label ? ` (${e.first_30_label})` : ''}`, `${e.shift_rate_first_30_pct}%`])
  if (e.drive_alone_share_ytd_pct != null) rows.push([`Drive-alone share of recorded trips, ${e.year}`, `${e.drive_alone_share_ytd_pct}%`])
  rows.push([`Active trips recorded, ${e.year}`, e.active_trips_ytd])
  rows.push([`CO2e avoided vs driving alone, ${e.year}, kg`, Math.round(e.co2_avoided_kg_ytd)])
  rows.push([`Team challenges run in ${e.year}`, e.challenges.length ? e.challenges.map((c) => c.name).join('; ') : 'none yet'])
  return {
    heading: 'Measures taken and commuter response: the Shift program, year-round',
    note: `${e.company} runs a commuter program on the Shift app (Green Streets Initiative). These are recorded trips from employees who joined, counted the same way all year, for the "measures implemented and commuter response" part of the filing.`,
    rows,
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────

export function exportFor(ruleSet: RuleSet, survey: ExportSurvey, rows: ExportResponse[], evidence: Evidence | null): ExportDoc {
  switch (ruleSet) {
    case 'massdep':
      return massdepExport(survey, rows, evidence)
    case 'cambridge':
      return cambridgeExport(survey, rows, evidence)
    case 'boston':
      return bostonExport(survey, rows, evidence)
    default:
      return emissionsExport(survey, rows, evidence)
  }
}

function csvCell(v: string | number): string {
  return `"${String(v).replace(/"/g, '""')}"`
}

/** One CSV: section, label, value; paragraphs as a row each. */
export function exportCsv(doc: ExportDoc): string {
  const lines = [['Section', 'Item', 'Value'].map(csvCell).join(',')]
  for (const s of doc.sections) {
    for (const [k, v] of s.rows ?? []) lines.push([s.heading, k, v].map(csvCell).join(','))
    for (const para of s.paragraphs ?? []) lines.push([s.heading, 'Text', para].map(csvCell).join(','))
  }
  return lines.join('\n')
}

/** Plain text for pasting into a report or an email. */
export function exportText(doc: ExportDoc): string {
  const out: string[] = [doc.title, doc.subtitle, '']
  for (const s of doc.sections) {
    out.push(s.heading.toUpperCase())
    if (s.note) out.push(s.note)
    for (const [k, v] of s.rows ?? []) out.push(`${k}: ${v}`)
    for (const para of s.paragraphs ?? []) out.push(para)
    out.push('')
  }
  return out.join('\n')
}
