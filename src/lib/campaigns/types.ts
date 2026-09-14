/*
 * The normalized shape every promotable campaign collapses into.
 *
 * THIS TYPE IS THE SERIALIZATION BOUNDARY. Everything read with the
 * service-role key that is not a field here never leaves queries.ts, which
 * makes the privacy audit a single-file read.
 *
 * Deliberately absent, permanently:
 *   campaigns.code        — the primary key IS the redemption code
 *   cap_total             — a live rationing lever; supply copy is curated
 *   enabled               — a filter, not a fact to publish
 *   matchup_group_ids     — other organizations' internal group UUIDs
 *   prizes_json           — no prize promise is made here
 *
 * Only a type import, from a module that is itself import-free: Nav is a
 * client component and reads from here.
 */

import type { CampaignIcon } from './routes'

/** Which system the row came from. Decides which card body renders. */
export type PromotableKind = 'flagship' | 'unlock'

/** Derived from dates at read time. Neither source table has a status column. */
export type PromotablePhase = 'active' | 'upcoming' | 'wrapped'

export interface Promotable {
  /**
   * Public, stable, non-secret: `flagship:walk-ride-day`, `unlock:semester`.
   * The slug half comes from the copy registry, never from a table key.
   * Doubles as the analytics `destination` token, so no UUID reaches PostHog.
   */
  id: string
  kind: PromotableKind
  /** 'db' = a real row. 'derived' = a synthesized recurrence. */
  source: 'db' | 'derived'

  title: string
  /** Resolved to a component by components/challenges/icons.ts. */
  icon: CampaignIcon
  /** Nav and row-label form. Registry-capped at 22 characters. */
  shortTitle: string
  blurb: string | null

  /** ISO 8601. flagship: starts_at/ends_at. unlock: signup_start/signup_end. */
  startsAt: string
  endsAt: string
  /**
   * What the window MEANS.
   *   'event'  — the thing happens between these dates.
   *   'signup' — you can join between these dates; the activity runs on your
   *              own clock afterwards.
   * A signup window must never be labelled "when it happens".
   */
  windowKind: 'event' | 'signup'
  /** Start and end fall on the same America/New_York calendar day. */
  singleDay: boolean

  phase: PromotablePhase

  /** Destination. null = a self-contained entry with no page of its own. */
  href: string | null
  secondaryHref: string | null
  secondaryLabel: string | null

  /** kind === 'flagship' only. */
  event: {
    sponsorName: string | null
    sponsorLogoUrl: string | null
    /** Set when this is one occurrence of a recurring series. */
    seriesKey: 'walk-ride-day' | null
    /** Later occurrences, for the "then …" footnote. ISO dates. */
    seriesNextDates: string[]
  } | null

  /** kind === 'unlock' only. Public facts only — no code, no claim mechanic. */
  mechanic: {
    tripsRequired: number
    windowDays: number
    /** "$15 reward". Derived from value_cents. Never a code. */
    rewardLabel: string
    /** "First 200" — curated copy, not the live cap. */
    supplyLabel: string | null
    /** "Verify a school email", or null. */
    gateLabel: string | null
  } | null
}

/** The only thing that crosses into the client nav. Four strings. */
export interface NavPromo {
  href: string
  /** "Walk/Ride Day · Sep 25" */
  label: string
  /** "Walk/Ride Day" — the narrow-viewport fallback. */
  shortLabel: string
  /** Tracking token: the Promotable id. */
  id: string
}
