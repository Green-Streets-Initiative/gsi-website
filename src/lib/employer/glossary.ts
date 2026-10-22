// The portal's terms, explained once (Keith 2026-10-22: "we need info modals
// for terms like Shift Rate. That's not something a user will know until we
// explain it"). A one-line answer people read, then how it's counted for
// those who want it. The longer wording comes from How we count on Impact,
// so the two never disagree.

import { HOW_WE_COUNT } from '@/app/shift/employers/portal/_components/HowWeCountCard'
import { READY_MIN_PEOPLE, READY_PCT, STRONG_PCT } from '@/app/shift/employers/portal/_lib/participation'

export type Term = { title: string; short: string; detail?: string; scale?: { label: string; means: string }[] }

const how = (title: string) => HOW_WE_COUNT.find((h) => h.title === title)?.body

export const GLOSSARY = {
  shiftRate: {
    title: 'Shift Rate',
    short: "The share of your team's trips made on foot, by bike or scooter, on transit, or in a carpool.",
    detail: how('Shift Rate'),
  },
  joined: {
    title: 'Joined',
    short: "People at your workplace who have joined your team in the Shift app, out of the headcount you gave on Setup.",
    scale: [
      { label: 'Just started', means: 'Under 1% of your headcount' },
      { label: 'Getting going', means: '1% to 3%' },
      { label: 'Ready for a challenge', means: `${READY_PCT}% and at least ${READY_MIN_PEOPLE} people, or your own goal` },
      { label: 'Strong', means: `${STRONG_PCT}% or more` },
    ],
    detail: 'Most people drive to work, so a few percent of a workplace is a real start for a program about walking, biking and transit.',
  },
  activeThisMonth: {
    title: 'Active this month',
    short: 'Of the people who joined, how many recorded at least one trip in the last 30 days.',
  },
  activeTrips: {
    title: 'Active trips',
    short: 'Trips on foot, by bike or scooter, or on a bus, train or ferry, recorded by Shift.',
    detail: how('Active trips'),
  },
  co2Avoided: {
    title: 'CO₂e avoided',
    short: "The emissions your team's trips avoided, compared with driving alone the same distance.",
    detail: how('CO₂e avoided'),
  },
  emissionsAvoidedPct: {
    title: 'Ground-travel emissions avoided',
    short: "Of the emissions your team's recorded trips would have produced driving alone, the share they avoided.",
    detail: how('Emissions shifted'),
  },
  driveAlone: {
    title: 'Drive-alone share',
    short: 'The share of recorded trips that were driving alone. Lower is better.',
    detail: how('Drive-alone share'),
  },
  triedNew: {
    title: 'Drivers trying something new',
    short: 'People who mostly drive who made a trip a new way in the last 30 days: on foot, by bike, on transit or in a carpool.',
    detail:
      "Mostly drive: half or more of their trips in the 60 days before were driving alone, out of at least five. A new way is one they hadn't used in those 60 days. This is the clearest sign your program is reaching the people who drive.",
  },
  participation: {
    title: 'Participation',
    short: 'People who joined your team on Shift, as a share of your headcount.',
    detail: how('Participation'),
  },
} satisfies Record<string, Term>

export type TermKey = keyof typeof GLOSSARY
