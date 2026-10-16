/**
 * Every sentence the commute-survey section shows an admin, in one place so
 * the copy pass reads it as the admin does (Keith 2026-10-13): plain words,
 * terms of art glossed where they appear, no "always this, never that".
 */
import type { RuleSet } from '@/lib/employer/survey-instrument'

export type Filing = {
  id: RuleSet
  title: string
  /** When it is due, as the admin thinks of it. */
  due: string
  /** Who it applies to, one line, on the wizard card. */
  who: string
  /** What to do with the summary, on the Summaries tab. */
  whatToDo: string
}

export const FILINGS: Filing[] = [
  {
    id: 'massdep',
    title: 'MassDEP Rideshare',
    due: 'Report due December 31',
    who: 'MassDEP is the state environmental agency. If 1,000 or more people commute to your site (250 if the site has a state air permit), state air-quality rules say you must survey how they get to work and send MassDEP a report every year by December 31. At least half of your regular daytime commuters have to answer.',
    whatToDo:
      'One PDF per site, signed by a vice president or higher, emailed to MassDEP.RideshareReg@mass.gov by December 31. Because this is not MassDEP’s own form, the PDF includes a copy of the survey questions.',
  },
  {
    id: 'cambridge',
    title: 'Cambridge PTDM',
    due: 'Report due November 30 or June 30',
    who: 'The City of Cambridge requires large parking lots and garages to have a plan for cutting drive-alone trips. If your property has one, the City surveys your employees itself in its own online tool (60% of employees must answer). This survey adds the year-round numbers and the raffle sign-up for your report.',
    whatToDo:
      'Cambridge requires its own online survey, taken in the City\u2019s Transportation Monitoring Tool, with 60% of employees answering. Use what is here for the rest of the report: list the Shift program under TDM Implementation, and paste the year-round numbers into the Annual Review. If you run a raffle, the City redirects its survey to a sign-up form; Shift can host that form.',
  },
  {
    id: 'boston',
    title: 'Boston TAPA',
    due: 'Annual report due November 30',
    who: 'Boston requires new buildings of 50,000 square feet and up to sign a Transportation Access Plan Agreement and report every year on how people get there. If your building has one, this survey gives you the paragraph on how staff commute.',
    whatToDo: 'Paste the paragraph into your TAPA annual report, due November 30. The City has no template.',
  },
  {
    id: 'emissions',
    title: 'Commuting emissions',
    due: 'No filing',
    who: 'Your staff commuting emissions for a climate or ESG report, with the activity data behind the number.',
    whatToDo:
      'No deadline. Give the activity data and the CO2e figure to whoever writes your climate or ESG report (GHG Protocol Scope 3, category 7).',
  },
]

export const FILING_BY_ID: Record<RuleSet, Filing> = Object.fromEntries(FILINGS.map((f) => [f.id, f])) as Record<RuleSet, Filing>

/** Hints behind the (i) on each hero figure. */
export const SURVEY_HINTS = {
  answered: 'Everyone who finished the survey: personal links, the Shift app and the open link.',
  responseRate: 'Answers divided by the headcount you gave under Setup. This is the rate a filing reports.',
  ofList: 'People on your staff list who answered through their own link or the app.',
  headcount: 'How many people you are asking, per site. The response rate is measured against it.',
  applicable:
    'The people MassDEP counts: regular daytime commuters who work 17 or more hours a week, start and end between 6 AM and 8 PM, and do not need their own car for work.',
  daysLeft: 'Until the last day to answer. Reminders stop then; the survey stays open until you close it.',
  onList: 'People you added under People. Each gets a personal link when the survey opens.',
  openLink: 'Answers through the open link or QR, for staff without a work email. They count in the totals and are not tied to a name.',
  surveyWeek: 'The Monday to Friday staff answer about.',
  lastDay: 'Reminders stop on this day. Answers are accepted until you close the survey.',
} as const

/** MassDEP's response bands and what each one gets you, as the tick labels under the bar. */
export const MASSDEP_BANDS = [
  { at: 50, label: '50%', form: 'Minimum' },
  { at: 75, label: '75%', form: 'Medium form' },
  { at: 90, label: '90%', form: 'Shortest form' },
] as const

/**
 * The lines under the MassDEP bar (Keith 2026-10-15: plain words, bullets so it
 * skims; MassDEP's own names for the forms, SCD 1 to 3, appear only in the help
 * drawer, where the filer meets them once).
 */
export const MASSDEP_GLOSS_LINES = [
  'MassDEP only counts regular daytime commuters: people who work at least 17 hours a week, start and end between 6 AM and 8 PM, and do not need their own car for work.',
  'At least half of them have to answer.',
  'The more who answer, the shorter the form you file: 9 in 10 gets the shortest form, 3 in 4 the medium one.',
  'Between half and three quarters, you file the medium form only if you add one more commuter incentive.',
] as const

export const CAMBRIDGE_FLOOR_LINE = 'Cambridge requires 60% of employees to answer its own online survey (City of Cambridge, October 2026); this survey does not replace it.'

/** The sub line after "N of M answered.": what the current rate gets you with MassDEP. */
export function massdepBandShort(ratePct: number): string {
  if (ratePct >= 90) return 'Enough for the shortest MassDEP form'
  if (ratePct >= 75) return 'Enough for the medium MassDEP form'
  if (ratePct >= 50) return 'Enough for the medium MassDEP form if you add one more commuter incentive'
  return 'Below the half MassDEP needs'
}
